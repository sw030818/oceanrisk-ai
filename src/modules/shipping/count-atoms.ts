import { numericTokens } from "../evidence/numbers";
export function countAtoms(text: string) {
  const tokens = text
    .trim()
    .replace(/^\(|\)$/g, "")
    .split(/\s*\/\s*/);
  if (tokens.length > 2) return [];
  const atoms = tokens.map((t) => {
    const m = t.match(
      /^([0-9]+(?:[,.][0-9]+)*)\s+(PCS|EA|PIECES?|CARTONS?|CTNS?|CT)$/i,
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
