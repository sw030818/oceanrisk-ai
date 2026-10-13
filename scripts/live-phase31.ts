import { shippingValues } from "../src/modules/shipping/fields";
// New approval required; one batch / three synthetic PDFs / $0.05 / no retries.
// Does not reuse or reset PHASE 2.2/2.3 ledgers. Never writes PDF/raw responses.
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { openSync, closeSync, unlinkSync } from "node:fs";
import { shipping31Fixture } from "../tests/fixtures/shipping31";
import { shippingTypes } from "../src/modules/shipping/catalog";
import { shippingOpenAIRequest } from "../src/modules/shipping/openai";
import { assertProduction } from "./lib/release-policy";
import {
  requestUpperCost,
  reserveTestBudget,
  reconcileTestBudget,
  type TestBudget,
} from "./lib/openai-budget";
import type { ShippingResult } from "../src/modules/shipping/prepare";
import type { ShippingField } from "../src/modules/shipping/schema";
const arg = (key: string) =>
  process.argv
    .find((a) => a.startsWith("--" + key + "="))
    ?.slice(key.length + 3);
const sha = arg("sha"),
  dry = process.argv.includes("--dry-run");
const fixtures = await Promise.all(
  shippingTypes.map((t) => shipping31Fixture(t)),
);
const bounds = fixtures.map((f) =>
  requestUpperCost(
    Buffer.byteLength(
      JSON.stringify(shippingOpenAIRequest(f.pdf, "gpt-6-luna")),
    ),
    8192,
  ),
);
if (dry) {
  console.log(
    JSON.stringify({
      mode: "NO_PROVIDER_CALL_BUDGET_PREVIEW",
      documents: 3,
      batches: 1,
      upperUsd: bounds.reduce((a, b) => a + b, 0),
      maximumUsd: 0.05,
      automaticRetries: 0,
    }),
  );
  process.exit(0);
}
if (!sha || !/^[a-f0-9]{40}$/.test(sha))
  throw new Error("Exact Production SHA required");
if (
  arg("approved-documents") !== "3" ||
  arg("approved-max-cost-usd") !== "0.05"
)
  throw new Error(
    "New explicit approval required: 3 documents / $0.05; no call made",
  );
const base = "https://oceanrisk-ai.vercel.app",
  dir = "test-results/live-phase31",
  path = dir + "/ledger.json",
  archive = "docs/validation/phase31-live-2026-10-13.json";
await mkdir(dir, { recursive: true });
const lock = openSync(dir + "/run.lock", "wx");
process.once("exit", () => {
  closeSync(lock);
  unlinkSync(dir + "/run.lock");
});
let budget: TestBudget = {
  documents: 0,
  measuredCostUsd: 0,
  unresolvedCostUpperUsd: 0,
  maxDocuments: 3,
  maxCostUsd: 0.05,
};
for (const file of [archive, path]) {
  try {
    const p = JSON.parse(await readFile(file, "utf8"));
    const b = file === archive ? p.budget : p;
    if (!b) throw new Error("Missing archived budget");
    if (b.documents >= budget.documents) budget = b;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT")
      throw new Error("Unreadable budget; do not reset");
  }
}
if (
  budget.maxDocuments !== 3 ||
  budget.maxCostUsd !== 0.05 ||
  !Number.isSafeInteger(budget.documents) ||
  budget.documents < 0 ||
  budget.documents > 3 ||
  ![budget.measuredCostUsd, budget.unresolvedCostUpperUsd].every(
    (n) => Number.isFinite(n) && n >= 0,
  )
)
  throw new Error("Invalid PHASE 3.1 budget");
const save = async () => {
  await writeFile(path + ".tmp", JSON.stringify(budget, null, 2));
  await rename(path + ".tmp", path);
};
const s = await (
  await fetch(base + "/api/status?phase31live=" + Date.now(), {
    signal: AbortSignal.timeout(15000),
  })
).json();
assertProduction(s, sha);
if (
  s.model !== "gpt-6-luna" ||
  s.phase !== "3.1" ||
  s.capabilities?.aiExtraction !== true ||
  s.capabilities?.triangularComparison !== false
)
  throw new Error("Unpriced model or incompatible release; no call made");
