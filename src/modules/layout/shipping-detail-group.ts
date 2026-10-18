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
