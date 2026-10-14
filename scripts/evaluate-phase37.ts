import { writeFile, mkdir } from "node:fs/promises";
import { development37 } from "../tests/fixtures/phase37/development";
import { scenario37 } from "../tests/fixtures/phase37/cases";
import { recoverNative } from "../src/modules/shipping/recovery";
import { measure37, summarize37, goldCoverage37 } from "./lib/phase37-metrics";
const rows = [];
for (const s of development37) {
  const { fixtures } = await scenario37(s);
  const docs = fixtures.map((f) => recoverNative(f.document, f.pdf));
  rows.push({
    ...measure37(s, docs),
    gold: goldCoverage37(
      fixtures.map((f) => f.goldDocument),
      docs,
    ),
  });
}
await mkdir("test-results/phase37", { recursive: true });
const report = {
  kind: "synthetic oracle candidates + actual native PDF verification; NO OpenAI calls",
  summary: summarize37(rows),
  rows,
};
await writeFile(
  "test-results/phase37/free-evaluation.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report.summary, null, 2));