reserveTestBudget(budget, bounds);
await save();
console.log(
  JSON.stringify({
    mode: "actual-openai-phase31-synthetic",
    reservedDocuments: budget.documents,
    reservedUpperUsd: budget.unresolvedCostUpperUsd,
    sourceSha: sha,
  }),
);
const form = new FormData();
fixtures.forEach((f) =>
  form.append(
    "files",
    new File([new Uint8Array(f.bytes)], f.pdf.fileName, {
      type: "application/pdf",
    }),
  ),
);
form.append("slots", JSON.stringify(shippingTypes));
form.append("operation", "analyze");
let results: ShippingResult[] = [];
try {
  const r = await fetch(base + "/api/analyze", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(115000),
  });
  const p = await r.json().catch(() => null);
  if (
    r.ok &&
    p?.mode === "shipping-analysis" &&
    Array.isArray(p.results) &&
    p.results.length === 3
  )
    results = p.results;
} catch {
  /* Unknown spend retains reservation; no retry. */
}
results.forEach((r, i) =>
  reconcileTestBudget(budget, bounds[i], r.aiUsage?.estimatedCostUsd ?? null),
);
await save();
const measurements = fixtures.map((f, i) => {
  const d = results[i]?.document;
  let expected = 0,
    correct = 0,
    grounded = 0;
  const check = (wanted: ShippingField, got: ShippingField | undefined) => {
    if (wanted.original.value === null) return;
    expected++;
    if (got?.original.value === wanted.original.value) {
      correct++;
      if (got.original.status === "verified") grounded++;
    }
  };
  Object.entries(f.document.fields).forEach(([k, v]) => check(v, d?.fields[k]));
  f.document.items.forEach((item) => {
    const matches =
      d?.items.filter(
        (a) =>
          a.fields.goodsDescription.original.value ===
          item.fields.goodsDescription.original.value,
      ) ?? [];
    const a = matches.length === 1 ? matches[0] : undefined;
    Object.entries(item.fields).forEach(([k, v]) => check(v, a?.fields[k]));
  });
  f.document.containers.forEach((c) => {
    const matches =
      d?.containers.filter(
        (a) =>
          a.containerNumber.original.value === c.containerNumber.original.value,
      ) ?? [];
    const a = matches.length === 1 ? matches[0] : undefined;
    for (const k of [
      "containerNumber",
      "sealNumber",
      "packageCount",
      "packageUnit",
      "grossWeight",
      "weightUnit",
    ] as const)
      check(c[k], a?.[k]);
  });
  f.document.cargoRecords.forEach((c) => {
    const matches =
      d?.cargoRecords.filter(
        (a) =>
          a.fields.houseBlNumber.original.value ===
          c.fields.houseBlNumber.original.value,
      ) ?? [];
    const a = matches.length === 1 ? matches[0] : undefined;
    Object.entries(c.fields).forEach(([k, v]) => check(v, a?.fields[k]));
  });
  f.document.references.forEach((ref) => {
    const matches =
      d?.references.filter(
        (a) =>
          a.kind === ref.kind &&
          a.number.original.value === ref.number.original.value,
      ) ?? [];
    check(ref.number, matches.length === 1 ? matches[0].number : undefined);
  });
  const present = d
    ? shippingValues(d).filter((v) => v.original.value !== null)
    : [];
  return {
    type: shippingTypes[i],
    structured: !!d && !results[i]?.error,
    classificationVerified:
      d?.classificationStatus === "classified" &&
      d.detectedType === shippingTypes[i],
    expectedFields: expected,
    correctValues: correct,
    groundedCorrectFields: grounded,
    returnedCandidateFields: present.length,
    returnedGroundedFields: present.filter(
      (v) => v.original.status === "verified",
    ).length,
    unverifiedCodes: present
      .filter((v) => v.original.status !== "verified")
      .map((v) => v.original.verificationCode ?? "context_unverified"),
    extractionStatus: d?.extractionStatus ?? null,
    itemCount: d?.items.length ?? 0,
    containerCount: d?.containers.length ?? 0,
    cargoCount: d?.cargoRecords.length ?? 0,
    referenceCount: d?.references.length ?? 0,
    errorCode: results[i]?.error?.code ?? null,
    diagnostics: results[i]?.error?.diagnostics ?? null,
  };
});
const success = measurements.every(
    (m) => m.structured && m.classificationVerified,
  ),
  allExpectedGrounded = measurements.every(
    (m) => m.expectedFields > 0 && m.groundedCorrectFields === m.expectedFields,
  );
const report = {
  mode: "actual-openai-phase31-synthetic",
  recordedAtUtc: new Date().toISOString(),
  sourceSha: sha,
  keyPresence: true,
  model: "gpt-6-luna",
  budget,
  batchRequests: 1,
  automaticRetries: 0,
  measurements,
  usage: results.map((r) => r.aiUsage ?? null),
  structuredSuccesses: measurements.filter((m) => m.structured).length,
  classificationSuccesses: measurements.filter((m) => m.classificationVerified)
    .length,
  success,
  allExpectedGrounded,
  triangularComparison: "not_performed",
  limitations: [
    "Three synthetic documents only; not real customs certificates or all business layouts",
    "No repeat/missing/mismatch paid validation and no automatic retries",
    "Cost is usage-based estimate, not billing invoice",
  ],
};
await writeFile(dir + "/report.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
process.exitCode = success && allExpectedGrounded ? 0 : 1;
