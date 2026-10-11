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
const configured = Boolean(process.env.GEMINI_API_KEY);
const report: {
  mode: string;
  keyConfigured: boolean;
  completed: boolean;
  requestsAttempted: number;
  cases: unknown[];
} = {
  mode: "live-gemini-synthetic-pdf",
  keyConfigured: configured,
  completed: false,
  requestsAttempted: 0,
  cases: [],
};
await mkdir("test-results/live-gemini", { recursive: true });
for (const id of ["A", "B", "C", "D"] as const) {
  const scenario = phase15Scenario(id);
  const files = await Promise.all(
    scenario.documents.map((doc) => doc.makeFile()),
  );
  for (const file of files)
    await writeFile(
      `test-results/live-gemini/${file.name}`,
      new Uint8Array(await file.arrayBuffer()),
    );
  if (!configured) {
    report.cases.push({
      id,
      status: "not_run",
      reason: "GEMINI_API_KEY missing; no provider call was made",
    });
    continue;
  }
  console.log(
    `Case ${id}: requesting actual Gemini analysis of two synthetic PDFs`,
  );
  const results: AnalysisResult[] = [];
  for (const file of files)
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
    ruleStatus: checks.map((check) => ({
      status: check.status,
      confidence: check.confidence,
    })),
  });
  console.log(
    `Case ${id}: ${passed ? "PASS" : "FAIL"} (no keys or raw document responses logged)`,
  );
}
report.completed =
  configured &&
  report.cases.every(
    (entry) => (entry as { status: string }).status === "passed",
  );
await writeFile(
  "test-results/live-gemini/report.json",
  JSON.stringify(report, null, 2),
);
console.log(
  configured
    ? `Live validation ${report.completed ? "passed" : "failed"}; report contains metadata only`
    : "GEMINI_API_KEY unset. A-D PDFs generated; actual API tests NOT RUN.",
);
process.exitCode = report.completed ? 0 : configured ? 1 : 2;
