import type { PdfPage, PdfBlock } from "../documents/schema";
import { labelForValue } from "./relations";
import { nativeCell } from "./shipping-geometry";
import { shippingRole } from "../shipping/roles";

// Positioned-text fallback must respect the vector borders already extracted
// from the PDF. Unknown headings in neighbouring cells are not absent borders.
export function shippingLabelForValue(
  page: PdfPage,
  selected: PdfBlock[],
  value: string | number,
  classify = shippingRole,
): string | null {
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
