import type {PdfPage,PdfBlock,PdfCell} from '../documents/schema';
import {nativeCell,cellHeading} from './shipping-geometry';
import {shippingRole} from '../shipping/roles';
import type {TableLink} from './relations';
// A closed description card can own an immediately adjacent sub-row of closed
// HS and quantity fields. Prove containment, a tight border gap, unique owner
// and two distinct semantic child cells; proximity alone is insufficient.
export function nativeDetailGroup(page:PdfPage,block:PdfBlock):TableLink|null {
 const cell=nativeCell(page,block);if(!cell)return null;
 const ownRole=cellHeading(page,cell)?.role;
 if(!ownRole || !["goodsDescription","tradeDescription","hsCode","quantity","quantityUnit"].includes(ownRole))return null;
 const cards=(page.cells??[]).filter(c=>['goodsDescription','tradeDescription'].includes(cellHeading(page,c)?.role??''));
 const groups:{card:PdfCell;members:PdfCell[]}[]=[];
 for(const card of cards){
  const children=(page.cells??[]).filter(c=>c!==card && c.x>=card.x-.4 && c.x+c.width<=card.x+card.width+.4 && c.y>=card.y+card.height-.4 && c.y-(card.y+card.height)<=Math.max(block.height*1.5,8));
  const quantity=children.filter(c=>cellHeading(page,c)?.role==='quantity'),hs=children.filter(c=>cellHeading(page,c)?.role==='hsCode');
  if(quantity.length!==1||hs.length!==1||Math.abs(quantity[0].y-hs[0].y)>.4||Math.abs(quantity[0].height-hs[0].height)>.4)continue;
  const members=[card,...children.filter(c=>Math.abs(c.y-quantity[0].y)<.4&&Math.abs(c.height-quantity[0].height)<.4)];
  if(!members.includes(cell))continue;
  const anchor=(page.blocks??[]).filter(b=>nativeCell(page,b)===card&&!shippingRole(b.text));
  if(!anchor.length||anchor.length>12)continue;
  groups.push({card,members});
 }
 if(groups.length!==1)return null;
 const {card}=groups[0],heading=cellHeading(page,cell);
 if(!heading?.role||heading.blocks.includes(block))return null;
 return{tableId:`p${page.page}:detail${card.x},${card.y}`,rowId:`p${page.page}:detailrow${card.x},${card.y}`,role:heading.role,unit:block.text.match(/\b(?:PCS|EA|KGS?|CTNS?|CARTONS?)\b/i)?.[0]??null};
}

// An official declaration lists each item as a block of labelled boxes
// (란): one row starting with a 품명 box, then rows of 세번부호/순중량/수량
// boxes, until the next 품명 box or a totals row. Bands must touch, the block
// must hold exactly one goods name plus its own HS and quantity boxes, and the
// block is identified by its goods box. No coordinates or expected values.
const itemRoles = ["goodsDescription", "tradeDescription", "hsCode", "quantity", "quantityUnit", "netWeight", "packageCount", "packageUnit", "monetaryAmount"];
export function nativeItemBlock(page: PdfPage, block: PdfBlock): TableLink | null {
  const cell = nativeCell(page, block);
  if (!cell) return null;
  const heading = cellHeading(page, cell);
  if (!heading?.role || !itemRoles.includes(heading.role) || heading.blocks.includes(block)) return null;
  const cells = page.cells ?? [];
  const bands = [...new Map(cells.map((c) => [Math.round(c.y * 2) / 2, c])).keys()].sort((a, b) => a - b)
    .map((y) => cells.filter((c) => Math.abs(c.y - y) < 0.4));
  const roleOf = (c: PdfCell) => cellHeading(page, c)?.role ?? null;
  const startsItem = (band: PdfCell[]) => band.filter((c) => roleOf(c) === "goodsDescription").length === 1;
  const closes = (band: PdfCell[]) => band.some((c) => /^total/.test(roleOf(c) ?? ""));
  const i = bands.findIndex((band) => band.includes(cell));
  if (i < 0) return null;
  let start = i;
  while (start >= 0 && !startsItem(bands[start])) {
    if (closes(bands[start]) || !bands[start].some((c) => itemRoles.includes(roleOf(c) ?? ""))) return null;
    start--;
  }
  if (start < 0) return null;
  const members: PdfCell[] = [];
  for (let k = start; k < bands.length; k++) {
    const band = bands[k];
    if (k > start && (startsItem(band) || closes(band) || !band.some((c) => itemRoles.includes(roleOf(c) ?? "")))) break;
    const top = Math.min(...band.map((c) => c.y)), prevBottom = k > start ? Math.max(...bands[k - 1].map((c) => c.y + c.height)) : top;
    if (top - prevBottom > Math.max(block.height * 1.5, 8)) break;
    members.push(...band);
  }
  if (!members.includes(cell)) return null;
  const roles = members.map(roleOf);
  if (roles.filter((r) => r === "goodsDescription").length !== 1 || !roles.includes("hsCode") || !roles.includes("quantity")) return null;
  if (roles.filter((r) => r === "hsCode").length !== 1) return null;
  const card = members.find((c) => roleOf(c) === "goodsDescription")!;
  return { tableId: `p${page.page}:item${card.x},${card.y}`, rowId: `p${page.page}:itemrow${card.x},${card.y}`, role: heading.role, unit: block.text.match(/\b(?:PCS|EA|SET|PR|KGS?|CTNS?|CT|CARTONS?)\b/i)?.[0] ?? null };
}
