import type { ShippingField } from "./schema";
import { independentlyVerified } from "./effective";
import { numericTokens } from "../evidence/numbers";
// Presentation only: never searches other blocks or changes proof status.
// Keep grouping separators/decimal places from the already verified citation.
export function literalReading(field: ShippingField): string {
  const c = field.current;
  if (c.value === null) return "정보 없음";
  if (typeof c.value !== "number" || !independentlyVerified(field)) return String(c.value);
  const quotes = c.source?.segments?.map(s => s.quote) ?? [];
  const matches = quotes.flatMap(q => [...q.matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g)].map(m => m[0]))
    .filter(s => numericTokens(s).length === 1 && numericTokens(s)[0] === c.value);
  return matches[0] ?? String(c.value);
}

import type { FieldRef } from "./review-evidence";
export function pairedReadings(fields: FieldRef[]) {
  const owner = (f: FieldRef) => [f.documentId, f.itemId ?? f.cargoId ?? f.containerId ?? f.referenceId ?? "document"].join("/");
  const unique = fields.filter((f, i) => fields.findIndex(v => owner(v) === owner(f) && v.fieldName === f.fieldName && v.field.current.status === f.field.current.status && v.field.current.value === f.field.current.value) === i);
  const paired = new Set<FieldRef>();
  const readings = unique.map(f => {
    const unitKey = f.fieldName === "packageCount" ? "packageUnit" : f.fieldName + "Unit";
    const unit = typeof f.field.current.value === "number" && independentlyVerified(f.field) ? unique.find(v => owner(v) === owner(f) && (v.fieldName === unitKey || (f.containerId && v.fieldName === "weightUnit")) && independentlyVerified(v.field)) : undefined;
    if (unit) paired.add(unit);
    return { field: f, text: `${literalReading(f.field)}${unit ? " " + literalReading(unit.field) : ""}` };
  });
  return readings.filter(v => !paired.has(v.field));
}
