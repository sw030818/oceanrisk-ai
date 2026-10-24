import { numericTokens } from "../evidence/numbers";
// "SAY: SIXTY-THREE (63) CARTONS ONLY" states one total in words + figures.
const inWords =
  /^(?:SAY\s*:?\s*)?(?:[A-Z]+(?:[- ][A-Z]+)*\s+)?\((\d{1,3}(?:,\d{3})*|\d+)\)\s*(PCS|EA|PIECES?|CARTONS?|CTNS?|CT|PALLETS?|PLTS?|PKGS?|PACKAGES?)\s*(?:ONLY)?\.?$/i;
export function countAtoms(text: string) {
  const said = text.normalize("NFKC").trim().match(inWords);
  if (said) {
    const nums = numericTokens(said[1]);
    if (nums.length === 1)
      return [{ value: nums[0], unit: said[2], role: /^(?:PCS|EA|PIECES?)$/i.test(said[2]) ? "quantity" : "packageCount" }];
  }
  const tokens = text
    .trim()
    .replace(/^\(|\)$/g, "")
    .trim()
    .split(/\s*\/\s*/);
  if (tokens.length > 2) return [];
  const atoms = tokens.map((t) => {
    const m = t.match(
      /^([0-9]+(?:[,.][0-9]+)*)\s*(PCS|EA|PIECES?|CARTONS?|CTNS?|CT|PALLETS?|PLTS?|PKGS?|PACKAGES?)$/i,
    );
    if (!m) return null;
    const nums = numericTokens(m[1]);
    if (nums.length !== 1) return null;
    return {
      value: nums[0],
      unit: m[2],
      role: /^(?:PCS|EA|PIECES?)$/i.test(m[2]) ? "quantity" : "packageCount",
    };
  });
  return atoms.every(Boolean) ? atoms.filter((a) => a !== null) : [];
}
export function atomRole(text: string, value: string | number, role: string) {
  const base =
    role === "packageUnit" ? "packageCount" : role.replace(/Unit$/, "");
  const matching = countAtoms(text).filter(
    (a) =>
      a.role === base &&
      (typeof value === "number"
        ? a.value === value
        : a.unit.toLowerCase() === value.toLowerCase()),
  );
  return matching.length === 1 ? matching[0].role : null;
}
