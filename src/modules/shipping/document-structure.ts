import type { PdfDocument } from "../documents/schema";
import { shippingCell } from "../layout/shipping-cells";
import { shippingRole } from "./roles";
// Extraction hints refer only to actual native blocks. They are NOT evidence
// approvals and never invent a header on a continuation page or repair an owner.
export function shippingStructure(pdf: PdfDocument) {
  return pdf.pages.map((page) => {
    const labels = (page.blocks ?? []).flatMap((b) => {
      const role = shippingRole(b.text);
      return role ? [{ blockId: b.id, role }] : [];
    });
    const rows = new Map<
      string,
      {
        scope: string;
        tableId: string;
        rowId: string;
        cells: { blockId: string; role: string }[];
      }
    >();
    const bounded =
      (page.blocks?.length ?? 0) <= 240 && (page.cells?.length ?? 0) <= 240;
    if (page.textSource !== "ocr" && bounded)
      for (const scope of ["item", "container", "cargo"] as const)
        for (const block of page.blocks ?? []) {
          const cell = shippingCell(page, [block], scope);
          if (!cell) continue;
          const key = [scope, cell.tableId, cell.rowId].join("/");
          const row = rows.get(key) ?? {
            scope,
            tableId: cell.tableId,
            rowId: cell.rowId,
            cells: [],
          };
          row.cells.push({ blockId: block.id, role: cell.role });
          rows.set(key, row);
        }
    return {
      page: page.page,
      provenance: page.textSource ?? "pdf_text",
      labels: labels.slice(0, 100),
      nativeRows: [...rows.values()].slice(0, 100),
      truncated: !bounded || labels.length > 100 || rows.size > 100,
    };
  });
}
