import { nativeDetailGroup, nativeItemBlock } from "./shipping-detail-group";
import type { PdfPage, PdfBlock } from "../documents/schema";
import { columnContains, type TableLink } from "./relations";
import { nativeTableLink, nativeCell } from "./shipping-geometry";
import { shippingRole } from "../shipping/roles";
export type EntityScope = "document" | "item" | "container" | "cargo";
const tableAnchor: Record<Exclude<EntityScope, "document">, string[]> = {
  item: ["goodsDescription", "tradeDescription"],
  container: ["containerNumber"],
  cargo: ["houseBlNumber"],
};
function totalRow(page: PdfPage, row: number) {
  return (page.blocks ?? []).some(
    (b) =>
      b.row === row &&
      /^(?:total|subtotal|grand total|合計|합계|소계|총계)(?:\s+(?:quantity|qty|packages|ctns|gross weight|net weight))?\s*:?$/i.test(
        b.text.trim(),
      ),
  );
}
export function shippingCell(
  page: PdfPage,
  selected: PdfBlock[],
  scope: EntityScope,
): TableLink | null {
  if (scope === "document" || !selected.length) return null;
  if (page.cells?.length) {
    const detail = scope === "item" && selected.map(b=>nativeDetailGroup(page,b));
    if (detail && detail.length && detail.every(l=>l && l.tableId===detail[0]!.tableId && l.rowId===detail[0]!.rowId && l.role===detail[0]!.role)) return detail[0];
    const block = scope === "item" && selected.map(b=>nativeItemBlock(page,b));
    if (block && block.length && block.every(l=>l && l.tableId===block[0]!.tableId && l.rowId===block[0]!.rowId && l.role===block[0]!.role)) return block[0];
    const native = nativeTableLink(page, selected, scope);
    if (native) return native;
    const cell = nativeCell(page, selected[0]);
    // A lone decorative frame or a table outside the closed-cell area keeps the
    // existing positioned-text engine. A real multi-column native band is not
    // bypassed after its row/column validation failed.
    if (cell && page.cells.length > 1) return null;
  }
  const blocks = page.blocks ?? [],
    first = [...selected].sort((a, b) => a.y - b.y || a.x - b.x)[0];
  if (totalRow(page, first.row)) return null;
  const rows = [
    ...new Set(
      blocks
        .filter(
          (b) =>
            b.row < first.row &&
            tableAnchor[scope].includes(shippingRole(b.text) ?? ""),
        )
        .map((b) => b.row),
    ),
  ].sort((a, b) => b - a);
  for (const headerRow of rows) {
    const headers = blocks
      .filter((b) => b.row === headerRow && shippingRole(b.text))
      .sort((a, b) => a.x - b.x);
    if (
      page.cells?.length &&
      page.cells.length > 1 &&
      headers.some((h) => nativeCell(page, h))
    )
      continue;
    if (
      headers.some((h) => shippingRole(h.text) === "houseBlNumber") &&
      scope !== "cargo" &&
      (scope !== "container" || !headers.some(h => shippingRole(h.text) === "containerNumber"))
    )
      continue;
    if (
      headers.length < 2 ||
      !headers.some((h) =>
        [
          "quantity",
          "packageCount",
          "grossWeight",
          "netWeight",
          "hsCode",
          "containerNumber",
        ].includes(shippingRole(h.text)!),
      )
    )
      continue;
    if (
      blocks.some(
        (b) =>
          b.row > headerRow &&
          b.row <= first.row &&
          (totalRow(page, b.row) ||
            /^total/i.test(shippingRole(b.text.split(":")[0]) ?? "")),
      )
    )
      continue;
    const header = headers.find((h) => columnContains(h, first, headers));
    if (!header) continue;
    const role = shippingRole(header.text)!;
    const inline = first.text.includes(":")
      ? shippingRole(first.text.split(":")[0])
      : null;
    if (inline && inline !== role) continue;
    if (
      blocks.some(
        (b) =>
          b.row > headerRow &&
          b.row < first.row &&
          tableAnchor.item
            .concat(tableAnchor.container, tableAnchor.cargo)
            .includes(shippingRole(b.text) ?? "") &&
          blocks.filter((h) => h.row === b.row && shippingRole(h.text))
            .length >= 2,
      )
    )
      continue;
    if (!selected.every((b) => columnContains(header, b, headers))) return null;
    const anchorHeader = headers.find((h) =>
      tableAnchor[scope].includes(shippingRole(h.text)!),
    )!;
    // A wrapped description line is a continuation, not a new product row.
    // Only rows containing an independently located data cell establish an
    // item anchor; this also prevents matching two distinct product rows.
    const dataHeaders = headers.filter((h) =>
      [
        "quantity",
        "hsCode",
        "packageCount",
        "netWeight",
        "grossWeight",
      ].includes(shippingRole(h.text)!),
    );
    const anchors = blocks.filter(
      (b) =>
        b.row > headerRow &&
        columnContains(anchorHeader, b, headers) &&
        !shippingRole(b.text) &&
        (scope !== "item" ||
          blocks.some(
            (cell) =>
              cell.row === b.row &&
              !shippingRole(cell.text) &&
              dataHeaders.some((h) => columnContains(h, cell, headers)),
          )),
    );
    let row = first.row;
    if (!anchors.some((a) => a.row === row)) {
      const forward =
        scope === "item" &&
        ["goodsDescription", "tradeDescription"].includes(role)
          ? anchors
              .filter(
                (a) =>
                  a.row > row &&
                  a.y - first.y <= Math.max(a.height, first.height) * 2,
              )
              .sort((a, b) => a.y - b.y)[0]
          : undefined;
      const prior = anchors
        .filter(
          (a) =>
            a.row < row &&
            first.y - a.y <= Math.max(a.height, first.height) * 2,
        )
        .sort((a, b) => b.y - a.y)[0];
      if (!prior && !forward) return null;
      row = forward?.row ?? prior!.row;
    }
    const wrap = ["goodsDescription", "tradeDescription"].includes(role);
    if (!wrap && selected.some((b) => b.row !== row)) return null;
    if (
      wrap &&
      selected.some((b) =>
        anchors.some(
          (a) =>
            a.row !== row &&
            a.row >= Math.min(first.row, row) &&
            a.row <= b.row,
        ),
      )
    )
      return null;
    const unit =
      header.text.match(/\(([^)]+)\)/)?.[1] ??
      first.text.match(/\d\s*(KG|KGS|PCS|EA|CTNS|PKGS)\b/i)?.[1] ??
      null;
    return {
      tableId: `p${page.page}:t${headerRow}`,
      rowId: `p${page.page}:r${row}`,
      role,
      unit,
    };
  }
  return null;
}
