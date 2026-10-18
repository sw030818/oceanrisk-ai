import type { PdfPage, PdfBlock } from "../documents/schema";
import { labelForValue } from "./relations";
import { nativeCell, nativeKeyValue } from "./shipping-geometry";
import { shippingRole } from "../shipping/roles";

// Positioned-text fallback must respect the vector borders already extracted
// from the PDF. Unknown headings in neighbouring cells are not absent borders.
export function shippingLabelForValue(
  page: PdfPage,
  selected: PdfBlock[],
  value: string | number,
  classify = shippingRole,
): string | null {
  // The verifier already selected the actual number/unit block. Resolve the
  // label of that entire literal block, not a suffix searched across the page.
  if(typeof value === "string" && selected.length===1) {
    const numeric=selected[0].text.match(/^\s*[-+]?\d+(?:[.,]\d+)*\s*(.*?)\s*$/);
    if(numeric && numeric[1].normalize("NFKC").toLowerCase()===value.normalize("NFKC").toLowerCase()) value=selected[0].text;
  }
  const paired=selected.map(b=>nativeKeyValue(page,b));
  if(paired.length && paired.every(p=>p && p.label===paired[0]!.label && p.role===paired[0]!.role))return paired[0]!.role;
  if ((page.cells?.length ?? 0) > 1) {
    const cells = selected.map((b) => nativeCell(page, b));
    if (cells.some(Boolean)) {
      const cell = cells[0];
      if (!cell || cells.some((c) => c !== cell)) return null;
      return labelForValue(
        { ...page, blocks: page.blocks?.filter((b) => nativeCell(page, b) === cell) },
        selected,
        value,
        classify,
      );
    }
    return labelForValue(
      { ...page, blocks: page.blocks?.filter((b) => !nativeCell(page, b)) },
      selected, value, classify,
    );
  }
  return labelForValue(page, selected, value, classify);
}
