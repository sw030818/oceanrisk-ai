import type { ShippingDocument, ShippingField } from "./schema";
// The same field traversal is used by UI, grounding and safe evaluation metrics.
export function shippingValues(doc: ShippingDocument): ShippingField[] {
  return [
    ...Object.values(doc.fields),
    ...doc.additionalFields.map((f) => f.field),
    ...doc.items.flatMap((i) => Object.values(i.fields)),
    ...doc.containers.flatMap((c) => [
      c.containerNumber,
      c.sealNumber,
      ...(c.sealNumbers ?? []),
      c.packageCount,
      c.packageUnit,
      c.grossWeight,
      c.weightUnit,
    ]),
    ...doc.cargoRecords.flatMap((c) => Object.values(c.fields)),
    ...doc.references.map((r) => r.number),
  ];
}
