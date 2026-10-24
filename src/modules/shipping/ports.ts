import data from "./ports-data.json" with { type: "json" };
import gazetteer from "./ports-gazetteer.json" with { type: "json" };
import exonyms from "./ports-exonyms.json" with { type: "json" };
import cldr from "./country-names.json" with { type: "json" };

const clean = (s: string) =>
  s.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");
// Hand-maintained names keep precedence over the generated CLDR table.
const manualCountryNames: Record<string, string[]> = {
  KR: ["korea", "south korea", "대한민국"],
  US: ["usa", "united states", "미국"],
  CA: ["canada", "캐나다"],
  NL: ["netherlands", "네덜란드"],
  SG: ["singapore", "싱가포르"],
  DE: ["germany", "독일"],
  GB: ["uk", "united kingdom", "영국"],
  JP: ["japan", "일본"],
  AU: ["australia", "호주"],
  AE: ["uae", "아랍에미리트"],
  BE: ["belgium", "벨기에"],
  FR: ["france", "프랑스"],
  NZ: ["new zealand", "뉴질랜드"],
  HK: ["hong kong", "홍콩"],
  VN: ["vietnam", "베트남"],
};
let countryIndex: Map<string, string> | undefined;
function countries() {
  if (countryIndex) return countryIndex;
  const index = new Map<string, string>(), ambiguous = new Set<string>();
  const add = (name: string, code: string) => {
    const key = clean(name);
    if (ambiguous.has(key)) return;
    const prior = index.get(key);
    if (prior && prior !== code) { index.delete(key); ambiguous.add(key); return; }
    index.set(key, code);
  };
  for (const [code, names] of Object.entries(manualCountryNames)) for (const n of names) add(n, code);
  for (const [code, names] of Object.entries(cldr.names as Record<string, string[]>))
    for (const n of names) if (!manualCountryNames[code]) add(n, code);
  for (const code of data.countries) add(code, code);
  return (countryIndex = index);
}
const countryOf = (part: string) => countries().get(clean(part)) ?? null;
// Country qualification is explicit, consistent text, never a city guess.
export function countryCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parts = clean(value).split(/[()/]/).map(s => s.trim()).filter(Boolean);
  const codes = parts.map(countryOf);
  return codes.length && codes.every(Boolean) && new Set(codes).size === 1 ? codes[0]! : null;
}

// The reviewed reference seaports in ports-data.json keep their earlier
// meaning: a plain name that matches one of them resolves among them only
// (Rotterdam → NLRTM, Vancouver stays CA/US-ambiguous). Every other name is
// ambiguous whenever UN/LOCODE lists more than one port with it; status or
// size is never used to pick one.
const curated = new Set(data.entries.map((e) => e.Country + e.Location));
interface PortIndex { names: Map<string, Set<string>>; status: Map<string, string> }
let portIndex: PortIndex | undefined;
function variants(name: string) {
  const out = new Set<string>([clean(name)]);
  // UN/LOCODE prints official alternates in parentheses ("Mumbai (ex Bombay)",
  // "Port Klang (Pelabuhan Klang)") and subdivisions after a comma.
  const paren = /^(.*?)\s*\((?:ex\s+)?([^()]+)\)$/i.exec(name);
  if (paren) for (const part of [paren[1], paren[2]]) if (part.trim()) out.add(clean(part));
  for (const v of [...out]) {
    const comma = v.indexOf(", ");
    if (comma > 0) out.add(v.slice(0, comma));
  }
  return out;
}
function ports(): PortIndex {
  if (portIndex) return portIndex;
  const names = new Map<string, Set<string>>(), status = new Map<string, string>();
  const add = (key: string, code: string) => {
    const set = names.get(key) ?? new Set<string>();
    set.add(code);
    names.set(key, set);
  };
  for (const row of gazetteer.rows.split("\n")) {
    const [code, state, ...printed] = row.split("|");
    status.set(code, state);
    for (const n of printed) for (const v of variants(n)) add(v, code);
  }
  for (const [alias, code] of exonyms.aliases)
    if (status.has(code)) add(clean(alias), code);
  return (portIndex = { names, status });
}
const isLocode = (s: string) => /^[A-Z]{2}[A-Z2-9]{3}$/.test(s);

