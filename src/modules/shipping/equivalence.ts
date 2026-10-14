import { countAtoms } from "./count-atoms";
import { text32, verified32, type FieldRef } from "./review-evidence";
// UN/LOCODE (UNECE): KR PUS = Busan, US LAX = Los Angeles.
// https://unece.org/trade/cefact/unlocode-code-list-country-and-territory
// This deliberately small exact alias table rejects unsupported codes/countries.
const ports: Record<string, string> = {
  busan: "KRPUS",
  "busan, korea": "KRPUS",
  "busan korea": "KRPUS",
  krpus: "KRPUS",
  "kr pus": "KRPUS",
  "kr pus / busan": "KRPUS",
  "busan (krpus)": "KRPUS",
  "los angeles": "USLAX",
  "los angeles, usa": "USLAX",
  uslax: "USLAX",
  "us lax": "USLAX",
  "us lax / los angeles": "USLAX",
  "los angeles (uslax)": "USLAX",
};
export const portCode = (v: unknown) => ports[text32(v)] ?? null;
export function goodsCore(v: unknown) {
  if (typeof v !== "string") return "";
  // Keep dimensions/numerals and model qualifiers. Non-ASCII translation and
  // alphabetic parenthetical explanations support PARTIAL meaning only.
  return text32(v)
    .split(/\s*\/\s*/)
    .filter((part) => !countAtoms(part).length)
    .join(" ")
    .replace(/\(([^)]*)\)/g, (whole, body: string) =>
      /\d/.test(body) && !/^HS\s+[0-9. -]+$/i.test(body) ? body : " ",
    )
    .replace(/[^a-z0-9.,+%-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
export function goodsEquivalent(a: unknown, b: unknown) {
  if (text32(a) === text32(b)) return "exact" as const;
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
