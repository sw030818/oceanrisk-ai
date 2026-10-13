import { writeFile } from "node:fs/promises";
import {
  shipping32Fixture,
  type Scenario32,
} from "../tests/fixtures/shipping32";
import { paidBatch32, directory32 } from "./lib/phase32-live";
import { replayProduction32 } from "./lib/phase32-browser";
import { reviewShipping } from "../src/modules/shipping/review";
import type { ShippingReview } from "../src/modules/shipping/review-model";
const arg = (k: string) =>
    process.argv.find((a) => a.startsWith("--" + k + "="))?.slice(k.length + 3),
  sha = arg("sha") ?? "",
  stage = arg("stage") ?? "baseline";
if (
  arg("approved-documents") !== "12" ||
  arg("approved-max-cost-usd") !== "0.50"
)
  throw new Error(
    "Current PHASE32 explicit authorization: 12 documents / $0.50 required; not PHASE31 budget",
  );
const types =
  stage === "baseline"
    ? (["house_bl", "export_declaration"] as const)
    : ["mismatch", "uncertain"].includes(stage)
      ? (["house_bl", "house_manifest"] as const)
      : (["house_bl", "export_declaration", "house_manifest"] as const);
const scenario: Scenario32 = ["normal", "mismatch", "uncertain"].includes(stage)
  ? (stage as Scenario32)
  : "normal";
const fixtures = await Promise.all(
  types.map((t) => shipping32Fixture(t, scenario)),
);
const { report, results, body } = await paidBatch32(
  sha,
  stage,
  fixtures,
  stage === "baseline" ? "3.1" : "3.2",
);
if (stage === "baseline") {
  process.exitCode =
    report.sourceShaStable &&
    report.measurements.every((m) => m.structured && m.classificationCorrect)
      ? 0
      : 1;
} else {
  const truth = reviewShipping(fixtures.map((f) => f.document)),
    actual = reviewShipping(
      results.flatMap((r) => (r.document ? [r.document] : [])),
    ),
    server = body?.review as ShippingReview | undefined;
  const signature = (c: ShippingReview["checks"][number]) =>
    c.scope + "|" + c.category + "|" + c.title;
  const expectedWarnings = new Set(
      truth.checks
        .filter((c) => c.assessment === "confirmed_mismatch")
        .map(signature),
    ),
    actualWarnings = new Set(
      actual.checks
        .filter((c) => c.assessment === "confirmed_mismatch")
        .map(signature),
    );
  const falseWarnings = [...actualWarnings].filter(
      (k) => !expectedWarnings.has(k),
    ),
    detected = [...expectedWarnings].filter((k) => actualWarnings.has(k));
  const expectedRelations =
      truth.relationships?.filter((r) => r.status === "evidence_confirmed")
        .length ?? 0,
    actualRelations =
      actual.relationships?.filter((r) => r.status === "evidence_confirmed")
        .length ?? 0;
  const browser = body
    ? await replayProduction32(fixtures, body, stage)
    : {
        passed: false,
        reason: "NO_STRUCTURED_RESPONSE",
        additionalPaidCalls: 0,
        responseReplay: false,
      };
  const integrated = {
    ...report,
    mode: "actual-openai-phase32-end-to-end",
    evaluation: {
      structuredSuccesses: report.measurements.filter((m) => m.structured)
        .length,
      classificationCorrect: report.measurements.filter(
        (m) => m.classificationCorrect,
      ).length,
      expectedFields: report.measurements.reduce((s, m) => s + m.expected, 0),
      correctFields: report.measurements.reduce((s, m) => s + m.correct, 0),
      groundedCorrectFields: report.measurements.reduce(
        (s, m) => s + m.groundedCorrect,
        0,
      ),
      expectedConfirmedRelationships: expectedRelations,
      actualConfirmedRelationships: actualRelations,
      relationshipFalsePositives: Math.max(
        0,
        actualRelations - expectedRelations,
      ),
      expectedWarningPatterns: expectedWarnings.size,
      detectedWarningPatterns: detected.length,
      falseConfirmedWarningPatterns: falseWarnings.length,
      serverClientSummarySame:
        JSON.stringify(server?.summary) === JSON.stringify(actual.summary),
      comparisonSummary: actual.summary,
      pairStatus: actual.pairStatus,
      triangleStatus: actual.triangleStatus,
    },
    browser,
    passed:
      report.sourceShaStable &&
      report.measurements.every(
        (m) => m.structured && m.classificationCorrect,
      ) &&
      falseWarnings.length === 0 &&
      detected.length === expectedWarnings.size &&
      actualRelations === expectedRelations &&
      JSON.stringify(server?.summary) === JSON.stringify(actual.summary) &&
      browser.passed,
  };
  await writeFile(
    directory32 + "/" + stage + "-" + sha.slice(0, 7) + "-integrated.json",
    JSON.stringify(integrated, null, 2) + "\n",
  );
  console.log(JSON.stringify(integrated));
  process.exitCode = integrated.passed ? 0 : 1;
}
