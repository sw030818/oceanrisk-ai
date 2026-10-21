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
type HeadingSnapshot = {
  blocks: { ref: PdfBlock; id: string; text: string; x: number; y: number; width: number; height: number; row: number }[];
  cells: { ref: PdfCell; x: number; y: number; width: number; height: number }[];
  headings: Map<PdfCell, Heading>;
  page: number; source: PdfPage['textSource'];
};
const headingCache = new WeakMap<PdfPage, HeadingSnapshot>();
function unchangedHeadingInputs(page: PdfPage, snapshot: HeadingSnapshot) {
  const bs = page.blocks ?? [], cs = page.cells ?? [];
  if (page.page !== snapshot.page || page.textSource !== snapshot.source || bs.length !== snapshot.blocks.length || cs.length !== snapshot.cells.length) return false;
  // Exact scalar comparisons avoid rebuilding/serializing the complete cell
  // geometry on every heading lookup. In-place edits and replaced objects both
  // invalidate the page; no document text is retained beyond this weak key.
  for (let i = 0; i < bs.length; i++) {
    const b = bs[i], v = snapshot.blocks[i];
    if (b !== v.ref || b.id !== v.id || b.text !== v.text || b.x !== v.x || b.y !== v.y || b.width !== v.width || b.height !== v.height || b.row !== v.row) return false;
  }
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i], v = snapshot.cells[i];
    if (c !== v.ref || c.x !== v.x || c.y !== v.y || c.width !== v.width || c.height !== v.height) return false;
  }
  return true;
}
export function cellHeading(page: PdfPage, cell: PdfCell): Heading {
  let snapshot = headingCache.get(page);
  if (!snapshot || !unchangedHeadingInputs(page, snapshot)) {
    snapshot = {
      blocks: (page.blocks ?? []).map(b => ({...b, ref: b})),
      cells: (page.cells ?? []).map(c => ({...c, ref: c})),
      headings: new Map(), page: page.page, source: page.textSource,
    };
    headingCache.set(page, snapshot);
  }
  // Arbitrary query rectangles are not native page cells. Never cache them by
  // identity without their own mutation signature.
  if (!(page.cells ?? []).includes(cell)) return computeCellHeading(page, cell, body(page, cell));
  if (snapshot.headings.has(cell)) return snapshot.headings.get(cell)!;
  const value = computeCellHeading(page, cell, body(page, cell));
  snapshot.headings.set(cell, value);
  return value;
}
function computeCellHeading(page: PdfPage, cell: PdfCell, bs: PdfBlock[]) {
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
// A label-only closed cell and its immediately adjoining value cell form a
// key/value pair. Full shared edges prove the association; proximity, titles,
// data units and competing adjacent labels do not. No template coordinates.
export function nativeKeyValue(page: PdfPage, b: PdfBlock) {
  const cell=nativeCell(page,b);if(!cell || shippingRole(b.text))return null;
  const pairs:{role:string;label:PdfCell;vertical:boolean}[]=[];
  for(const label of page.cells??[]) {
    const horizontal=Math.abs(label.y-cell.y)<.4 && Math.abs(label.height-cell.height)<.4 && Math.abs(label.x+label.width-cell.x)<.4;
    const vertical=Math.abs(label.x-cell.x)<.4 && Math.abs(label.width-cell.width)<.4 && Math.abs(label.y+label.height-cell.y)<.4;
    if(!horizontal&&!vertical)continue;
    const bs=body(page,label),text=spanText(bs),role=shippingRole(text);
    if(!role || !bs.length || bs.length>6 || text.length>120 || /^(?:CTNS?|CARTONS?|PKGS?|PCS|KGS?)$/i.test(text.trim()))continue;
    pairs.push({role,label,vertical});
  }
  return pairs.length===1?pairs[0]:null;
}
function keyValueDocumentField(page:PdfPage,b:PdfBlock) {
  const pair=nativeKeyValue(page,b);if(!pair)return false;
  if(!pair.vertical)return true;
  const peers=(page.cells??[]).filter(c=>Math.abs(c.y-pair.label.y)<.4&&Math.abs(c.height-pair.label.height)<.4);
  const roles=peers.map(c=>shippingRole(spanText(body(page,c)))).filter(Boolean);
  // Genuine item/container/cargo headers remain entity rows, not root totals.
  return !roles.some(r=>["goodsDescription","tradeDescription","containerNumber"].includes(r!)) &&
    !(roles.includes("houseBlNumber") && roles.some(r=>["quantity","packageCount","grossWeight","hsCode"].includes(r!)));
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
  const paired=nativeKeyValue(page,b);
  if(paired)return paired.role;
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
  // A closing aggregate band is not another item/container/cargo row. Read
  // actual labels in aligned cells; no template coordinates or expected values.
  if(!bands.some(c=>anchors.includes(cellHeading(page,c)?.role??"")) && bands.some(c=>{
    const lines=physicalLines(page,body(page,c));
    return lines.some((_,i)=>[1,2,3].some(n=>
      shippingRole(spanText(lines.slice(i,i+n).flat()))?.startsWith("total")));
  }))return null;
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
export function nativeDocumentFieldAmbiguous(
  page: PdfPage,
  b: PdfBlock,
  role?: string,
) {
  const c = nativeCell(page, b), paired = nativeKeyValue(page,b),
    direct = c && cellHeading(page, c),
    h = direct?.role ? direct : paired ? {role:paired.role,blocks:[] as PdfBlock[],cell:paired.label} : null;
  if (!c || !h?.role) return false;
  const base = (r: string) =>
    r
      .replace(/^total([A-Z])/, (_, x: string) => x.toLowerCase())
      .replace(/^packageUnit$/, "packageCount")
      .replace(/Unit$/, "");
  const wanted = base(role ?? geometricRole(page, b) ?? h.role);
  if (
    !["quantity", "packageCount", "grossWeight", "netWeight"].includes(wanted)
  )
    return false;
  let active = base(h.role),
    count = 0;
  for (const line of physicalLines(page, body(page, c))) {
    if (line.some((v) => h.blocks.includes(v))) continue;
    const text = spanText(line);
    if (/^(?:HS|SEAL|CONTAINER)\b/i.test(text.trim())) continue;
    const label =
      shippingRole(text) ?? shippingRole(text.replace(/[:\s]*[0-9].*$/, ""));
    if (label) active = base(label);
    const atoms = countAtoms(text);
    const roles = atoms.length
      ? atoms.map((a) => a.role)
      : numericTokens(text).map(() => active);
    count += roles.filter((r) => r === wanted).length;
  }
  return count > 1;
}
export function nativeDocumentField(page: PdfPage, b: PdfBlock) {
  if(nativeDocumentFieldAmbiguous(page,b))return false;
  if(keyValueDocumentField(page,b))return true;
  const c = nativeCell(page, b),
    h = c && cellHeading(page, c);
  if (nativeDocumentFieldAmbiguous(page, b)) return false;
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
