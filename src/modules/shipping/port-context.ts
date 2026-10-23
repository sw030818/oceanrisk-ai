import type { ShippingDocument } from "./schema";
import { root32, verified32, text32, type FieldRef } from "./review-evidence";
import { countryCode, portMeaning, relatePorts, type PortRelation } from "./ports";

// Only a verified country on this exact document can qualify its POD. POL,
// edited/OCR candidates and other documents' countries are never consulted.
function ownCountry(ref: FieldRef, documents: ShippingDocument[]): string | null | undefined {
  const doc = documents.find(d => d.id === ref.documentId);
  const country = ref.fieldName === "portOfDischarge" && doc ? root32(doc, "destinationCountry") : undefined;
  if (!country || !verified32(country)) return null;
  // A verified country we cannot interpret blocks resolution (undefined).
  return countryCode(country.field.current.value) ?? undefined;
}
export function contextualPort(ref: FieldRef, documents: ShippingDocument[], knownOnly = false) {
  const hint = ownCountry(ref, documents);
  if (hint === undefined) return null;
  const meaning = portMeaning(ref.field.current.value, hint);
  return meaning && (!knownOnly || meaning.source === "unlocode_subset") ? meaning.code : null;
}
/** Geographic relation of two verified port fields, each read in its own document context. */
export function portRelation(left: FieldRef, right: FieldRef, documents: ShippingDocument[]): PortRelation {
  const a = ownCountry(left, documents), b = ownCountry(right, documents);
  if (a === undefined || b === undefined) return text32(left.field.current.value) === text32(right.field.current.value) ? "same" : "unknown";
  return relatePorts({ value: left.field.current.value, country: a }, { value: right.field.current.value, country: b });
}
