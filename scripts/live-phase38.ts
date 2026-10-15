// Private input manifest, no answers sent to OpenAI; no retries or extra recovery.
import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { z } from "zod";
import { extractPdfText } from "../src/modules/pdf/extract";
import { emptyShippingWire } from "../src/modules/shipping/ground";
import { shippingTypes } from "../src/modules/shipping/catalog";
import { reviewShipping } from "../src/modules/shipping/review";
import { shippingValues } from "../src/modules/shipping/fields";
import type { ShippingResult } from "../src/modules/shipping/prepare";
import { paid38 } from "./lib/phase38-live";
const arg = (key: string) =>
  process.argv.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const sha = arg("sha") ?? "",
  stage = arg("stage"),
  input = arg("input-manifest");
if (
  arg("approved-documents") !== "8" ||
  arg("approved-requests") !== "8" ||
  arg("approved-max-cost-usd") !== "0.10"
)
  throw Error("Separate PHASE38 user approval required; flags are not consent");
if (
  !/^[a-f0-9]{40}$/.test(sha) ||
  !["normal", "errors"].includes(stage ?? "") ||
  !input
)
  throw Error("Exact SHA, stage and private manifest required");
const git = (...args: string[]) => spawnSync("git", args, { encoding: "utf8" });
if (
  git("rev-parse", "HEAD").stdout.trim() !== sha ||
  git("diff", "--quiet").status !== 0 ||
  git("diff", "--cached", "--quiet").status !== 0
)
  throw Error("Clean exact Production SHA required");
const status = await (
  await fetch("https://oceanrisk-ai.vercel.app/api/status", {
    signal: AbortSignal.timeout(15000),
  })
).json();
if (status.capabilities?.automaticTargetedRecovery !== false)
  throw Error(
    "Extra recovery must be disabled before reserving an eight-request trial",
  );
const entry = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  path: z.string(),
  type: z.enum(shippingTypes),
  meaning: z.string().optional(),
});
const manifest = z
  .object({
    normal: z.array(entry).length(3),
    errors: z.array(entry).length(5),
  })
  .parse(JSON.parse(await readFile(input, "utf8")));
const dir = "test-results/live-phase38";
await mkdir(dir + "/private", { recursive: true, mode: 0o700 });
await chmod(dir + "/private", 0o700);
function summarize(results: ShippingResult[]) {
  const docs = results.flatMap((r) => (r.document ? [r.document] : [])),
    review = reviewShipping(docs);
  return {
    documents: docs.length,
    classified: docs.filter((d) => d.classificationStatus === "classified")
      .length,
    outcomes: review.outcomes,
    issues: review.issues?.length,
    rawChecks: review.checks.length,
    core: review.primaryChecks
      ?.filter((c) => c.comparison?.scope === "hbl_record")
      .map((c) => ({
        meaning: c.comparison!.meaning,
        status: c.assessment,
        reasons: c.comparison!.reasonCodes,
      })),
    fields: docs.map((d) => ({
      id: d.id,
      initialPresent: shippingValues(d).filter((f) => f.original.value !== null)
        .length,
      initialVerified: shippingValues(d).filter(
        (f) => f.original.value !== null && f.original.status === "verified",
      ).length,
      currentVerified: shippingValues(d).filter(
        (f) => f.current.value !== null && f.current.status === "verified",
      ).length,
      recovery: d.recoverySummary,
    })),
    errors: results
      .filter((r) => r.error)
      .map((r) => ({ id: r.pdf.id, code: r.error?.code })),
  };
}
async function call(entries: z.infer<typeof entry>[], name: string) {
  const fs = [];
  for (const e of entries) {
    const bytes = new Uint8Array(await readFile(e.path));
    fs.push({
      bytes,
      pdf: {
        id: e.id,
        fileName: e.id + ".pdf",
        pages: await extractPdfText(bytes, undefined, false, true),
      },
      wire: emptyShippingWire(e.type),
    });
  }
  const trial = await paid38(sha, name, fs);
  await writeFile(
    `${dir}/private/${name}-${sha}.json`,
    JSON.stringify({ results: trial.results }),
    { mode: 0o600 },
  );
  const report = {
    sourceSha: sha,
    kind: "New actual OpenAI extraction + native verification; private user-provided test PDFs",
    stage: name,
    inputHashes: fs.map((f) =>
      createHash("sha256").update(f.bytes).digest("hex"),
    ),
    summary: summarize(trial.results),
    budget: trial.budget,
    usage: trial.results.map((r) => ({
      id: r.pdf.id,
      usage: r.aiUsage,
      errorCode: r.error?.code ?? null,
    })),
    durationMs: trial.batchDurationsMs,
  };
  await writeFile(
    `${dir}/${name}-${sha}.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
  if (trial.results.length !== fs.length || trial.results.some((r) => r.error))
    throw Error("Partial extraction; stop and inspect before any next request");
  return trial.results;
}
if (stage === "normal") {
  const r = await call(manifest.normal, "set2-normal");
  const s = summarize(r);
  if (s.classified !== 3 || s.outcomes?.mismatches)
    throw Error("Normal verification failed; stop before errors");
} else {
  const base = (
    JSON.parse(
      await readFile(`${dir}/private/set2-normal-${sha}.json`, "utf8"),
    ) as { results: ShippingResult[] }
  ).results;
  for (const e of manifest.errors) {
    const changed = await call([e], "set2-error-" + e.id);
    const merged = [...base.filter((r) => r.uploadSlot !== e.type), ...changed];
    const review = reviewShipping(
      merged.flatMap((r) => (r.document ? [r.document] : [])),
    );
    const checks = (review.primaryChecks ?? review.checks).filter(
      (c) =>
        c.comparison?.meaning === e.meaning ||
        c.fields.some((f) => f.fieldName === e.meaning),
    );
    const confirmed = checks.some((c) => c.assessment === "confirmed_mismatch"),
      flagged = checks.some((c) =>
        ["confirmed_mismatch", "provisional_mismatch", "needs_review"].includes(
          c.assessment,
        ),
      );
    const report = {
      sourceSha: sha,
      kind: "Single mutated actual PDF analyzed by OpenAI, compared with two unchanged cached actual responses from the same SHA",
      meaning: e.meaning,
      confirmed,
      flagged,
      summary: summarize(merged),
    };
    await writeFile(
      `${dir}/comparison-${e.id}-${sha}.json`,
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
    if (!flagged)
      throw Error(
        "Expected fault not flagged; stop and diagnose without automatic retry",
      );
  }
}
