import { OPS, Util } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PdfCell } from "../documents/schema";
// Only closed, stroked, axis-aligned cells from the PDF drawing operators.
// No inferred borders, template coordinates, image/OCR coordinates or fuzzy cells.
export function nativePdfCells(
  ops: { fnArray: number[]; argsArray: unknown[][] },
  viewport: number[],
): PdfCell[] {
  type Line = { x1: number; y1: number; x2: number; y2: number };
  const lines: Line[] = [];
  let matrix = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];
  const point = (x: number, y: number) => {
    const p = [x, y];
    Util.applyTransform(p, Util.transform(viewport, matrix));
    return p;
  };
  const line = (a: number[], b: number[]) => {
    if (![...a, ...b].every(Number.isFinite)) return;
    if (Math.abs(a[0] - b[0]) < 0.1 || Math.abs(a[1] - b[1]) < 0.1)
      lines.push({
        x1: Math.min(a[0], b[0]),
        y1: Math.min(a[1], b[1]),
        x2: Math.max(a[0], b[0]),
        y2: Math.max(a[1], b[1]),
      });
  };
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i],
      args = ops.argsArray[i];
    if (fn === OPS.save) stack.push([...matrix]);
    else if (fn === OPS.restore) matrix = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.transform)
      matrix = Util.transform(matrix, args as number[]);
    else if (
      fn === OPS.constructPath &&
      [OPS.stroke, OPS.closeStroke, OPS.fillStroke, OPS.eoFillStroke].includes(
        args[0] as number,
      )
    ) {
      const data = (args[1] as (ArrayLike<number> | null)[])?.[0];
      if (!data) continue;
      let prior: number[] | null = null,
        start: number[] | null = null;
      for (let j = 0; j < data.length; ) {
        const op = data[j++];
        if (op === 0) {
          prior = point(data[j++], data[j++]);
          start = prior;
        } else if (op === 1) {
          const next = point(data[j++], data[j++]);
          if (prior) line(prior, next);
          prior = next;
        } else if (op === 4) {
          if (prior && start) line(prior, start);
          prior = start;
        } else if (op === 2) {
          j += 6;
          prior = null;
        } else if (op === 3) {
          j += 4;
          prior = null;
        } else break;
      }
    }
    if (lines.length > 4000) return [];
  }
  const horiz = lines.filter((l) => l.y2 - l.y1 < 0.1 && l.x2 - l.x1 > 8),
    vert = lines.filter((l) => l.x2 - l.x1 < 0.1 && l.y2 - l.y1 > 6);
  const unique = (ns: number[]) =>
    [...new Set(ns.map((n) => Math.round(n * 10) / 10))].sort((a, b) => a - b);
  const ys = unique(horiz.map((l) => l.y1));
  if (ys.length > 200) return [];
  const cells: PdfCell[] = [];
  const covers = (y: number, left: number, right: number) => {
    const spans = horiz
      .filter((l) => Math.abs(l.y1 - y) < 0.3)
      .sort((a, b) => a.x1 - b.x1);
    let end = left;
    for (const l of spans) if (l.x1 <= end + 0.3 && l.x2 >= end) end = l.x2;
    return end >= right - 0.3;
  };
  // Page-global adjacent Y coordinates are not cell boundaries: an unrelated
  // sidebar can introduce a Y between the top/bottom of a genuine closed cell.
  // Enumerate locally closed faces, requiring real strokes on all four sides.
  // Interior strokes split a face; never manufacture a containing table total.
  let work = 0;
  for (let i = 0; i < ys.length - 1; i++) {
    const top = ys[i];
    for (const bottom of ys.slice(i + 1)) {
      if (bottom - top < 6) continue;
      const xs = unique(vert.filter(l => l.y1 <= top + 0.3 && l.y2 >= bottom - 0.3).map(l => l.x1));
      for (let j = 0; j < xs.length - 1; j++) {
        if (++work > 500000) return []; // bounded conservative failure
        const left=xs[j], right=xs[j+1];
        if (right-left<8 || !covers(top,left,right) || !covers(bottom,left,right)) continue;
        const divided = horiz.some(l => l.y1 > top+0.3 && l.y1 < bottom-0.3 && Math.min(l.x2,right)-Math.max(l.x1,left)>0.3);
        if (!divided) cells.push({x:left,y:top,width:right-left,height:bottom-top});
        if (cells.length > 2000) return [];
      }
    }
  }
  return cells;
}
