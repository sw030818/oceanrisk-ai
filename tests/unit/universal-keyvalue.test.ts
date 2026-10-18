import{it,expect}from'vitest';import{readFile}from'node:fs/promises';import{PDFDocument,StandardFonts}from'pdf-lib';
import{extractPdfText}from'../../src/modules/pdf/extract';import{verifyShippingField}from'../../src/modules/shipping/verify';import{recoverNative}from'../../src/modules/shipping/recovery';import{groundShipping,emptyShippingWire}from'../../src/modules/shipping/ground';
async function retired(id:string){return{id:'retired-'+id,fileName:'synthetic-retired.pdf',pages:await extractPdfText(new Uint8Array(await readFile('tests/fixtures/universal/pdf/universal-'+id+'/01.pdf')),undefined,false,true)};}
function candidate(p:Awaited<ReturnType<typeof retired>>,text:string,value:string|number=text){const b=p.pages[0].blocks!.find(b=>b.text===text)!;expect(b).toBeTruthy();return{value,evidence:{page:1,blockIds:[b.id]}};}
it('links label-only and value-only adjoining closed cells without borrowing another field',async()=>{
 const p=await retired('08');for(const[role,text]of [['houseBlNumber','SYN-UNIV-008'],['shipper','Synthetic Origin 8 Ltd'],['portOfLoading','HAMBURG'],['portOfDischarge','SINGAPORE'],['shipmentScope','full shipment']])expect(verifyShippingField(candidate(p,text),p,role).current.status).toBe('verified');
 expect(verifyShippingField(candidate(p,'HAMBURG'),p,'portOfDischarge').current.status).not.toBe('verified');
 const bad=structuredClone(p);const cell=bad.pages[0].cells!.find(c=>c.x===220&&c.y===207)!;cell.x+=6;cell.width-=6;
 expect(verifyShippingField(candidate(bad,'HAMBURG'),bad,'portOfLoading').current.status).not.toBe('verified');
});
it('keeps an unrelated closed cargo table from rejecting actual borderless port and total-unit labels',async()=>{
 const p=await retired('07');for(const[role,text,value]of [['portOfLoading','BUSAN','BUSAN'],['portOfDischarge','ROTTERDAM','ROTTERDAM'],['packageUnit','24 CTN','CTN'],['grossWeightUnit','300 KG','KG']])expect(verifyShippingField(candidate(p,text,value),p,role).current.status).toBe('verified');
 expect(verifyShippingField(candidate(p,'300 KG','KG'),p,'packageUnit').current.status).not.toBe('verified');
});
it('never recovers a caption below the document title as an HBL reference',async()=>{
 const p=await retired('08'),wire=emptyShippingWire('house_bl');wire.typeEvidence=candidate(p,'HOUSE BILL OF LADING').evidence;wire.fields.houseBlNumber={...candidate(p,'SYN-UNIV-008'),value:'SYN-UNIV-008'};const d=recoverNative(groundShipping(wire,p,'house_bl'),p);
 expect(d.classificationStatus).toBe('classified');expect(d.fields.houseBlNumber.original.value).toBe('SYN-UNIV-008');expect(d.fields.houseBlNumber.current.value).toBe('SYN-UNIV-008');
 const caption=p.pages[0].blocks!.find(b=>b.text.includes('NOT A BUSINESS'))!;
 expect(verifyShippingField(candidate(p,caption.text),p,'houseBlNumber').current.status).not.toBe('verified');
});
it('proves vertically adjoining key/value cells but keeps genuine product-table quantities out of root totals',async()=>{
 const f=await PDFDocument.create(),page=f.addPage([700,800]),font=await f.embedFont(StandardFonts.Helvetica);
 const cell=(label:string,x:number,y:number,w:number,h:number)=>{page.drawRectangle({x,y,width:w,height:h,borderWidth:1});page.drawText(label,{x:x+5,y:y+h-15,size:10,font});};
 cell('Port of Loading',30,690,220,25);cell('BUSAN',30,650,220,40);
 for(const[label,x,w]of [['Goods Description',30,250],['HS Code',280,120],['Quantity',400,140]]as const)cell(label,x,500,w,25);
 for(const[label,x,w]of [['SENSOR MODULE MODEL 10000',30,250],['9031.80',280,120],['600 PCS',400,140]]as const)cell(label,x,460,w,40);
 const p={id:'native-vertical',fileName:'synthetic.pdf',pages:await extractPdfText(await f.save(),undefined,false,true)};
 expect(verifyShippingField(candidate(p,'BUSAN'),p,'portOfLoading').current.status).toBe('verified');
 const item=verifyShippingField(candidate(p,'SENSOR MODULE MODEL 10000'),p,'goodsDescription','item');expect(item.current.status).toBe('verified');
 expect(verifyShippingField(candidate(p,'600 PCS',600),p,'quantity','item',item.current.source!.layout!).current.status).toBe('verified');
 expect(verifyShippingField(candidate(p,'600 PCS',600),p,'quantity').current.status).not.toBe('verified');
});
