import data from "./ports-data.json" with { type: "json" };
const clean = (s: string) =>
  s.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");
const countryNames: Record<string, string[]> = {
  KR: ["korea", "south korea", "대한민국"],
  US: ["usa", "united states"],
  NL: ["netherlands"],
  SG: ["singapore"],
  DE: ["germany"],
  GB: ["uk", "united kingdom"],
  JP: ["japan"],
  AU: ["australia"],
  AE: ["uae"],
  BE: ["belgium"],
  FR: ["france"],
  NZ: ["new zealand"],
  HK: ["hong kong"],
  VN: ["vietnam"],
};
export function portMeaning(value: unknown) {
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
  if (
    matches.length === 0 &&
    value.trim() === value.trim().toUpperCase() &&
    data.countries.includes(code.slice(0, 2)) &&
    /^[A-Z]{2}[A-Z2-9]{3}$/.test(code)
  )
    return { code, source: "literal_code" as const, version: null };
  return matches.length === 1
    ? {
        code: matches[0].Country + matches[0].Location,
        source: "unlocode_subset" as const,
        version: data.version,
      }
    : null;
}
