import{it,expect}from'vitest';import{readFile}from'node:fs/promises';
import{extractPdfText}from'../../src/modules/pdf/extract';
import{groundShipping,emptyShippingWire}from'../../src/modules/shipping/ground';
import{recoverNative}from'../../src/modules/shipping/recovery';
async function blank(id:string){const pdf={id:'synthetic-missing-'+id,fileName:'synthetic.pdf',pages:await extractPdfText(new Uint8Array(await readFile('tests/fixtures/universal/pdf/'+id+'/03.pdf')),undefined,false,true)};const b=pdf.pages[0].blocks!.find(b=>b.text==='HOUSE MANIFEST')!;const wire=emptyShippingWire('house_manifest');wire.typeEvidence={page:1,blockIds:[b.id]};return{pdf,doc:groundShipping(wire,pdf,'house_manifest')};}
it('recovers the actual omitted native goods row and model conflict without inventing an AI value or container',async()=>{
 const{pdf,doc}=await blank('fault-model'),d=recoverNative(doc,pdf);
 expect(doc.items).toEqual([]);expect(d.items).toHaveLength(1);
 const f=d.items[0].fields;
 expect(f.goodsDescription.original.value).toBeNull();expect(f.goodsDescription.current.value).toContain('MODEL NG95');
 expect(f.goodsDescription.recovery?.failureCode).toBe('MISSING_EXTRACTION');expect(f.quantity.current.value).toBe(84);
 expect(f.quantity.current.status).toBe('verified');expect(f.quantity.original.value).toBeNull();
 expect(d.containers).toEqual([]);expect(d.fields.goodsDescription.current.value).toBeNull();
});
it('keeps independent rows and their own quantities when an entire multi-item goods collection is missing',async()=>{
 const{pdf,doc}=await blank('universal-04'),d=recoverNative(doc,pdf);
 expect(d.items).toHaveLength(2);expect(d.items.map(i=>i.fields.quantity.current.value)).toEqual([240,65]);
 expect(new Set(d.items.map(i=>i.fields.goodsDescription.current.source?.layout?.rowId)).size).toBe(2);
});
it('does not seed rows from OCR or after a user edit',async()=>{
 const{pdf,doc}=await blank('fault-model'),ocr=structuredClone(pdf);ocr.pages[0].textSource='ocr';
 expect(recoverNative(doc,ocr).items).toEqual([]);
 doc.fields.packageCount.current={...doc.fields.packageCount.current,value:999,status:'user_edited',verificationCode:'user_edited'};
 const d=recoverNative(doc,pdf);expect(d.items).toEqual([]);expect(d.fields.packageCount.current.value).toBe(999);
});
it('does not replace existing AI rows or seed a collection from a borderless or unclassified source',async()=>{
 const{pdf,doc}=await blank('fault-model'),d=recoverNative(doc,pdf);d.items[0].fields.goodsDescription.current={...d.items[0].fields.goodsDescription.current,value:null,status:'user_edited',verificationCode:'user_edited'};
 expect(recoverNative(d,pdf).items[0].fields.goodsDescription.current.value).toBeNull();
 const noCells=structuredClone(pdf);noCells.pages[0].cells=[];expect(recoverNative(doc,noCells).items).toEqual([]);
 doc.classificationStatus='needs_review';expect(recoverNative(doc,pdf).items).toEqual([]);
});
