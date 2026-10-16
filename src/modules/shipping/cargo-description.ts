import { countAtoms } from "./count-atoms";

// A description followed by BOTH explicit item-count and package-count atoms
// is a cargo manifest expression, not a product model. Keep all identity text,
// including capacities/model numbers, and retain the untouched input separately.
export function cargoDescription(text: string) {
  const parts = text.split(/\s*\/\s*/);
  if (parts.length < 3) return { goods: text, annotations: [] };
  const suffix = parts.slice(-2).map((p) => countAtoms(p));
  if (
    suffix.some((a) => a.length !== 1) ||
    new Set(suffix.map((a) => a[0].role)).size !== 2
  )
    return { goods: text, annotations: [] };
  const goods = parts.slice(0, -2).join(" / ").trim();
  if (!/[\p{L}]/u.test(goods) || countAtoms(goods).length)
    return { goods: text, annotations: [] };
  return { goods, annotations: suffix.flat() };
}
