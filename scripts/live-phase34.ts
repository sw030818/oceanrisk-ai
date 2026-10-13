// Explicit PHASE 3.4 $0.15 authorization required. Raw results are LOCAL PRIVATE
// replay data; only counts/usage/codes/SHAs may be committed as evidence.
import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { paid34 } from "./lib/phase34-live";
import { extractPdfText } from "../src/modules/pdf/extract";
import { emptyShippingWire } from "../src/modules/shipping/ground";
import { reviewShipping } from "../src/modules/shipping/review";
import { shippingValues } from "../src/modules/shipping/fields";
import { shippingTypes } from "../src/modules/shipping/catalog";
import { shipping34Fixture } from "../tests/fixtures/shipping34";
const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
if (arg("approved-max-cost-usd") !== "0.15")
  throw Error("PHASE34 explicit dollar approval required");
const sha = arg("sha") ?? "",
  stage = arg("stage") ?? "";
if (
  !/^[a-f0-9]{40}$/.test(sha) ||
  !["original", "negative", "negative-hbl"].includes(stage)
)
  throw Error("Exact SHA and known stage required");
const dir = "test-results/live-phase34/private";
await mkdir(dir, { recursive: true, mode: 0o700 });
await chmod(dir, 0o700);
const fixtures = [];
if (stage === "original") {
  const input = arg("input-dir");
  if (!input) throw Error("Private attachment input directory required");
  const files = [
    "01_house_bl.pdf",
    "02_export_declaration.pdf",
    "03_house_manifest.pdf",
  ];
  for (const [i, type] of shippingTypes.entries()) {
    const bytes = await readFile(join(resolve(input), files[i]));
    const pdf = {
      id: "phase34-user-" + i,
      fileName: files[i],
      pages: await extractPdfText(
        new Uint8Array(bytes),
        undefined,
        false,
        true,
      ),
    };
    fixtures.push({ id: pdf.id, pdf, bytes, wire: emptyShippingWire(type) });
  }
} else {
  fixtures.push(await shipping34Fixture("house_bl"));
  fixtures.push(
    await shipping34Fixture(
      "house_manifest",
      stage === "negative"
        ? { packages: 54, weight: 610, seal: "OTHER-SEAL" }
        : { hbl: "OTHER-HBL", packages: 54 },
    ),
  );
}
const result = await paid34(sha, stage, fixtures);
const outputBase = `${stage}-${sha.slice(0, 7)}-d${result.budget.documents}`;
await writeFile(join(dir, outputBase + ".json"), JSON.stringify({...result,results:result.results.map(r=>({...r,pdf:{...r.pdf,pages:[]}}))}), {
  mode: 0o600,
});
const docs = result.results.flatMap((r) => (r.document ? [r.document] : [])),
  review = reviewShipping(docs);
const metrics = {
  stage,
  sourceSha: sha,
  inputHashes: fixtures.map((f) =>
    createHash("sha256").update(f.bytes).digest("hex"),
  ),
  budget: result.budget,
  classification: docs.filter((d) => d.classificationStatus === "classified")
    .length,
  documents: docs.length,
  verified: docs.reduce(
    (n, d) =>
      n +
      shippingValues(d).filter((f) => f.original.status === "verified").length,
    0,
  ),
  candidates: docs.reduce(
    (n, d) =>
      n + shippingValues(d).filter((f) => f.original.value !== null).length,
    0,
  ),
  verificationCodes: docs.map((d) =>
    shippingValues(d)
      .filter((f) => f.original.value !== null)
      .reduce(
        (a, f) => {
          const k = f.original.verificationCode ?? "unspecified";
          a[k] = (a[k] ?? 0) + 1;
          return a;
        },
        {} as Record<string, number>,
      ),
  ),
  review: review.summary,
  triangle: review.triangleStatus,
  checks: review.checks.map((c) => ({
    category: c.category,
    assessment: c.assessment,
  })),
  batchRequests: result.batchRequests,
  batchDurationsMs: result.batchDurationsMs,
  usage: result.results.map((r) => r.aiUsage),
  errors: result.results.map((r) => r.error?.code ?? null),
  automaticRetries: 0,
};
await writeFile(
  `test-results/live-phase34/${outputBase}-metrics.json`,
  JSON.stringify(metrics, null, 2),
);
console.log(JSON.stringify(metrics, null, 2));
if (result.results.some((r) => r.error) || docs.length !== fixtures.length)
  process.exitCode = 1;
