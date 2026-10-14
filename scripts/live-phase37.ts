// Explicit paid runner: only generated synthetic documents; never reads old PDFs.
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { createHash } from "node:crypto";
import { recoverNative, recoveryStage } from "../src/modules/shipping/recovery";
import { paid37 } from "./lib/phase37-live";
import {
  development37,
  type Scenario37,
} from "../tests/fixtures/phase37/development";
import { scenario37 } from "../tests/fixtures/phase37/cases";
import { measure37, summarize37, goldCoverage37 } from "./lib/phase37-metrics";
const arg = (k: string) =>
  process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
if (
  arg("approved-max-cost-usd") !== "0.50" ||
  arg("approved-documents") !== "120" ||
  arg("approved-requests") !== "150"
)
  throw Error("PHASE37 approval caps required");
const sha = arg("sha") ?? "",
  ids = (arg("cases") ?? "").split(","),
  holdout = arg("partition") === "holdout";
if (!/^[a-f0-9]{40}$/.test(sha) || !ids.length)
  throw Error("Exact SHA and case IDs required");
if (
  spawnSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).stdout.trim() !== sha ||
  spawnSync("git", ["diff", "--quiet"]).status !== 0 ||
  spawnSync("git", ["diff", "--cached", "--quiet"]).status !== 0
)
  throw Error(
    "Live evaluation requires clean local source at the exact Production SHA",
  );
const candidates: Scenario37[] = holdout
  ? JSON.parse(
      await readFile("test-results/phase37/holdout-frozen.json", "utf8"),
    ).scenarios
  : development37;
const selected = ids.map((id) => {
  const s = candidates.find((s) => s.id === id);
  if (!s) throw Error("Unknown case");
  return s;
});
const dir = "test-results/live-phase37/private";
await mkdir(dir, { recursive: true, mode: 0o700 });
await chmod(dir, 0o700);
for (const s of selected) {
  const { fixtures } = await scenario37(s),
    start = performance.now();
  const trial = await paid37(sha, s.id, fixtures);
  const docs = trial.results.flatMap((r) => (r.document ? [r.document] : []));
  const metrics = measure37(s, docs);
  const row = {
    ...metrics,
    gold: goldCoverage37(
      fixtures.map((f) => recoverNative(f.goldDocument, f.pdf)),
      docs,
    ),
    goldInitial: goldCoverage37(
      fixtures.map((f) => recoverNative(f.goldDocument, f.pdf)),
      docs.map((d) =>
        recoveryStage(
          d,
          fixtures.find((f) => f.pdf.id === d.id)!.pdf,
          "initial",
        ),
      ),
    ),
    recovery: docs.map((d) => d.recoverySummary ?? null),
    usage: trial.results.map((r) => ({
      usage: r.aiUsage ?? null,
      recoveryUsage: r.recoveryUsage ?? null,
      errorCode: r.error?.code ?? null,
    })),
    batchDurationsMs: trial.batchDurationsMs,
    sourceSha: sha,
    partition: s.partition,
    durationMs: Math.round(performance.now() - start),
    inputHashes: fixtures.map((f) =>
      createHash("sha256").update(f.bytes).digest("hex"),
    ),
    responseDocuments: docs.length,
    failedDocuments: trial.results
      .filter((r) => r.error)
      .map((r) => ({ id: r.pdf.id, code: r.error?.code })),
    budget: trial.budget,
  };
  const stamp = Date.now();
  await writeFile(
    `${dir}/${s.id}-${stamp}.json`,
    JSON.stringify({ scenario: s, results: trial.results }, null, 2),
    { mode: 0o600 },
  );
  await writeFile(
    `test-results/live-phase37/${s.id}-${stamp}.json`,
    JSON.stringify(row, null, 2),
  );
  console.log(
    JSON.stringify({
      case: s.id,
      metrics: row,
      totals: summarize37([metrics]),
    }),
  );
  if (docs.length !== fixtures.length)
    throw Error(
      "Partial/failed live extraction; inspect before manual next request",
    );
}
