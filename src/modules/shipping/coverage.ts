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
      doc.containers.some((c) => c.containerNumber.original.value !== null)
        ? doc.containers
            .filter((c) => c.containerNumber.original.value !== null)
            .map((c) => c.containerNumber)
        : doc.cargoRecords
            .filter(
              (c) =>
                c.fields.containerNumber &&
                c.fields.containerNumber.original.value !== null,
            )
            .map((c) => c.fields.containerNumber),
    ),
    cargoRecords: rows(
      "cargo",
      doc.cargoRecords.map((c) => c.fields.houseBlNumber),
    ),
  };
}

export function nativeFactCoverage(doc: ShippingDocument, pdf: PdfDocument) {
  const build = (
    kind: "items" | "containers" | "cargoRecords",
    fields: ShippingField[],
  ) => {
    const native = fields.every(
      (f) =>
        f.original.status === "verified" &&
        f.original.source?.provenance !== "ocr" &&
        !!f.original.source?.layout?.tableId,
    );
    const rows = fields
      .flatMap((f) => {
        const s = f.original.source;
        return s?.layout
          ? [`${s.page}/${s.layout.tableId}/${s.layout.rowId}`]
          : [];
      })
      .sort();
    return {
      complete:
        !!doc.collectionCoverage?.[kind].complete &&
        native &&
        new Set(rows).size === rows.length &&
        rows.length > 0,
      rows,
    };
  };
  const limitations: (
    | "partial"
    | "combined_packages"
    | "incomplete_table"
    | "ocr"
  )[] = [];
  if (doc.nativeScopeLimitation) limitations.push(doc.nativeScopeLimitation);
  if (pdf.pages.some((p) => p.textSource === "ocr")) limitations.push("ocr");
  if (
    pdf.pages.some((p) =>
      /일부\s*품목|부분\s*목록|일부\s*화물|일부\s*내역|subset\s+of|selected\s+items/i.test(
        p.text,
      ),
    )
  )
    limitations.push("incomplete_table");
  return {
    items: build(
      "items",
      doc.items.map((i) =>
        i.fields.goodsDescription.original.value !== null
          ? i.fields.goodsDescription
          : i.fields.tradeDescription,
      ),
    ),
    containers: build(
      "containers",
      doc.containers
        .filter((c) => c.containerNumber.original.value !== null)
        .map((c) => c.containerNumber),
    ),
    cargoRecords: build(
      "cargoRecords",
      doc.cargoRecords.map((c) => c.fields.houseBlNumber),
    ),
    limitations,
  };
}
