// Synthetic trade documents; deliberately different layouts, never production templates.
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { extractPdfText } from '../../src/modules/pdf/extract';
import type { ExtractedDocument, PdfDocument, PdfBlock } from '../../src/modules/documents/schema';
export const layoutCases = [
  { id:'portrait-landscape', title:'Portrait Invoice / landscape PL', outcome:'match' },
  { id:'party-tables', title:'Separate seller/buyer tables and stacked labels', outcome:'match' },
  { id:'mixed-packaging', title:'Adjacent CTNS and product QTY columns', outcome:'match' },
  { id:'quantity-mismatch', title:'Different product quantities / reordered columns', outcome:'mismatch' },
  { id:'reference-conflict', title:'Conflicting verified purchase orders', outcome:'unverifiable' },
  { id:'wrapped-description', title:'Wrapped product cells and multiline evidence', outcome:'match' },
  { id:'missing-reference', title:'Missing order/invoice references', outcome:'unverifiable' },
] as const;
export type LayoutCaseId = typeof layoutCases[number]['id'];
export async function layoutFixture(id: LayoutCaseId, type: 'invoice' | 'packing_list') {
  const index=layoutCases.findIndex(c=>c.id===id);
  const landscape=type==='packing_list' && index%2===0;
  const pdf=await PDFDocument.create();const font=await pdf.embedFont(StandardFonts.Helvetica);
  const page=pdf.addPage(landscape?[842,595]:[595,842]);
  const height=page.getHeight(), shift=index*2, size=10+index%2;
  const draw=(text:string,x:number,top:number)=>page.drawText(text,{x:x+shift,y:height-top,size,font});
  draw(type==='invoice'?'COMMERCIAL INVOICE':'PACKING LIST',40,35);
  const seller='Pacific Gateway Trading Co., Ltd.',buyer='Harbor Horizon Imports Ltd.';
  if(index===0) { draw('Seller: '+seller,40,65);draw('Buyer: '+buyer,40,85); }
  else { draw('EXPORTER / SELLER',40,65);draw('BUYER / CONSIGNEE',315,65);draw(seller,40,87);draw(buyer,315,87); }
  const order=id==='reference-conflict' && type==='packing_list'?'PO-DIFFERENT-261002':'PO-HHG-261001';
  const missing=id==='missing-reference' && type==='packing_list';
  if(!missing) {
    draw('Purchase Order',40,120);
    draw(order,index%2===0?180:40,index%2===0?120:138);
  }
  draw(type==='invoice'?'Invoice No':'Document',40,165);
  const documentNumber=type==='invoice'?'INV-261001':'PL-261001';
  draw(documentNumber,180,165);
  if(type==='packing_list' && !missing) { draw('Invoice Reference',40,185);draw('INV-261001',180,185); }
  draw('Full shipment',40,215);
  const qtyX=index===3?350:295, unitX=index===3?425:435, cartonX=index===3?490:365;
  draw('Description',40,260);draw('QTY',qtyX,260);draw('UOM',unitX,260);draw('CTNS',cartonX,260);
  const quantities=[id==='quantity-mismatch'&&type==='packing_list'?580:600,400];
  const descriptions=['Stainless Steel Bolts','Brass Nuts'];
  const wrapped=id==='wrapped-description';
  draw(wrapped?'Stainless Steel':descriptions[0],40,285);
  if(wrapped)draw('Bolts',40,303);
  draw(descriptions[1],40,330);
  quantities.forEach((qty,i)=>{const top=i?330:285;draw(String(qty),qtyX,top);draw('PCS',unitX,top);draw(i?'12':'20',cartonX,top);});
  const bytes=await pdf.save();
  const pages=await extractPdfText(bytes);
  const source:PdfDocument={id:`${id}-${type}`,fileName:`synthetic-${id}-${type}.pdf`,pages};
  const blocks=pages[0].blocks!;
  const find=(text:string, occurrence=0):PdfBlock=>{
    const match=blocks.filter(b=>b.text===text).sort((a,b)=>a.row-b.row)[occurrence];
    if(!match)throw new Error('Synthetic fixture block not extracted');return match;
  };
  const evidence=(selected:PdfBlock[])=>({page:1,quote:selected.map(b=>b.text).join('\n'),segments:selected.map(b=>({blockId:b.id,quote:b.text}))});
  const field=<T extends string|number>(value:T,selected:PdfBlock[])=>({value,evidence:evidence(selected)});
  const empty={value:null,evidence:null};
  const ref=missing?empty:field(order,[find('Purchase Order'),find(order)]);
  const data:ExtractedDocument={
    type,seller:index===0?field(seller,[find('Seller: '+seller)]):field(seller,[find('EXPORTER / SELLER'),find(seller)]),
    buyer:index===0?field(buyer,[find('Buyer: '+buyer)]):field(buyer,[find('BUYER / CONSIGNEE'),find(buyer)]),
    documentNumber:field(documentNumber,[find(type==='invoice'?'Invoice No':'Document'),find(documentNumber)]),
    transactionReference:ref,purchaseOrder:ref,
    invoiceReference:type==='packing_list'&&!missing?field('INV-261001',[find('Invoice Reference'),find('INV-261001')]):empty,
    partialShipment:field('no' as const,[find('Full shipment')]),currency:empty,totalAmount:empty,
    items:descriptions.map((name,i)=>({
      description:field(name,[find('Description'),...(wrapped&&!i?[find('Stainless Steel'),find('Bolts')]:[find(name)])]),
      quantity:field(quantities[i],[find('QTY'),find(String(quantities[i]))]),
      unit:field('PCS',[find('UOM'),find('PCS',i)]),netWeight:empty,grossWeight:empty,weightUnit:empty,amount:empty,
    })),
  };
  return {pdf:source,data,bytes,makeFile:()=>new File([new Uint8Array(bytes)],source.fileName,{type:'application/pdf'})};
}
