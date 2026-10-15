import type { PdfPage, PdfBlock, PdfCell } from "../documents/schema";
import { numericTokens } from "../evidence/numbers";
import { physicalLines, spanText } from "./physical-spans";
import { countAtoms } from "../shipping/count-atoms";
import { shippingRole } from "../shipping/roles";
import type { EntityScope } from "./shipping-cells";
import type { TableLink } from "./relations";
const inside = (c: PdfCell, b: PdfBlock) =>
  b.x >= c.x - 0.8 &&
  b.x + b.width <= c.x + c.width + 0.8 &&
  b.y >= c.y - 0.8 &&
  b.y + b.height <= c.y + c.height + 0.8;
export function nativeCell(page: PdfPage, b: PdfBlock) {
  return page.cells
    ?.filter((c) => inside(c, b))
    .sort((a, b) => a.width * a.height - b.width * b.height)[0];
}
export function packageGoodsContext(page: PdfPage, b: PdfBlock) {
  const cell = nativeCell(page, b);
  if (!cell) return false;
  const rows = new Map<number, string[]>();
  for (const v of body(page, cell)) {
    const xs = rows.get(v.row) ?? [];
    xs.push(v.text);
    rows.set(v.row, xs);
  }
  const atoms = [...rows.values()].flatMap((xs) => countAtoms(xs.join(" ")));
  return (
    atoms.some((a) => a.role === "packageCount") &&
    atoms.some((a) => a.role === "quantity")
  );
}
const body = (p: PdfPage, c: PdfCell) =>
  (p.blocks ?? [])
    .filter((b) => inside(c, b))
    .sort((a, b) => a.y - b.y || a.x - b.x);
