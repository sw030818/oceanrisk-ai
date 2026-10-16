import type { PdfPage, PdfBlock } from "../documents/schema";
import type { ShippingField } from "./schema";
import { nativeCell, geometricRole } from "../layout/shipping-geometry";
import { shippingCell, type EntityScope } from "../layout/shipping-cells";
import { physicalLines, spanText } from "../layout/physical-spans";
import { normalizeText } from "../evidence/verify";
import { shippingRole } from "./roles";
import { independentlyVerified } from "./effective";
import { compareGoods } from "./goods-semantics";

// Only two bilingual descriptions inside ONE actual product data cell/row.
// Never borrow an English name from another document, row, note or OCR output.
export function nativeGoodsContext(
  page: PdfPage,
  values: PdfBlock[],
  scope: EntityScope,
) {
  if (page.textSource === "ocr" || !["item", "cargo"].includes(scope)) return;
  const cell = values[0] && nativeCell(page, values[0]);
  const owner = values[0] && shippingCell(page, [values[0]], scope);
  if (!cell || !owner || values.some((b) => nativeCell(page, b) !== cell)) return;
  const candidates = (page.blocks ?? []).filter(
    (b) => nativeCell(page, b) === cell &&
      geometricRole(page, b) === "goodsDescription" && !shippingRole(b.text),
  );
  if (
    candidates.length > 24 ||
    candidates.some((b) => !normalizeText(page.text).includes(normalizeText(b.text)))
  ) return;
  const lines = physicalLines(page, candidates.filter((b) => {
    const link = shippingCell(page, [b], scope);
    return link?.tableId === owner.tableId && link.rowId === owner.rowId;
  })).filter((line) => !/^\(?HS\b/i.test(spanText(line)));
  if (lines.length !== 2 || lines.some((line) => spanText(line).length > 300)) return;
  const texts = lines.map(spanText);
  if (
    texts.filter((t) => /[가-힣]/.test(t)).length !== 1 ||
    texts.filter((t) => !/[가-힣]/.test(t) && /[a-z]{3}/i.test(t)).length !== 1 ||
    Math.abs(lines[1][0].y - lines[0][0].y) >
      Math.max(...lines.flat().map((b) => b.height)) * 3
  ) return;
  return lines.map((line) => ({
    value: spanText(line),
    blockIds: line.map((b) => b.id),
  }));
}

export function goodsComparisonValue(field: ShippingField) {
  const raw = field.current.value, context = field.current.source?.goodsContext;
  if (!independentlyVerified(field) || typeof raw !== "string" || !context?.length)
    return raw;
  // A native bilingual alias can add information but cannot erase an explicit
  // contradiction or an unsupported description. Missing specs remain partial.
  if (context.some((c) =>
    ["different", "insufficient"].includes(compareGoods(raw, c.value).status),
  )) return raw;
  return [...new Set([raw, ...context.map((c) => c.value)])].join(" ");
}

// Reconstruct a wrapped description from its actual data cell, not from a
// document-wide word search. Distinct paragraphs and conflicting products stay
// separate candidates; the normal verifier still proves every returned span.
export function nativeGoodsSpans(page: PdfPage) {
  const groups = new Map<NonNullable<ReturnType<typeof nativeCell>>, PdfBlock[]>();
  for (const b of page.blocks ?? []) {
    const cell = nativeCell(page, b);
    if (!cell || geometricRole(page, b) !== "goodsDescription" ||
      shippingRole(b.text) || /^\(?HS\b/i.test(b.text)) continue;
    const group = groups.get(cell) ?? [];
    group.push(b);
    groups.set(cell, group);
  }
  const spans: PdfBlock[][] = [];
  for (const blocks of groups.values()) {
    const lines = physicalLines(page, blocks);
    let paragraph: PdfBlock[][] = [];
    const flush = () => {
      const flat = paragraph.flat();
      if (paragraph.length > 1 && flat.length <= 12 && spanText(flat).length <= 300 &&
        !paragraph.some((a, i) => paragraph.slice(i + 1).some((b) =>
          compareGoods(spanText(a), spanText(b)).status === "different")))
        spans.push(flat);
      paragraph = [];
    };
    for (const line of lines) {
      const last = paragraph.at(-1)?.at(-1);
      if (last && (line[0].y - last.y > Math.max(last.height, line[0].height) * 2.5 ||
        (page.blocks ?? []).some((b) => nativeCell(page, b) === nativeCell(page, last) &&
          b.y > last.y + 0.5 && b.y < line[0].y - 0.5 && !blocks.includes(b)))) flush();
      paragraph.push(line);
    }
    flush();
  }
  return spans;
}
