import type { Evidence, PdfBlock, PdfPage } from "../documents/schema";
const norm = (text: string) =>
  text.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
export type LayoutRole =
  | "seller"
  | "buyer"
  | "transactionReference"
  | "purchaseOrder"
  | "invoiceReference"
  | "documentNumber"
  | "quantity"
  | "unit"
  | "description"
  | "netWeight"
  | "grossWeight"
  | "amount"
  | "weightUnit";
const vocabulary: Record<string, RegExp> = {
  seller: /^(?:(?:exporter|seller|shipper|판매자|수출자)(?:\s*\/\s*|\s+|$))+$/,
  buyer: /^(?:(?:importer|buyer|consignee|구매자|수입자)(?:\s*\/\s*|\s+|$))+$/,
  purchaseOrder:
    /^(?:purchase order(?: no| number)?|p\.?o\.?(?: no| number)?|order reference|order no|주문 번호|거래 참조)$/,
  invoiceReference:
    /^(?:invoice reference|invoice no|invoice number|invoice #|송장 번호)$/,
  documentNumber:
    /^(?:document|document no|invoice no|invoice number|invoice #|packing list no|송장 번호)$/,
  quantity:
    /^(?:qty\.?|quantity|product quantity|상품 수량|수량)(?:\s*\([a-z.]+\))?$|^(?:pcs|pieces|ea)$/,
  unit: /^(?:unit|units|uom|unit of measure|단위)$/,
  description:
    /^(?:description|goods description|item description|product description|commodity|product|item|품명|품목)$/,
  packaging: /^(?:ctns?|cartons?|packages?|boxes|포장|박스|포장 수량)$/,
  amount: /^(?:amount|line amount|금액)$/,
  netWeight: /^(?:net weight|net wt|순중량)$/,
  grossWeight: /^(?:gross weight|gross wt|총중량)$/,
  weightUnit: /^(?:weight unit|중량 단위)$/,
  other: /^(?:price|unit price|weight|중량)$/,
};
export function labelRole(text: string): string | null {
  const label = norm(text).replace(/\s*[:=#-]\s*$/, "");
  return (
    Object.entries(vocabulary).find(([, pattern]) =>
      pattern.test(label),
    )?.[0] ?? null
  );
}
export function evidenceBlocks(
  evidence: Evidence,
  page: PdfPage,
): PdfBlock[] | null {
  if (!page.blocks?.length) return null;
  if (evidence.segments) {
    if (
      new Set(evidence.segments.map((s) => s.blockId)).size !==
        evidence.segments.length ||
      norm(evidence.segments.map((s) => s.quote).join("\n")) !==
        norm(evidence.quote)
    )
      return null;
    const blocks: PdfBlock[] = [];
    for (const segment of evidence.segments) {
      const block = page.blocks.find((b) => b.id === segment.blockId);
      if (
        !block ||
        !norm(block.text).includes(norm(segment.quote)) ||
        !norm(page.text).includes(norm(segment.quote))
      )
        return null;
      blocks.push(block);
    }
    return blocks;
  }
  const matches = page.blocks.filter((b) =>
    norm(b.text).includes(norm(evidence.quote)),
  );
  if (matches.length) return matches.length === 1 ? matches : null;
  // Legacy quote-only evidence may span adjacent native PDF text items. Resolve
  // only a unique literal sequence; noncontiguous selections still need IDs.
  const quote = norm(evidence.quote);
  if (!quote || !norm(page.text).includes(quote)) return null;
  const sequences: PdfBlock[][] = [];
  for (let index = 0; index < page.blocks.length; index++) {
    const selected: PdfBlock[] = [];
    for (
      let offset = 0;
      offset < 12 && index + offset < page.blocks.length;
      offset++
    ) {
      selected.push(page.blocks[index + offset]);
      const text = norm(selected.map((b) => b.text).join(" "));
      if (text === quote) {
        sequences.push([...selected]);
        break;
      }
      if (!quote.startsWith(text + " ")) break;
    }
  }
  return sequences.length === 1 ? sequences[0] : null;
}
const right = (b: PdfBlock) => b.x + b.width;
const sameRow = (a: PdfBlock, b: PdfBlock) => a.row === b.row;
const headersAt = (page: PdfPage, row: number) =>
  (page.blocks ?? [])
    .filter((b) => b.row === row && labelRole(b.text))
    .sort((a, b) => a.x - b.x);
function columnContains(
  header: PdfBlock,
  value: PdfBlock,
  headers: PdfBlock[],
) {
  const index = headers.indexOf(header);
  const left = header.x - header.height;
  const end = headers[index + 1]?.x ?? pageRight(headers, value);
  return value.x >= left && right(value) <= end + header.height * 0.25;
}
function pageRight(headers: PdfBlock[], value: PdfBlock) {
  return Math.max(...headers.map(right), right(value)) + value.height;
}
export function relatedLabel(
  page: PdfPage,
  selected: PdfBlock[],
  value: string | number,
  role: LayoutRole,
): boolean {
  const target = selected.find((b) =>
    norm(b.text).includes(norm(String(value))),
  );
  if (!target) return false;
  const acceptable = (label: string | null) =>
    role === "transactionReference"
      ? ["purchaseOrder", "invoiceReference"].includes(label ?? "")
      : role === "documentNumber"
        ? ["documentNumber", "invoiceReference"].includes(label ?? "")
        : label === role;
  // Inline fields still use their actual full block, including preceding role context.
  const colon = target.text.indexOf(":");
  if (
    colon >= 0 &&
    acceptable(labelRole(target.text.slice(0, colon))) &&
    norm(target.text.slice(colon + 1)) === norm(String(value))
  )
    return true;
  const labels = (page.blocks ?? []).filter((b) => labelRole(b.text));
  const inline = labels.filter(
    (h) => sameRow(h, target) && right(h) <= target.x + h.height * 0.25,
  );
  const nearest = inline.sort((a, b) => right(b) - right(a))[0];
  if (
    nearest &&
    acceptable(labelRole(nearest.text)) &&
    target.x - right(nearest) <= (page.width ?? 600) * 0.45 &&
    !(page.blocks ?? []).some(
      (b) =>
        sameRow(b, target) &&
        b.id !== nearest.id &&
        b.id !== target.id &&
        b.x >= right(nearest) &&
        right(b) <= target.x,
    )
  )
    return true;
  const above = labels
    .filter(
      (h) =>
        h.row < target.row &&
        target.y - h.y <= Math.max(h.height, target.height) * 5 &&
        columnContains(h, target, headersAt(page, h.row)),
    )
    .sort((a, b) => b.y - a.y);
  const header = above[0];
  if (!header || !acceptable(labelRole(header.text))) return false;
  const peers = headersAt(page, header.row);
  // The first value row beneath this label must contain the selected value.
  const between = (page.blocks ?? []).filter(
    (b) =>
      b.row > header.row &&
      b.row < target.row &&
      columnContains(header, b, peers) &&
      !labelRole(b.text),
  );
  return between.length === 0;
}
export interface TableLink {
  tableId: string;
  rowId: string;
  role: string;
  unit: string | null;
}
export function tableLink(
  page: PdfPage,
  selected: PdfBlock[],
): TableLink | null {
  if (!selected.length) return null;
  const last = [...selected].sort((a, b) => b.y - a.y)[0];
  const headerRows = [
    ...new Set(
      (page.blocks ?? [])
        .filter((b) => b.row < last.row && labelRole(b.text) === "description")
        .map((b) => b.row),
    ),
  ].sort((a, b) => b - a);
  for (const headerRow of headerRows) {
    const values = selected.filter((b) => b.row > headerRow);
    if (!values.length || selected.some((b) => b.row < headerRow)) return null;
    const first = [...values].sort((a, b) => a.y - b.y || a.x - b.x)[0];
    const headers = headersAt(page, headerRow);
    if (!headers.some((h) => labelRole(h.text) === "quantity")) continue;
    const header = headers.find((h) => columnContains(h, first, headers));
    const role = header ? labelRole(header.text) : null;
    if (!header || !role) continue;
    // Never carry a table through a later party/reference heading.
    if (
      (page.blocks ?? []).some(
        (b) =>
          b.row > headerRow &&
          b.row < first.row &&
          ["seller", "buyer", "purchaseOrder", "invoiceReference"].includes(
            labelRole(b.text) ?? "",
          ),
      )
    )
      return null;
    if (!values.every((b) => columnContains(header, b, headers))) return null;
    let row = first.row;
    const quantityHeader = headers.find(
      (h) => labelRole(h.text) === "quantity",
    )!;
    const quantityCells = (page.blocks ?? []).filter(
      (b) =>
        b.row > headerRow &&
        columnContains(quantityHeader, b, headers) &&
        /\d/.test(b.text),
    );
    if (role === "description" && !quantityCells.some((b) => b.row === row)) {
      const previous = quantityCells
        .filter((b) => b.row < row && first.y - b.y <= first.height * 2)
        .sort((a, b) => b.y - a.y)[0];
      if (!previous) return null;
      row = previous.row;
    }
    // A multiline description cannot cross the next product row.
    if (
      role === "description" &&
      values.some((b) =>
        quantityCells.some((q) => q.row > row && q.row <= b.row),
      )
    )
      return null;
    const unitHeader = headers.find((h) => labelRole(h.text) === "unit");
    const unitCells = unitHeader
      ? (page.blocks ?? []).filter(
          (b) => b.row === row && columnContains(unitHeader, b, headers),
        )
      : [];
    const qtyCell = quantityCells.find((b) => b.row === row);
    const embeddedUnit = qtyCell?.text.match(
      /\d\s*(PCS|EA|PIECES?|KG|KGS|M|TONS?)\b/i,
    )?.[1];
    const headerUnit =
      quantityHeader.text.match(/\((PCS|EA|PIECES?|KG|KGS|M|TONS?)\)/i)?.[1] ??
      (/^(pcs|ea|pieces)$/i.test(quantityHeader.text.trim())
        ? quantityHeader.text.trim()
        : null);
    const units = unitCells
      .map((b) => b.text.trim())
      .filter((t) => /^(pcs|ea|pieces?|kg|kgs|m|tons?)$/i.test(t));
    const unit =
      units.length === 1 ? units[0] : (embeddedUnit ?? headerUnit ?? null);
    return {
      tableId: `p${page.page}:t${headerRow}`,
      rowId: `p${page.page}:r${row}`,
      role,
      unit,
    };
  }
  return null;
}
