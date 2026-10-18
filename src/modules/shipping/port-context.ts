import type { ShippingDocument } from "./schema";
import { root32, verified32, type FieldRef } from "./review-evidence";
import { countryCode, portMeaning } from "./ports";

// Only a verified country on this exact document can qualify its POD. POL,
// edited/OCR candidates and other documents' countries are never consulted.
export function contextualPort(ref: FieldRef, documents: ShippingDocument[], knownOnly = false) {
  const doc = documents.find(d => d.id === ref.documentId);
  const country = ref.fieldName === "portOfDischarge" && doc ? root32(doc, "destinationCountry") : undefined;
  const hint = country && verified32(country) ? countryCode(country.field.current.value) : null;
  if (country && verified32(country) && !hint) return null;
  const meaning = portMeaning(ref.field.current.value, hint);
  return meaning && (!knownOnly || meaning.source === "unlocode_subset") ? meaning.code : null;
}
