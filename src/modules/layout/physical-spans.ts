import type { PdfPage, PdfBlock } from "../documents/schema";
// A reading aid over original blocks, never a new source ID or OCR proof.
// Closed cell + actual baseline + bounded word gap prevent cross-column joins.
export function physicalLines(page: PdfPage, selected = page.blocks ?? []) {
  const cell = (b: PdfBlock) =>
    page.cells
      ?.filter(
        (c) =>
          b.x >= c.x - 0.8 &&
          b.x + b.width <= c.x + c.width + 0.8 &&
          b.y >= c.y - 0.8 &&
          b.y + b.height <= c.y + c.height + 0.8,
      )
      .sort((a, b) => a.width * a.height - b.width * b.height)[0];
  const lines: PdfBlock[][] = [];
  for (const b of [...selected].sort((a, b) => a.row - b.row || a.x - b.x)) {
    const last = lines.at(-1),
      prev = last?.at(-1);
    if (
      prev &&
      prev.row === b.row &&
      cell(prev) === cell(b) &&
      Math.abs(prev.y + prev.height - (b.y + b.height)) <=
        Math.max(prev.height, b.height) * 0.6 &&
      b.x - (prev.x + prev.width) <= Math.max(prev.height, b.height) * 2 &&
      b.x >= prev.x &&
      last!.length < 12
    )
      last!.push(b);
    else lines.push([b]);
  }
  return lines;
}
export const spanText = (blocks: PdfBlock[]) =>
  blocks.map((b) => b.text).join(" ");
