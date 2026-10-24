import { goodsMeaning, compareGoods } from "./goods-semantics";
import { cargoDescription } from "./cargo-description";
import { text32, verified32, type FieldRef } from "./review-evidence";
import { portMeaning } from "./ports";
export const portCode = (v: unknown) => portMeaning(v)?.code ?? null;
export function goodsCore(v: unknown) {
  if (typeof v !== "string") return "";
  // Preserve Unicode and all product qualifiers; only count annotations and
  // explicit HS annotations are separated from the product meaning.
  const cleaned = text32(cargoDescription(v).goods)
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
  if (meaning === "semantic") {
    const annotated =
      (typeof a === "string" && cargoDescription(a).annotations.length > 0) ||
      (typeof b === "string" && cargoDescription(b).annotations.length > 0);
    return annotated ? "partial" as const : "semantic" as const;
  }
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
// Bare "CT"/"PL" codes are package kinds only in a verified package-unit cell.
const contextualCodes: Record<string, string> = { ct: "CTNS", pl: "PALLETS" };
export function contextualPackageUnit(ref: FieldRef | undefined): string | null {
  const code = ref ? contextualCodes[text32(ref.field.current.value)] : undefined;
  return code && contextualCarton(ref, true) ? code : null;
}
export function contextualCarton(ref: FieldRef | undefined, anyCode = false) {
  if (!ref || !verified32(ref) || (anyCode ? !contextualCodes[text32(ref.field.current.value)] : text32(ref.field.current.value) !== "ct"))
    return false;
  const source = ref.field.current.source;
  return (
    ref.fieldName === "packageUnit" &&
    source?.semanticRole === "packageUnit" &&
    !!source.segments?.length
  );
}
