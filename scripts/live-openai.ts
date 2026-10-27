// Explicit opt-in. Persistent metadata ledger covers all stages and reruns.
// No secret extraction, raw PDF/model logs or automatic retries.
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { openSync, closeSync, unlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import nextEnv from "@next/env";
import { phase15Scenario, type ScenarioId } from "../tests/fixtures/phase15";
import { layoutCases, layoutFixture } from "../tests/fixtures/layouts";
import { evaluateLayoutResults } from "./lib/layout-evaluation";
import { assertProduction } from "./lib/release-policy";
import {
  requestUpperCost,
  reserveTestBudget,
  reconcileTestBudget,
  type TestBudget,
} from "./lib/openai-budget";
import { openAIRequest } from "../src/modules/ai/openai";
import { extractPdfText } from "../src/modules/pdf/extract";
import { analyzeFile } from "../src/modules/analysis/pipeline";
import { normalizeText } from "../src/modules/evidence/verify";
import { compareQuantities } from "../src/modules/rules/quantity";
import type {
  AnalysisResult,
  ExtractedDocument,
} from "../src/modules/documents/schema";
nextEnv.loadEnvConfig(process.cwd());
const args = process.argv.slice(2),
  arg = (key: string) =>
    args.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const stage = arg("stage") ?? "all",
  scenario = arg("scenario"),
  selected = arg("case"),
  sha = arg("sha");
if (!["all", "single", "pair", "ad", "layouts", "repeat"].includes(stage))
  throw new Error("Unknown test stage");
if (scenario && (stage !== "ad" || !["A", "B", "C", "D"].includes(scenario)))
  throw new Error("--scenario requires --stage=ad and A, B, C or D");
if (selected && !layoutCases.some((c) => c.id === selected))
  throw new Error("Unknown layout case");
const remote = args.includes("--local")
  ? null
  : "https://ai-portcheck.vercel.app";
const directory = "test-results/live-openai",
  ledgerPath = directory + "/ledger.json";
await mkdir(directory, { recursive: true });
let lock: number;
try {
  lock = openSync(directory + "/run.lock", "wx");
} catch {
  throw new Error(
    "Validation already running or interrupted; inspect the ledger/old process before removing a stale run.lock",
  );
}
process.once("exit", () => {
  closeSync(lock);
  unlinkSync(directory + "/run.lock");
});
type Entry = {
  id: string;
  deploymentSha: string | null;
  documents: number;
  status: string;
  providerSuccesses: number;
  expectedFields: number;
  groundedCorrectFields: number;
  correctValues: number;
  ruleCorrect: boolean | null;
  errorCodes: (string | null)[];
  models: (string | null)[];
  usage: AnalysisResult["aiUsage"][];
  providerDiagnostics: (
    | NonNullable<AnalysisResult["error"]>["diagnostics"]
    | null
  )[];
  signature: string;
  details: unknown;
};
type Ledger = { budget: TestBudget; cases: Entry[]; stopReason: string | null };
let ledger: Ledger;
try {
  ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== "ENOENT")
    throw new Error("Budget ledger unreadable; do not reset it to retry");
  const fresh: Ledger = {
    budget: {
      documents: 0,
      measuredCostUsd: 0,
      unresolvedCostUpperUsd: 0,
      maxDocuments: 20,
      maxCostUsd: 0.5,
    },
    cases: [],
    stopReason: null,
  };
  // A new cloud checkout must not reset the already consumed PHASE 2.2 budget.
  // The committed report contains safe metadata only, never keys or documents.
  try {
    const archive = JSON.parse(
      await readFile("docs/validation/phase22-2026-10-11.json", "utf8"),
    );
    if (
      archive.mode !== "actual-openai-synthetic-pdfs" ||
      !archive.budget ||
      !Array.isArray(archive.cases)
    )
      throw new Error("Invalid saved budget archive");
    ledger = { budget: archive.budget, cases: archive.cases, stopReason: null };
  } catch (archiveError) {
    if ((archiveError as NodeJS.ErrnoException).code !== "ENOENT")
      throw new Error(
        "Saved validation budget is unreadable; do not reset it to retry",
      );
    ledger = fresh;
  }
}
if (
  !ledger.budget ||
  !Array.isArray(ledger.cases) ||
  !Number.isSafeInteger(ledger.budget.documents) ||
  ledger.budget.documents < 0 ||
  ![ledger.budget.measuredCostUsd, ledger.budget.unresolvedCostUpperUsd].every(
    (n) => Number.isFinite(n) && n >= 0,
  ) ||
  !Number.isSafeInteger(ledger.budget.maxDocuments) ||
  ledger.budget.maxDocuments < 20 ||
  ledger.budget.maxDocuments > 40 ||
  ledger.budget.maxCostUsd !== 0.5
)
  throw new Error("Invalid budget ledger");
