import { goodsMeaning, compareGoods } from "./goods-semantics";
import { countAtoms } from "./count-atoms";
import { text32, verified32, type FieldRef } from "./review-evidence";
import { portMeaning } from "./ports";
export const portCode = (v: unknown) => portMeaning(v)?.code ?? null;
export function goodsCore(v: unknown) {
  if (typeof v !== "string") return "";
  // Preserve Unicode and all product qualifiers; only count annotations and
  // explicit HS annotations are separated from the product meaning.
  const cleaned = text32(v)
    .split(/\s*\/\s*/)
    .filter((part) => !countAtoms(part).length)
    .join(" ")
    .replace(/\(([^)]*)\)/g, (whole, body: string) =>
      !/^HS\s+[0-9. -]+$/i.test(body) ? body : " ",
    )
    .replace(/[^\p{L}\p{N}.,+%-]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
  return goodsMeaning(cleaned).key;
}
export function goodsEquivalent(a: unknown, b: unknown) {
  if (text32(a) === text32(b)) return "exact" as const;
  const meaning = compareGoods(a, b).status;
  if (meaning === "semantic") return "semantic" as const;
  if (meaning === "different") return "different" as const;
  const left = goodsCore(a),
    right = goodsCore(b);
  return left && left === right ? ("partial" as const) : ("different" as const);
}
export function hsSix(v: unknown) {
  if (typeof v !== "string" || !/^\d[\d. -]{4,15}\d$/.test(v)) return null;
  const digits = v.replace(/[. -]/g, "");
  return digits.length >= 6 ? digits.slice(0, 6) : null;
}
export function contextualCarton(ref: FieldRef | undefined) {
  if (!ref || !verified32(ref) || text32(ref.field.current.value) !== "ct")
    return false;
  const source = ref.field.current.source;
  return (
    ref.fieldName === "packageUnit" &&
    source?.semanticRole === "packageUnit" &&
    !!source.segments?.length
  );
}
