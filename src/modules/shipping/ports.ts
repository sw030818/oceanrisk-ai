import data from "./ports-data.json" with { type: "json" };
const clean = (s: string) =>
  s.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");
const countryNames: Record<string, string[]> = {
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
// Country qualification is explicit, consistent text, never a city guess.
export function countryCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parts = clean(value).split(/[()/]/).map(s => s.trim()).filter(Boolean);
  const codes = parts.map(part => Object.entries(countryNames).find(([code, names]) => part === code.toLowerCase() || names.includes(part))?.[0]);
  return codes.length && codes.every(Boolean) && new Set(codes).size === 1 ? codes[0]! : null;
}
export function portMeaning(value: unknown, verifiedCountry?: string | null) {
  if (typeof value !== "string") return null;
  const raw = clean(value),
    code = raw.replace(/\s/g, "").toUpperCase();
  // Comparing two literal codes does not prove that a location exists in our
  // bounded gazetteer. Never manufacture a name or a country from an unknown code.
  const matches = data.entries.filter((e) => {
    const id = e.Country + e.Location,
      name = clean(e.Name);
    const aliases = [
      id.toLowerCase(),
      `${id.slice(0, 2).toLowerCase()} ${id.slice(2).toLowerCase()}`,
      name,
      `${name} (${id.toLowerCase()})`,
      `${id.slice(0, 2).toLowerCase()} ${id.slice(2).toLowerCase()} / ${name}`,
    ];
    for (const country of [
      e.Country.toLowerCase(),
      ...(countryNames[e.Country] ?? []),
    ])
      aliases.push(`${name}, ${country}`, `${name} ${country}`);
    return aliases.includes(raw);
  });
  // An independently verified own-document destination country can resolve
  // ambiguous names. It cannot rewrite an explicit conflicting name/code.
  const qualified = verifiedCountry ? matches.filter(e => e.Country === verifiedCountry) : matches;
  if (verifiedCountry && matches.length && !qualified.length) return null;
  if (
    matches.length === 0 &&
    value.trim() === value.trim().toUpperCase() &&
    data.countries.includes(code.slice(0, 2)) &&
    /^[A-Z]{2}[A-Z2-9]{3}$/.test(code)
  )
    return verifiedCountry && code.slice(0, 2) !== verifiedCountry ? null : { code, source: "literal_code" as const, version: null };
  return qualified.length === 1
    ? {
        code: qualified[0].Country + qualified[0].Location,
        source: "unlocode_subset" as const,
        version: ["CAVAN", "USVAN", "USSEA"].includes(qualified[0].Country + qualified[0].Location) ? data.supplementalSource.version : data.version,
      }
    : null;
}