// Only use after explicit user approval; default never exceeds the authorized cap.
const extra = Number(arg("approved-extra-documents") ?? 0);
if (!Number.isInteger(extra) || extra < 0 || extra > 20)
  throw new Error("Invalid approved extra document count");
ledger.budget.maxDocuments = Math.max(ledger.budget.maxDocuments, 20 + extra);
const save = async () => {
  await writeFile(ledgerPath + ".tmp", JSON.stringify(ledger, null, 2));
  await rename(ledgerPath + ".tmp", ledgerPath);
};
if (remote) {
  if (!sha || !/^[a-f0-9]{40}$/.test(sha))
    throw new Error("Production tests require --sha=<exact deployed commit>");
  const response = await fetch(remote + "/api/status", {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  const status = await response.json();
  assertProduction(status, sha);
  if (status.model !== "gpt-6-luna")
    throw new Error(
      "Budgeted verification requires documented Luna pricing/model",
    );
} else if (!process.env.OPENAI_API_KEY) {
  ledger.stopReason = "OPENAI_API_KEY_NOT_CONFIGURED_NO_CALL";
  await save();
  console.log(
    JSON.stringify({
      keyConfigured: false,
      actualCalls: 0,
      reason: ledger.stopReason,
    }),
  );
  process.exit(2);
}
ledger.stopReason = null;
async function request(id: string, files: File[]) {
  const bounds = await Promise.all(
    files.map(async (file) => {
      const pages = await extractPdfText(
        new Uint8Array(await file.arrayBuffer()),
      );
      return requestUpperCost(
        Buffer.byteLength(
          JSON.stringify(
            openAIRequest(
              { id: "synthetic", fileName: file.name, pages },
              "gpt-6-luna",
            ),
          ),
        ),
      );
    }),
  );
  try {
    reserveTestBudget(ledger.budget, bounds);
  } catch (e) {
    ledger.stopReason = (e as Error).message;
    await save();
    return null;
  }
  // Persist BEFORE the network request. Timeouts/restarts consume counts and
  // retain conservative cost rather than silently resetting/retrying the budget.
  await save();
  console.log(
    JSON.stringify({
      request: id,
      documents: files.length,
      reservedDocuments: ledger.budget.documents,
    }),
  );
  let results: AnalysisResult[];
  try {
    if (remote) {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      if (files.length === 2)
        form.append("slots", '["invoice","packing_list"]');
      const r = await fetch(remote + "/api/analyze", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(110000),
      });
      const p = await r.json().catch(() => null);
      if (
        !r.ok ||
        !Array.isArray(p?.results) ||
        p.results.length !== files.length
      )
        throw new Error("INVALID_SERVER_RESPONSE");
      results = p.results;
    } else {
      results = [];
      for (const file of files) results.push(await analyzeFile(file));
    }
  } catch {
    ledger.stopReason = "PRODUCTION_ANALYSIS_UNAVAILABLE_SPEND_UNKNOWN";
    await save();
    return null;
  }
  results.forEach((r, i) =>
    reconcileTestBudget(
      ledger.budget,
      bounds[i],
      r.aiUsage?.estimatedCostUsd ?? null,
    ),
  );
  if (
    results.some(
      (r) =>
        r.aiUsage?.model !== "gpt-6-luna" ||
        r.aiUsage?.requestCount !== 1 ||
        r.aiUsage?.retryCount !== 0,
    )
  )
    ledger.stopReason = "UNEXPECTED_MODEL_OR_USAGE_STOP";
  await save();
  return results;
}
function add(
  id: string,
  results: AnalysisResult[],
  expected: ExtractedDocument[],
  evaluation: {
    passed: boolean;
    expectedFields: number;
    correctValues: number;
    groundedCorrectFields: number;
    ruleCorrect: boolean | null;
    details: unknown;
  },
) {
  const signature = createHash("sha256")
    .update(
      JSON.stringify(
        results.map(
          (r) =>
            r.document && {
              type: r.document.type,
              seller: [r.document.seller.value, r.document.seller.status],
              buyer: [r.document.buyer.value, r.document.buyer.status],
              reference: [
                r.document.transactionReference.value,
                r.document.transactionReference.status,
              ],
              items: r.document.items.map((i) => [
                i.description.value,
                i.description.status,
                i.quantity.value,
                i.quantity.status,
                i.unit.value,
                i.unit.status,
              ]),
            },
        ),
      ),
    )
    .digest("hex");
  const entry: Entry = {
    id,
    deploymentSha: sha ?? null,
    documents: expected.length,
    status: evaluation.passed ? "passed" : "failed",
    providerSuccesses: results.filter((r) => r.document && !r.error).length,
    expectedFields: evaluation.expectedFields,
    correctValues: evaluation.correctValues,
    groundedCorrectFields: evaluation.groundedCorrectFields,
    ruleCorrect:
      results.length === expected.length &&
      results.every((r) => r.document && !r.error)
        ? evaluation.ruleCorrect
        : null,
    errorCodes: results.map((r) => r.error?.code ?? null),
    models: results.map((r) => r.aiModel ?? null),
    usage: results.map((r) => r.aiUsage),
    providerDiagnostics: results.map((r) => r.error?.diagnostics ?? null),
    signature,
    details: evaluation.details,
  };
  ledger.cases.push(entry);
  console.log(JSON.stringify(entry));
  if (!evaluation.passed && !ledger.stopReason)
    ledger.stopReason = "FAILED_STAGE_STOP_FIX_BEFORE_NEXT_CALL";
}
function evaluateAD(
  results: AnalysisResult[],
  expected: ExtractedDocument[],
  id: ScenarioId,
  single = false,
) {
  let expectedFields = 0,
    correctValues = 0,
    groundedCorrectFields = 0;
  for (const [index, e] of expected.entries()) {
    const actual = results[index]?.document;
    for (const key of [
      "seller",
      "buyer",
      "documentNumber",
      "transactionReference",
      "partialShipment",
    ] as const) {
      const wanted = e[key];
      if (wanted.value === null || wanted.value === "unknown") continue;
      expectedFields++;
      const got = actual?.[key];
      if (
        got &&
        normalizeText(String(got.value)) === normalizeText(String(wanted.value))
      ) {
        correctValues++;
        if (got.status === "verified") groundedCorrectFields++;
      }
    }
    for (const [i, item] of e.items.entries())
      for (const key of ["description", "quantity", "unit"] as const) {
        expectedFields++;
        const got = actual?.items[i]?.[key];
        if (
          got &&
          normalizeText(String(got.value)) ===
            normalizeText(String(item[key].value))
        ) {
          correctValues++;
          if (got.status === "verified") groundedCorrectFields++;
        }
      }
  }
  const checks = compareQuantities(
    results.flatMap((r) => (r.document ? [r.document] : [])),
  );
  const providerResponses =
    results.length === expected.length &&
    results.every((r) => r.document && !r.error);
  const singleStateCorrect =
    checks.length === 1 && checks[0].confidence === "unavailable";
  const ruleCorrect =
    single || !providerResponses
      ? null
      : checks.length === 1 &&
        checks[0].status ===
          (id === "B" ? "mismatch" : id === "D" ? "unverifiable" : "match") &&
        (id !== "D" || checks[0].confidence !== "confirmed");
  const classified =
    results.length === expected.length &&
    results.every((r, i) => r.document?.type === expected[i].type);
  return {
    passed:
      classified &&
      providerResponses &&
      groundedCorrectFields === expectedFields &&
      (single ? singleStateCorrect : ruleCorrect === true),
    expectedFields,
    correctValues,
    groundedCorrectFields,
    ruleCorrect,
    details: {
      classified,
      providerResponses,
      singleDocumentState: single ? singleStateCorrect : null,
      rules: checks.map((c) => ({
        status: c.status,
        confidence: c.confidence,
      })),
      fieldStates: results.map((r) =>
        r.document
          ? {
              seller: r.document.seller.status,
              buyer: r.document.buyer.status,
              reference: r.document.transactionReference.status,
              items: r.document.items.map((i) => ({
                description: i.description.status,
                quantity: i.quantity.status,
                unit: i.unit.status,
              })),
            }
          : null,
      ),
    },
  };
}
async function ad(id: ScenarioId, single = false) {
  const fixture = phase15Scenario(id),
    docs = single ? fixture.documents.slice(0, 1) : fixture.documents;
  const results = await request(
    single ? "connection-single-A" : `A-D-${id}`,
    await Promise.all(docs.map((f) => f.makeFile())),
  );
  if (
    results ||
    ledger.stopReason === "PRODUCTION_ANALYSIS_UNAVAILABLE_SPEND_UNKNOWN"
  )
    add(
      single ? "connection-single-A" : `A-D-${id}`,
      results ?? [],
      docs.map((d) => d.data),
      evaluateAD(
        results ?? [],
        docs.map((d) => d.data),
        id,
        single,
      ),
    );
  await save();
}
if (["all", "single"].includes(stage) && !selected && !ledger.stopReason)
  await ad("A", true);
if (["all", "pair"].includes(stage) && !selected && !ledger.stopReason)
  await ad("A");
if (["all", "ad"].includes(stage) && !selected) {
  const ids: ScenarioId[] = scenario
    ? [scenario as ScenarioId]
    : stage === "ad"
      ? ["A", "B", "C", "D"]
      : ["B", "C", "D"];
  for (const id of ids) {
    if (ledger.stopReason) break;
    await ad(id);
  }
}
if (["all", "layouts"].includes(stage) || selected) {
  for (const c of selected
    ? layoutCases.filter((c) => c.id === selected)
    : layoutCases) {
    if (ledger.stopReason) break;
    const fixtures = await Promise.all([
      layoutFixture(c.id, "invoice"),
      layoutFixture(c.id, "packing_list"),
    ]);
    const results = await request(
      `layout-${c.id}`,
      fixtures.map((f) => f.makeFile()),
    );
    if (!results) {
      if (
        ledger.stopReason === "PRODUCTION_ANALYSIS_UNAVAILABLE_SPEND_UNKNOWN"
      ) {
        const ev = evaluateLayoutResults(
          [],
          fixtures.map((f) => f.data),
          c.id,
        );
        add(
          `layout-${c.id}`,
          [],
          fixtures.map((f) => f.data),
          { ...ev, details: ev },
        );
        await save();
      }
      break;
    }
    const ev = evaluateLayoutResults(
      results,
      fixtures.map((f) => f.data),
      c.id,
    );
    add(
      `layout-${c.id}`,
      results,
      fixtures.map((f) => f.data),
      { ...ev, details: ev },
    );
    await save();
  }
}
if (
  !selected &&
  !ledger.stopReason &&
  (stage === "all" ||
    stage === "repeat" ||
    (stage === "layouts" && arg("repeat") === "2"))
) {
  const first = layoutCases[0],
    fixtures = await Promise.all([
      layoutFixture(first.id, "invoice"),
      layoutFixture(first.id, "packing_list"),
    ]);
  const results = await request(
    `repeat-${first.id}`,
    fixtures.map((f) => f.makeFile()),
  );
  if (results) {
    const ev = evaluateLayoutResults(
      results,
      fixtures.map((f) => f.data),
      first.id,
    );
    add(
      `repeat-${first.id}`,
      results,
      fixtures.map((f) => f.data),
      { ...ev, details: ev },
    );
    await save();
  }
}
const sameSha = ledger.cases.filter((c) => c.deploymentSha === (sha ?? null));
const required = [
  "connection-single-A",
  ...(["A", "B", "C", "D"] as const).map((id) => `A-D-${id}`),
  ...layoutCases.map((c) => `layout-${c.id}`),
  `repeat-${layoutCases[0].id}`,
];
const completed = required.every((id) =>
  sameSha.some((c) => c.id === id && c.status === "passed"),
);
const first = sameSha.find(
    (c) => c.id === `layout-${layoutCases[0].id}` && c.status === "passed",
  ),
  repeat = sameSha.find(
    (c) => c.id === `repeat-${layoutCases[0].id}` && c.status === "passed",
  );
const report = {
  mode: "actual-openai-synthetic-pdfs",
  model: "gpt-6-luna",
  keyConfigured: true,
  deploymentSha: sha ?? null,
  completed,
  budget: ledger.budget,
  stopReason: ledger.stopReason,
  cases: ledger.cases,
  repeatConsistent:
    first && repeat ? first.signature === repeat.signature : null,
  providerSuccesses: ledger.cases.reduce((n, c) => n + c.providerSuccesses, 0),
  expectedDocuments: ledger.budget.documents,
  groundedCorrectFields: ledger.cases.reduce(
    (n, c) => n + c.groundedCorrectFields,
    0,
  ),
  expectedFields: ledger.cases.reduce((n, c) => n + c.expectedFields, 0),
  missing: required.filter(
    (id) => !sameSha.some((c) => c.id === id && c.status === "passed"),
  ),
};
await writeFile(directory + "/report.json", JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    completed,
    budget: report.budget,
    stopReason: report.stopReason,
    providerSuccesses: report.providerSuccesses,
    grounded: report.groundedCorrectFields,
    expected: report.expectedFields,
    missing: report.missing,
  }),
);
process.exitCode = ledger.stopReason
  ? 1
  : stage === "all" && !completed
    ? 1
    : 0;