export interface PortIdentity {
  /** Every gazetteer location the text can denote (all statuses). */
  all: string[];
  /** Same set, narrowed to reference seaports when the text names any. */
  preferred: string[];
  /** An explicit qualifier contradicted the name/code. */
  conflict: boolean;
  /** Text has the shape of a LOCODE that is not a port in the gazetteer. */
  literal: string | null;
}
const none = (conflict = false, literal: string | null = null): PortIdentity => ({ all: [], preferred: [], conflict, literal });
function lookup(raw: string): Set<string> | null {
  const index = ports();
  const direct = index.names.get(raw);
  if (direct) return direct;
  const code = raw.replace(/\s/g, "").toUpperCase();
  if (isLocode(code) && index.status.has(code)) return new Set([code]);
  if (raw.startsWith("port of ")) return lookup(raw.slice(8));
  return null;
}
function narrow(codes: Set<string>, qualifier: string): Set<string> | "conflict" | null {
  const country = countryOf(qualifier);
  if (country) {
    const kept = [...codes].filter((c) => c.startsWith(country));
    return kept.length ? new Set(kept) : "conflict";
  }
  const other = lookup(qualifier);
  if (!other) return null;
  const kept = [...codes].filter((c) => other.has(c));
  return kept.length ? new Set(kept) : "conflict";
}
function resolve(raw: string): Set<string> | "conflict" | null {
  const direct = lookup(raw);
  if (direct) return direct;
  // "Name (CODE)", "CODE / Name", "Name, Country", "Name Country".
  const shapes = [
    /^(.+?)\s*\(([^()]+)\)$/.exec(raw),
    /^(.+?)\s*\/\s*(.+)$/.exec(raw),
    /^(.+?),\s*(.+)$/.exec(raw),
  ];
  for (const m of shapes) {
    if (!m) continue;
    const left = lookup(m[1].trim()), right = lookup(m[2].trim());
    if (left) { const r = narrow(left, m[2].trim()); if (r) return r; }
    if (right) { const r = narrow(right, m[1].trim()); if (r) return r; }
  }
  const words = raw.split(" ");
  // Korean forms print "KRPUS 부산항": a leading listed code whose trailing
  // local name is unlisted. A trailing name that denotes another port conflicts.
  const lead = words[0].toUpperCase();
  if (words.length > 1 && isLocode(lead) && ports().status.has(lead)) {
    const rest = resolve(words.slice(1).join(" "));
    if (!rest) return new Set([lead]);
    return rest !== "conflict" && rest.has(lead) ? new Set([lead]) : "conflict";
  }
  for (let i = words.length - 1; i > 0; i--) {
    const name = lookup(words.slice(0, i).join(" "));
    if (name && countryOf(words.slice(i).join(" "))) return narrow(name, words.slice(i).join(" "));
  }
  return null;
}
export function portIdentity(value: unknown, verifiedCountry?: string | null): PortIdentity {
  if (typeof value !== "string" || !value.trim()) return none();
  const raw = clean(value), code = raw.replace(/\s/g, "").toUpperCase();
  const found = resolve(raw);
  if (found === "conflict") return none(true);
  if (!found) {
    // A well-formed code outside the port gazetteer is kept literally. It is
    // never given a name or treated as proof that two places differ.
    const literal = value.trim() === value.trim().toUpperCase() && data.countries.includes(code.slice(0, 2)) && isLocode(code)
      ? code : null;
    if (literal && verifiedCountry && literal.slice(0, 2) !== verifiedCountry) return none(true);
    return none(false, literal);
  }
  // An independently verified own-document country can resolve ambiguous
  // names. It cannot rewrite an explicit conflicting name/code.
  const all = [...found].filter((c) => !verifiedCountry || c.startsWith(verifiedCountry));
  if (verifiedCountry && !all.length) return none(true);
  const top = all.filter((c) => curated.has(c));
  return { all: all.sort(), preferred: (top.length ? top : all).sort(), conflict: false, literal: null };
}
export function portMeaning(value: unknown, verifiedCountry?: string | null) {
  const id = portIdentity(value, verifiedCountry);
  if (id.preferred.length === 1)
    return { code: id.preferred[0], source: "unlocode_subset" as const, version: gazetteer.version };
  return id.literal && !id.conflict ? { code: id.literal, source: "literal_code" as const, version: null } : null;
}
export type PortRelation = "same" | "different" | "unknown";
/**
 * same: both texts identify one identical port, or print the same text
 * without a geographic conflict. different: every location either text can
 * denote is distinct from every location the other can denote. Anything
 * else (unknown names, unlisted codes, overlapping same-name ports) is unknown.
 */
export function relatePorts(
  left: { value: unknown; country?: string | null },
  right: { value: unknown; country?: string | null },
): PortRelation {
  const a = portIdentity(left.value, left.country), b = portIdentity(right.value, right.country);
  if (a.conflict || b.conflict) return "unknown";
  if (a.preferred.length === 1 && b.preferred.length === 1 && a.preferred[0] === b.preferred[0]) return "same";
  if (a.all.length && b.all.length && !a.all.some((c) => b.all.includes(c))) return "different";
  if (
    typeof left.value === "string" && typeof right.value === "string" &&
    clean(left.value) === clean(right.value) &&
    !(left.country && right.country && left.country !== right.country)
  ) return "same";
  return "unknown";
}