type Heading = ReturnType<typeof computeCellHeading>;
const headingCache = new WeakMap<PdfPage, WeakMap<PdfCell, { signature: string; value: Heading }>>();
export function cellHeading(page: PdfPage, cell: PdfCell): Heading {
  let cache = headingCache.get(page);
  if (!cache) { cache = new WeakMap(); headingCache.set(page, cache); }
  // PDFs are immutable in the pipeline, but editors/tests may alter blocks.
  // Include content and geometry so a cached heading never proves stale text.
  const signature = JSON.stringify([(page.cells ?? []).map(c => [c.x,c.y,c.width,c.height]), (page.blocks ?? []).map(b => [b.id,b.text,b.x,b.y,b.width,b.height,b.row])]);
  const previous = cache.get(cell);
  if (previous?.signature === signature) return previous.value;
  const value = computeCellHeading(page, cell);
  cache.set(cell, { signature, value });
  return value;
}
function computeCellHeading(page: PdfPage, cell: PdfCell) {
  const bs = body(page, cell);
  if (!bs.length) return null;
  const first = bs[0];
  // Repeated data units such as CTNS may lexically resemble a quantity
  // heading. A real aligned label above establishes this as a data cell;
  // it must not restart a table halfway through its actual rows.
  if (
    /^(?:CTNS?|CARTONS?|PKGS?)$/i.test(first.text.trim()) &&
    (page.cells ?? []).some(
      (c) =>
        c.y + c.height <= cell.y + 0.4 &&
        Math.abs(c.x - cell.x) < 0.4 &&
        Math.abs(c.width - cell.width) < 0.4 &&
        body(page, c).some(
          (b) =>
            shippingRole(b.text) &&
            !/^(?:CTNS?|CARTONS?|PKGS?)$/i.test(b.text.trim()),
        ),
    )
  )
    return null;
  const lines = physicalLines(page, bs);
  let head = lines[0] ?? [first];
  // A heading may wrap across two/three physical lines; stop at the first
  // recognized semantic label or before numeric data, not at a fixed page Y.
  for (const line of lines.slice(1, 3)) {
    if (
      shippingRole(spanText(head)) ||
      line[0].y - head.at(-1)!.y >
        Math.max(first.height, line[0].height) * 2.5 ||
      line.some(
        (b) => numericTokens(b.text).length && !/^\(\d+\)$/.test(b.text.trim()),
      )
    )
      break;
    head = [...head, ...line];
  }
  const whole = spanText(head);
  // Shared Container/Seal column: container identifier establishes the row;
  // the Seal requires its own literal SEAL label within that same closed cell.
  const cleaned = whole.replace(/\s*&\s*Seal No\.?$/i, "");
  return {
    role:
      shippingRole(whole) ?? shippingRole(cleaned) ?? shippingRole(first.text),
    blocks: head,
    cell,
  };
}
export function geometricRole(page: PdfPage, b: PdfBlock): string | null {
  const cell = nativeCell(page, b);
  if (!cell) return null;
  const semanticHeadings = new Set(
    body(page, cell)
      .map((b) => shippingRole(b.text))
      .filter(Boolean),
  );
  const heading = semanticHeadings.size > 2 ? null : cellHeading(page, cell);
  const same = body(page, cell)
    .filter((v) => v.row === b.row && v.x + v.width <= b.x + 0.5)
    .sort((a, b) => b.x - a.x)[0];
  if (same && shippingRole(same.text.replace(/:$/, "")))
    return shippingRole(same.text.replace(/:$/, ""));
  if (/^\(?HS\s+[0-9][0-9. -]*\)?$/i.test(b.text)) return "hsCode";
  const inline = b.text.match(/^([^:]+):\s*.+$/);
  if (inline && shippingRole(inline[1])) return shippingRole(inline[1]);
  if (
    heading?.role &&
    b.y > Math.max(...heading.blocks.map((h) => h.y + h.height)) - 0.5
  ) {
    if (
      heading.role === "packageCount" &&
      packageGoodsContext(page, b) &&
      /\b(?:PCS|EA|PIECES?)\)?\s*$/i.test(
        body(page, cell)
          .filter((v) => v.row === b.row)
          .map((v) => v.text)
          .join(" "),
      )
    )
      return "quantity";
    return heading.role;
  }
  // Separate header/data cells, whose REAL borders align (centered text allowed).
  const candidates = (page.cells ?? [])
    .filter(
      (c) =>
        Math.abs(c.x - cell.x) < 0.4 &&
        Math.abs(c.width - cell.width) < 0.4 &&
        c.y + c.height <= cell.y + 0.4,
    )
    .sort((a, b) => b.y - a.y);
  for (const c of candidates) {
    const h = cellHeading(page, c);
    if (!h?.role) continue;
    // A populated data cell between the header and this row is fine for a table;
    // a later semantic heading terminates the table.
    if (
      (page.cells ?? []).some(
        (mid) =>
          mid.y > c.y &&
          mid.y < cell.y &&
          Math.abs(mid.x - cell.x) < 0.4 &&
          cellHeading(page, mid)?.role,
      )
    )
      return null;
    return h.role;
  }
  return null;
}
export function nativeTableLink(
  page: PdfPage,
  blocks: PdfBlock[],
  scope: EntityScope,
): TableLink | null {
  if (scope === "document" || !blocks.length) return null;
  const first = blocks[0],
    cell = nativeCell(page, first);
  if (!cell || blocks.some((b) => nativeCell(page, b) !== cell)) return null;
  const role = geometricRole(page, first);
  if (!role) return null;
  const anchors =
    scope === "item"
      ? ["goodsDescription", "tradeDescription"]
      : scope === "container"
        ? ["containerNumber"]
        : ["houseBlNumber"];
  const bands = (page.cells ?? []).filter(
    (c) =>
      Math.abs(c.y - cell.y) < 0.4 && Math.abs(c.height - cell.height) < 0.4,
  );
  // A genuine row needs its own anchor and numeric/identifier columns; a form
  // grid of unrelated standalone fields must not become a product table.
  const anchor = bands.find((c) =>
    body(page, c).some(
      (b) =>
        anchors.includes(geometricRole(page, b) ?? "") && !shippingRole(b.text),
    ),
  );
  if (!anchor || bands.length < 2) return null;
  if (
    scope === "item" &&
    !bands.some(
      (c) =>
        c !== anchor &&
        body(page, c).some((b) =>
          [
            "quantity",
            "packageCount",
            "grossWeight",
            "netWeight",
            "hsCode",
            "containerNumber",
          ].includes(geometricRole(page, b) ?? ""),
        ),
    )
  )
    return null;
  if (
    scope === "cargo" &&
    !bands.some((c) =>
      body(page, c).some((b) => geometricRole(page, b) === "containerNumber"),
    )
  )
    return null;
  const ab = body(page, anchor).filter(
    (b) =>
      anchors.includes(geometricRole(page, b) ?? "") && !shippingRole(b.text),
  );
  if (
    scope !== "item" &&
    ab.filter((b) => /^[A-Z0-9][A-Z0-9-]{5,}$/i.test(b.text.trim())).length !==
      1
  )
    return null;
  const numericRows = new Map<string, Set<number>>();
  for (const c of bands)
    for (const b of body(page, c)) {
      const r = geometricRole(page, b);
      if (
        r &&
        ["quantity", "packageCount", "grossWeight", "netWeight"].includes(r) &&
        !shippingRole(b.text) &&
        numericTokens(b.text).length
      ) {
        const rows = numericRows.get(r) ?? new Set<number>();
        rows.add(b.row);
        numericRows.set(r, rows);
      }
    }
  if ([...numericRows.values()].some((rows) => rows.size > 1)) return null;
  const headings = bands
    .map((c) => cellHeading(page, c))
    .filter((h) => h?.role);
  const inlineHeaders = headings.some((h) =>
    h!.blocks.some((b) => b.y < first.y - 2),
  );
  const headerY = inlineHeaders
    ? cell.y
    : Math.max(
        ...(page.cells ?? [])
          .filter(
            (c) =>
              c.y < cell.y &&
              Math.abs(c.x - cell.x) < 0.4 &&
              cellHeading(page, c)?.role,
          )
          .map((c) => c.y),
      );
  if (!Number.isFinite(headerY)) return null;
  const unit =
    first.text.match(/\b(KGS?|PCS|EA|CTNS?|CARTONS?)\b/i)?.[1] ?? null;
  return {
    tableId: `p${page.page}:box${headerY}`,
    rowId: `p${page.page}:boxrow${cell.y}`,
    role,
    unit,
  };
}
export function nativeDocumentField(page: PdfPage, b: PdfBlock) {
  const c = nativeCell(page, b),
    h = c && cellHeading(page, c);
  if (c && h?.role && ["quantity", "packageCount", "grossWeight", "netWeight", "totalQuantity", "totalPackageCount", "totalGrossWeight", "totalNetWeight"].includes(h.role)) {
    const occurrences = new Map<string, number>();
    for (const line of physicalLines(page, body(page, c))) {
      if (line.some(v => h.blocks.includes(v))) continue;
      const text = spanText(line);
      if (/^(?:HS|SEAL|CONTAINER)\b/i.test(text.trim())) continue;
      const atoms = countAtoms(text);
      const role = h.role.replace(/^total([A-Z])/, (_, x: string) => x.toLowerCase());
      if (!["quantity", "packageCount", "grossWeight", "netWeight"].includes(role)) continue;
      for (const r of atoms.length ? atoms.map(a => a.role) : numericTokens(text).map(() => role))
        occurrences.set(r, (occurrences.get(r) ?? 0) + 1);
    }
    if ([...occurrences.values()].some(n=>n>1)) return false;
  }
  return (
    !!h?.role &&
    h.blocks.some((v) => v.y < b.y - 2) &&
    (geometricRole(page, b) === h.role ||
      (["packageCount", "totalPackageCount"].includes(h.role) &&
        countAtoms(
          body(page, c!)
            .filter((v) => v.row === b.row)
            .map((v) => v.text)
            .join(" "),
        ).some((a) => a.role === "quantity")))
  );
}
