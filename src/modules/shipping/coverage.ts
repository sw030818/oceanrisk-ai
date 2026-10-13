import { shippingCell, type EntityScope } from "../layout/shipping-cells";
import type { PdfDocument } from "../documents/schema";
import type { ShippingDocument, ShippingField } from "./schema";
export function collectionCoverage32(doc: ShippingDocument, pdf: PdfDocument) {
  const roles = {
    item: ["goodsDescription", "tradeDescription"],
    container: ["containerNumber"],
    cargo: ["houseBlNumber"],
  };
  const rows = (
    scope: Exclude<EntityScope, "document">,
    fields: ShippingField[],
  ) => {
    const actual = new Set<string>();
    for (const p of pdf.pages)
      for (const b of p.blocks ?? []) {
        const l = shippingCell(p, [b], scope);
        if (l && roles[scope].includes(l.role))
          actual.add(`${p.page}/${l.tableId}/${l.rowId}`);
      }
    const extracted = fields.map((f) => {
      const s = f.original.source;
      return f.original.status === "verified" && s?.layout
        ? `${s.page}/${s.layout.tableId}/${s.layout.rowId}`
        : null;
    });
    return {
      complete:
        actual.size > 0 &&
        extracted.length === actual.size &&
        new Set(extracted).size === extracted.length &&
        extracted.every((v) => v !== null && actual.has(v)),
      rowCount: actual.size,
    };
  };
  return {
    items: rows(
      "item",
      doc.items.map((i) =>
        i.fields.goodsDescription.original.value !== null
          ? i.fields.goodsDescription
          : i.fields.tradeDescription,
      ),
    ),
    containers: rows(
      "container",
      doc.containers.map((c) => c.containerNumber),
    ),
    cargoRecords: rows(
      "cargo",
      doc.cargoRecords.map((c) => c.fields.houseBlNumber),
    ),
  };
}
