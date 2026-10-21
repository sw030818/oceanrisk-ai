import {shippingCell} from '../layout/shipping-cells';
import type {PdfDocument} from '../documents/schema';
import type {ShippingField} from './schema';
import {nativeCell,cellHeading} from '../layout/shipping-geometry';
import {independentlyVerified} from './effective';
import {verifyShippingField} from './verify';
// These are independently rechecked citation hints, not approved item facts.
// The name must still be recited literally inside this same native row before
// any dependent field can be recovered. No global-number/nearest-row search.
export function recitationOwner(fields:Record<string,ShippingField>,pdf:PdfDocument) {
 const proofs=[];
 for(const role of ['hsCode','quantity']) {
  const f=fields[role],s=f?.original.source;
  if(!f||f.current.status==='user_edited'||!s?.segments?.length||s.fileId!==pdf.id||f.original.value===null)continue;
  const citedPage=pdf.pages.find(p=>p.page===s.page);if(!citedPage||citedPage.textSource==='ocr')continue;
  const links=s.segments.flatMap(segment=>{const b=citedPage.blocks?.find(v=>v.id===segment.blockId),cell=b&&nativeCell(citedPage,b);if(!b||!cell||cellHeading(citedPage,cell)?.role)return[];const link=shippingCell(citedPage,[b],'item');return link?.role===role?[link]:[];});
  if(!links.length||new Set(links.map(v=>JSON.stringify([v.tableId,v.rowId]))).size!==1)continue;
  const tested=verifyShippingField({value:f.original.value,evidence:{page:s.page,blockIds:s.segments.map(v=>v.blockId)}},pdf,role,'item',links[0]);
  const source=tested.current.source,page=pdf.pages.find(p=>p.page===source?.page);
  if(!independentlyVerified(tested)||source?.provenance!=='pdf_text'||!source.layout||!page||page.textSource==='ocr'||!source.segments?.length||source.segments.some(v=>{const b=page.blocks?.find(b=>b.id===v.blockId);return !b||!nativeCell(page,b);}))continue;
  proofs.push({role,source});
 }
 if(!proofs.some(p=>p.role==='hsCode')||!proofs.some(p=>p.role==='quantity'))return;
 if(new Set(proofs.map(p=>JSON.stringify([p.source.page,p.source.layout!.tableId,p.source.layout!.rowId]))).size!==1)return;
 return proofs[0].source.layout;
}
