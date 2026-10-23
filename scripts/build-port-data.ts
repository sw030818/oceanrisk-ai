// Regenerates the bundled port gazetteer and country-name table.
// Usage: npx tsx scripts/build-port-data.ts <path-to-un-locode-code-list.csv>
// The CSV must be the pinned datasets/un-locode file already cited in
// ports-data.json (supplementalSource.sha256). Any other bytes are refused.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import ports from "../src/modules/shipping/ports-data.json" with { type: "json" };

const path = process.argv[2];
if (!path) throw Error("Pass the pinned UN/LOCODE code-list.csv path");
const bytes = readFileSync(path);
const sha256 = createHash("sha256").update(bytes).digest("hex");
if (sha256 !== ports.supplementalSource.sha256)
  throw Error("UN/LOCODE bytes differ from the pinned source; refusing to regenerate");

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const [header, ...body] = parseCsv(bytes.toString("utf8"));
const col = (name: string) => {
  const i = header.indexOf(name);
  if (i < 0) throw Error("Missing column " + name);
  return i;
};
const [C, L, N, W, S, F, X] = ["Country", "Location", "Name", "NameWoDiacritics", "Status", "Function", "Change"].map(col);
// Port function (position 1 = "1") only. Entries flagged for removal (X) or
// rejected/withdrawn statuses are not identities a document can rely on.
const excludedStatus = new Set(["RR", "XX"]);
// A LOCODE can appear twice when UN/LOCODE records a name change (# or |):
// both printed names identify the same location, so they are merged. The
// status of the changed (newer) row wins.
const byCode = new Map<string, { status: string; changed: boolean; names: string[] }>();
for (const r of body) {
  if (!r[L] || r[F]?.[0] !== "1" || r[X] === "X" || excludedStatus.has(r[S])) continue;
  const code = r[C] + r[L], changed = r[X] === "#" || r[X] === "|";
  const entry = byCode.get(code) ?? { status: r[S], changed, names: [] };
  if (changed && !entry.changed) Object.assign(entry, { status: r[S], changed });
  for (const n of [r[N], r[W]]) if (n && !entry.names.includes(n)) entry.names.push(n);
  byCode.set(code, entry);
}
const rows = [...byCode.entries()]
  .map(([code, e]) => [code, e.status, ...e.names].join("|"))
  .sort();

writeFileSync(
  new URL("../src/modules/shipping/ports-gazetteer.json", import.meta.url),
  JSON.stringify({
    source: ports.supplementalSource.source,
    sha256,
    version: ports.supplementalSource.version,
    license: ports.supplementalSource.license,
    attribution: ports.supplementalSource.attribution,
    filter: "Function position 1 = port; Change != X; Status not RR/XX; name-change rows merged. Row = LOCODE|Status|printed names (Name, NameWoDiacritics, earlier names).",
    rows: rows.join("\n"),
  }) + "\n",
);

// Country names: CLDR via the runtime ICU, frozen into the repository so the
// browser and server always use the same table. Names containing the
// qualifier separators ( ) / are omitted; manual names in ports.ts remain.
const en = new Intl.DisplayNames(["en"], { type: "region" }),
  ko = new Intl.DisplayNames(["ko"], { type: "region" });
const names: Record<string, string[]> = {};
for (const code of ports.countries) {
  const list = [en.of(code), ko.of(code)].filter(
    (n): n is string => !!n && n !== code && !/[()/]/.test(n) && !/unknown|알려지지/i.test(n),
  );
  if (list.length) names[code] = [...new Set(list)];
}
writeFileSync(
  new URL("../src/modules/shipping/country-names.json", import.meta.url),
  JSON.stringify({
    source: "Unicode CLDR region display names (en, ko) via Node.js Intl",
    cldr: process.versions.cldr,
    icu: process.versions.icu,
    license: "Unicode License v3 (https://www.unicode.org/license.txt)",
    names,
  }, null, 1) + "\n",
);
console.log(JSON.stringify({ ports: rows.length, countries: Object.keys(names).length, sha256, cldr: process.versions.cldr }));
