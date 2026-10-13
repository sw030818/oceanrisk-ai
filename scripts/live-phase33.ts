import { writeFile, readFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { PDFDocument, degrees } from "pdf-lib";
import { evaluation33, fixture33, truth33 } from "../tests/fixtures/shipping33";
import { shipping32Fixture } from "../tests/fixtures/shipping32";
import { paid33, directory33 } from "./lib/phase33-live";
import { replayProduction33 } from "./lib/phase33-browser";
import { measure32 } from "./lib/phase32-live";
import { reviewShipping } from "../src/modules/shipping/review";
const arg = (k: string) =>
  process.argv.find((a) => a.startsWith("--" + k + "="))?.slice(k.length + 3);
if (
  arg("approved-documents") !== "24" ||
  arg("approved-requests") !== "30" ||
  arg("approved-max-cost-usd") !== "0.10"
)
  throw new Error(
    "Explicit PHASE3.3 authorization is 24 documents / 30 requests / $0.10; no prior budget reuse",
  );
const stage = arg("stage") ?? "normal",
  sha = arg("sha") ?? "";
if (
  ![
    "baseline",
    "normal",
    "mismatch",
    "complex",
    "uncertain",
    "ocr",
    "holdout",
  ].includes(stage)
)
  throw new Error("Invalid evaluation stage");
const fixtures =
  stage === "baseline"
    ? await Promise.all(
        (["house_bl", "export_declaration", "house_manifest"] as const).map(
          (t) => shipping32Fixture(t),
        ),
      )
    : stage === "ocr"
      ? [await fixture33(truth33("house_bl", "ocr-rotated-bl", "portrait"))]
      : await Promise.all(evaluation33(stage).map(fixture33));
if (stage === "ocr") {
  await mkdir(directory33, { recursive: true });
  const path = directory33 + "/synthetic-scan-native.pdf";
  await writeFile(path, fixtures[0].bytes);
  const render = spawnSync(
    "pdftoppm",
    [
      "-f",
      "1",
      "-singlefile",
      "-r",
      "120",
      "-png",
      path,
      directory33 + "/synthetic-scan",
    ],
    { encoding: "utf8" },
  );
  if (render.status !== 0)
    throw new Error("Synthetic scan rendering failed; no paid request");
  const p = await PDFDocument.create(),
    image = await p.embedPng(
      await readFile(directory33 + "/synthetic-scan.png"),
    ),
    page = p.addPage([595, 842]);
  page.drawImage(image, { x: 0, y: 0, width: 595, height: 842 });
  page.setRotation(degrees(90));
  fixtures[0].bytes = await p.save();
  // One-page synthetic scan is below the bounded vision reservation. Native
  // ground truth is retained separately and is never passed to the provider.
}
const live = await paid33(sha, stage, fixtures, stage === "ocr");
const actual = reviewShipping(
  live.results.flatMap((r) => (r.document ? [r.document] : [])),
);
const ids = fixtures.map((f) => f.pdf.id),
  pair = (a: string, b: string) => [a, b].sort().join("|");
const expected =
  stage === "uncertain" || stage === "ocr"
    ? []
    : stage === "complex"
      ? [
          pair("complex-bl-a", "complex-declaration-0"),
          pair("complex-bl-a", "complex-declaration-1"),
          pair("complex-bl-b", "complex-declaration-2"),
          pair("complex-bl-a", "complex-manifest"),
          pair("complex-bl-b", "complex-manifest"),
          pair("complex-declaration-0", "complex-manifest"),
          pair("complex-declaration-1", "complex-manifest"),
          pair("complex-declaration-2", "complex-manifest"),
        ]
      : ids.flatMap((a, i) => ids.slice(i + 1).map((b) => pair(a, b)));
const observed =
  actual.relationships
    ?.filter((r) => r.status === "evidence_confirmed")
    .map((r) => pair(r.documentIds[0], r.documentIds[1])) ?? [];
const tp = observed.filter((v) => expected.includes(v)).length,
  fp = observed.filter((v) => !expected.includes(v)).length,
  fn = expected.filter((v) => !observed.includes(v)).length;
const warnings = actual.checks.filter(
  (c) => c.assessment === "confirmed_mismatch",
);
const targets =
  stage === "mismatch"
    ? ["문서 전체 포장 개수", "문서 전체 총중량", "컨테이너 ABCD1234567 Seal"]
    : [];
const detected = targets.filter((t) => warnings.some((c) => c.title === t)),
  falseWarnings = warnings.filter((c) => !targets.includes(c.title ?? ""));
const measurements = fixtures.map((f) => {
  const r = live.results.find((r) => r.pdf.id === f.pdf.id),
    m = measure32(f, r);
  for (const extra of f.document.additionalFields) {
    if (extra.field.original.value === null) continue;
    const a =
      r?.document?.additionalFields.find((a) => a.meaning === extra.meaning)
        ?.field ?? r?.document?.fields[extra.meaning];
    m.expected++;
    const correct = a?.original.value === extra.field.original.value;
    if (correct) m.correct++;
    if (correct && a?.original.status === "verified") m.groundedCorrect++;
    if (!correct || a?.original.status !== "verified")
      m.issues.push({
        path: "additional." + extra.meaning,
        correct,
        status: a?.original.status ?? null,
        code: a?.original.verificationCode ?? null,
      });
  }
  return m;
});
const browser = await replayProduction33(
  fixtures,
  { results: live.results },
  stage,
);
const report = {
  browser,
  mode: "phase33-actual-production-openai",
  stage,
  partition:
    stage === "holdout"
      ? "holdout"
      : stage === "baseline"
        ? "previous-layout-baseline"
        : "tuning",
  sourceSha: sha,
  sourceShaStable: live.sourceShaStable,
  recordedAtUtc: new Date().toISOString(),
  budget: live.budget,
  batchRequests: live.batchRequests,
  batchDurationsMs: live.batchDurationsMs,
  automaticRetries: 0,
  measurements,
  usage: live.results.map((r) => ({
    extraction: r.aiUsage ?? null,
    ocr: r.ocrUsage ?? null,
  })),
  classificationCandidatesCorrect: live.results.filter(
    (r, i) => r.detectedType === fixtures[i]?.wire.type,
  ).length,
  relation: {
    tp,
    fp,
    fn,
    expected: expected.length,
    predicted: observed.length,
    precision: observed.length ? tp / observed.length : null,
    recall: expected.length ? tp / expected.length : null,
  },
  mismatch: {
    tp: detected.length,
    fp: falseWarnings.length,
    fn: targets.length - detected.length,
    expected: targets.length,
    predicted: warnings.length,
    precision: warnings.length ? detected.length / warnings.length : null,
    recall: targets.length ? detected.length / targets.length : null,
  },
  comparison: actual.summary,
  triangleStatus: actual.triangleStatus,
  coverage: live.results.map((r) => ({
    id: r.pdf.id,
    coverage: r.document?.collectionCoverage ?? null,
    ocrPages: r.ocrPages ?? [],
    ocrError: r.ocrError?.code ?? null,
  })),
  rawResponsesArchived: false,
  realBusinessDocumentsUsed: false,
  passed:
    browser.passed &&
    live.results.length === fixtures.length &&
    measurements.every((m) => m.structured) &&
    fp === 0 &&
    fn === 0 &&
    falseWarnings.length === 0 &&
    detected.length === targets.length &&
    (stage !== "ocr" ||
      live.results.every(
        (r) =>
          r.pdf.pages.some((p) => p.textSource === "ocr") &&
          r.document?.extractionStatus === "partial",
      )),
};
await writeFile(
  directory33 +
    "/" +
    stage +
    "-" +
    sha.slice(0, 7) +
    "-d" +
    live.budget.documents +
    ".json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
process.exitCode = report.passed ? 0 : 1;
