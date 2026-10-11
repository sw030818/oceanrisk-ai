// Explicit opt-in live test: eight provider requests at most, synthetic PDFs only.
import type { AnalysisResult } from "../src/modules/documents/schema";
import { extractWithGemini } from "../src/modules/ai/gemini";
import nextEnv from "@next/env";
import { mkdir, writeFile } from "node:fs/promises";
import { phase15Scenario } from "../tests/fixtures/phase15";
import { analyzeFile } from "../src/modules/analysis/pipeline";
import { compareQuantities } from "../src/modules/rules/quantity";
import { normalizeText } from "../src/modules/evidence/verify";
nextEnv.loadEnvConfig(process.cwd());
const remoteArg = process.argv.slice(2).find((arg) => arg.startsWith("--url="));
const remote = remoteArg ? new URL(remoteArg.slice(6)) : null;
if (remote && remote.origin !== "https://oceanrisk-ai.vercel.app")
  throw new Error("Remote live tests only target the authorized OceanRisk Production domain");
let configured = Boolean(process.env.GEMINI_API_KEY);
let statusError: string | null = null;
let statusChecked = false;
if (remote) {
  try {
    const status = await fetch(new URL("/api/status", remote), { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!status.ok) throw new Error("Production unavailable");
    const data = await status.json();
    statusChecked = true;
    configured = data.aiConfigured === true;
    if (data.accessRequired) { configured = false; statusError = "PRODUCTION_STILL_ACCESS_GATED"; }
  } catch {
    configured = false;
    statusError = "PRODUCTION_STATUS_UNAVAILABLE";
  }
}
const outputDir = remote ? "test-results/live-gemini-production" : "test-results/live-gemini";
const selected = process.env.LIVE_GEMINI_CASE ?? "all";
if (!["all", "A", "B", "C", "D"].includes(selected)) throw new Error("LIVE_GEMINI_CASE must be all or A-D");
const report: {
  mode: string;
  keyConfigured: boolean | null;
  completed: boolean;
  requestsAttempted: number;
  serverRequestsAttempted: number;
  productionStatusChecked: boolean;
  statusError: string | null;
  scope: string;
  selectedCasesPassed: boolean;
  cases: unknown[];
} = {
  mode: remote ? "production-live-gemini-synthetic-pdf" : "live-gemini-synthetic-pdf",
  keyConfigured: remote && !statusChecked ? null : configured,
  completed: false,
  requestsAttempted: 0,
  serverRequestsAttempted: 0,
  productionStatusChecked: statusChecked,
  statusError,
  scope: selected,
  selectedCasesPassed: false,
  cases: [],
};
await mkdir(outputDir, { recursive: true });
let providerQuotaStopped = false;
for (const id of ["A", "B", "C", "D"] as const) {
  if (selected !== "all" && id !== selected) continue;
  const scenario = phase15Scenario(id);
  const files = await Promise.all(
    scenario.documents.map((doc) => doc.makeFile()),
  );
  for (const file of files)
    await writeFile(
      `${outputDir}/${file.name}`,
      new Uint8Array(await file.arrayBuffer()),
    );
  if (!configured || providerQuotaStopped) {
    report.cases.push({
      id,
      status: "not_run",
      reason: providerQuotaStopped ? "PROVIDER_QUOTA_STOP" : statusError ?? "GEMINI_API_KEY missing; no provider call was made",
    });
    continue;
  }
  console.log(
    `Case ${id}: requesting actual Gemini analysis of two synthetic PDFs`,
  );
  const results: AnalysisResult[] = [];
  if (remote) {
    try {
      const form = new FormData();
      for (const file of files) form.append("files", file);
      report.serverRequestsAttempted++;
      const response = await fetch(new URL("/api/analyze", remote), { method: "POST", body: form, signal: AbortSignal.timeout(110000) });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload?.results) || payload.results.length !== 2) {
        const code = payload?.error?.code;
        report.cases.push({ id, status: "failed", httpStatus: response.status, errorCodes: [typeof code === "string" && /^[A-Z0-9_]{1,60}$/.test(code) ? code : "INVALID_SERVER_RESPONSE"] });
        continue;
      }
      results.push(...payload.results as AnalysisResult[]);
    } catch {
      report.cases.push({ id, status: "failed", reason: "PRODUCTION_ANALYSIS_UNAVAILABLE" });
      continue;
    }
  } else for (const file of files)
    results.push(
      await analyzeFile(file, {
        ai: (pdf) =>
          extractWithGemini(pdf, {
            fetcher: (input, init) => {
              report.requestsAttempted++;
              return fetch(input, init);
            },
          }),
      }),
    );
  try {
  if (results.some(result => result.error?.code === "API_RATE_LIMIT")) providerQuotaStopped = true;
  const documents = results.flatMap((result) =>
    result.document ? [result.document] : [],
  );
  const checks = compareQuantities(documents);
  const criteria = {
    providerResponses: results.every(
      (result) => result.document !== null && result.error === null,
    ),
    types:
      documents.length === 2 &&
      documents[0].type === "invoice" &&
      documents[1].type === "packing_list",
    productValues:
      documents.length === 2 &&
      documents.every(
        (doc, i) =>
          doc.items.length === 1 &&
          doc.items[0].quantity.value ===
            scenario.documents[i].data.items[0].quantity.value &&
          normalizeText(doc.items[0].description.value ?? "") ===
            "steel bolts" &&
          ["pcs", "ea", "pieces", "piece"].includes(
            normalizeText(doc.items[0].unit.value ?? ""),
          ),
      ),
    quantityEvidence:
      documents.length === 2 &&
      documents.every(
        (doc) =>
          doc.items[0]?.quantity.status === "verified" &&
          doc.items[0]?.unit.status === "verified" &&
          doc.items[0]?.description.status === "verified",
      ),
    sourcePages:
      documents.length === 2 &&
      documents.every((doc) => {
        const pdf = results.find((result) => result.pdf.id === doc.id)!.pdf;
        return doc.items.every((item) =>
          [item.description, item.quantity, item.unit].every(
            (field) =>
              field.source &&
              pdf.pages.some(
                (page) =>
                  page.page === field.source!.page &&
                  normalizeText(page.text).includes(
                    normalizeText(field.source!.quote),
                  ),
              ),
          ),
        );
      }),
    ruleOutcome:
      checks.length === 1 &&
      checks[0].status === scenario.expectedStatus &&
      (id !== "D" || checks[0].confidence !== "confirmed"),
  };
  const passed = Object.values(criteria).every(Boolean);
  report.cases.push({
    id,
    status: passed ? "passed" : "failed",
    criteria,
    errorCodes: results.map((result) => result.error?.code ?? null),
    modelsUsed: results.map((result) => result.aiModel ?? null),
    providerDiagnostics: results.map((result) => result.error?.diagnostics ?? null),
    ruleStatus: checks.map((check) => ({
      status: check.status,
      confidence: check.confidence,
    })),
    groundingStatuses: documents.map((doc) => ({ seller: doc.seller.status, buyer: doc.buyer.status, transactionReference: doc.transactionReference.status, partialShipment: doc.partialShipment.status })),
    ruleReasons: checks.map((check) => check.explanation),
  });
  console.log(
    `Case ${id}: ${passed ? "PASS" : "FAIL"} (no keys or raw document responses logged)`,
  );
  } catch {
    report.cases.push({ id, status: "failed", reason: "INVALID_ANALYSIS_RESULT" });
  }
}
report.selectedCasesPassed =
  configured &&
  report.cases.every(
    (entry) => (entry as { status: string }).status === "passed",
  );
report.completed = selected === "all" && report.selectedCasesPassed && report.cases.length === 4;
await writeFile(
  `${outputDir}/report.json`,
  JSON.stringify(report, null, 2),
);
console.log(
  configured
    ? `Live validation scope=${selected} ${report.selectedCasesPassed ? "passed" : "failed"}; full A-D completed=${report.completed}; report contains metadata only`
    : `${statusError ?? "GEMINI_API_KEY unset"}. A-D PDFs generated; actual API tests NOT RUN.`,
);
process.exitCode = report.selectedCasesPassed ? 0 : statusError || configured ? 1 : 2;
