import{it,expect}from'vitest';
import{readFile}from'node:fs/promises';
import{extractPdfText}from'../../src/modules/pdf/extract';
import{verifyShippingField}from'../../src/modules/shipping/verify';
import{shippingCell}from'../../src/modules/layout/shipping-cells';
import{nativeCell}from'../../src/modules/layout/shipping-geometry';
import{recoverNative}from'../../src/modules/shipping/recovery';
import{shipping31Fixture}from'../fixtures/shipping31';
async function pdf(id:string,n:string){const pages=await extractPdfText(new Uint8Array(await readFile('tests/fixtures/universal/pdf/'+id+'/'+n+'.pdf')),undefined,false,true);return{id:'synthetic-'+id+n,fileName:'synthetic.pdf',pages};}
it('keeps every locally closed staggered form cell despite unrelated sidebar Y coordinates',async()=>{
 const p=await pdf('universal-02','02');const bs=p.pages[0].blocks!;
 for(const text of ['14 CTN','150 KG','HAMBURG']){const b=bs.find(b=>b.text===text)!;expect(nativeCell(p.pages[0],b)).toBeTruthy();}
});
it('recognizes a container column inside an HBL cargo table without changing the cargo owner',async()=>{
 const p=await pdf('universal-01','03'),b=p.pages[0].blocks!.find(b=>b.text==='EVLU1000000')!;
 const c=shippingCell(p.pages[0],[b],'container'),h=shippingCell(p.pages[0],[b],'cargo');
 expect(c).toBeTruthy();expect(h).toBeTruthy();expect(c?.rowId).toBe(h?.rowId);
 expect(verifyShippingField({value:b.text,evidence:{page:1,blockIds:[b.id]}},p,'containerNumber','container').current.status).toBe('verified');
});
it('proves stacked description/HS/quantity ownership without promoting item data to root totals',async()=>{
 const p=await pdf('universal-02','02'),bs=p.pages[0].blocks!,g=bs.find(b=>b.text.startsWith('네트워크 게이트웨이'))!,q=bs.find(b=>b.text==='84 PCS'&&b.x>500)!;
 const anchor=verifyShippingField({value:g.text,evidence:{page:1,blockIds:[g.id]}},p,'goodsDescription','item');
 expect(anchor.current.status).toBe('verified');
 const owner=anchor.current.source!.layout!;
 expect(owner.tableId).toContain(':detail');
 for(const[role,value]of [['quantity',84],['quantityUnit','PCS']]as const){
  expect(verifyShippingField({value,evidence:{page:1,blockIds:[q.id]}},p,role,'item',owner).current.status).toBe('verified');
  expect(verifyShippingField({value,evidence:{page:1,blockIds:[q.id]}},p,role).current.status).not.toBe('verified');
  expect(verifyShippingField({value,evidence:{page:1,blockIds:[q.id]}},p,role,'item',{...owner,rowId:'other'}).current.status).not.toBe('verified');
 }
});
it('retains OCR and user-edit protections on newly recognized layout cells',async()=>{
 const f=await shipping31Fixture('house_bl'),d=structuredClone(f.document);d.fields.packageCount.current={...d.fields.packageCount.current,value:101,status:'user_edited',verificationCode:'user_edited'};
 expect(recoverNative(d,f.pdf).fields.packageCount.current.status).toBe('user_edited');
 const p=await pdf('universal-02','02');p.pages[0].textSource='ocr';const b=p.pages[0].blocks!.find(b=>b.text==='84 PCS'&&b.x>500)!;
 expect(verifyShippingField({value:84,evidence:{page:1,blockIds:[b.id]}},p,'quantity','item').current.status).not.toBe('verified');
});
it('retains independent native HBL scope when a table has only container AI records',async()=>{
 const {groundShipping,emptyShippingWire}=await import('../../src/modules/shipping/ground');
 const p=await pdf('universal-05','03'),bs=p.pages[0].blocks!;
 const candidate=(text:string)=>{const b=bs.find(b=>b.text===text)!;expect(b).toBeTruthy();return{value:text,evidence:{page:1,blockIds:[b.id]}};};
 const wire=emptyShippingWire('house_manifest');wire.typeEvidence=candidate('HOUSE MANIFEST').evidence;wire.fields.houseBlNumber=candidate('SYN-UNIV-005');
 wire.containers=['EVLU1000040','EVLU1000041'].map((id,i)=>({containerNumber:candidate(id),sealNumber:candidate('EVAL-SEAL-05-'+(i+1)),sealNumbers:[],packageCount:{value:null,evidence:null},packageUnit:{value:null,evidence:null},grossWeight:{value:null,evidence:null},weightUnit:{value:null,evidence:null}}));
 const d=groundShipping(wire,p,'house_manifest');
 expect(d.factCoverage?.cargoRecords.complete).toBe(false);
 expect(d.factCoverage?.containers.complete).toBe(true);
 expect(d.factCoverage?.cargoRecords.nativeRows).toEqual(d.factCoverage?.containers.rows);
 expect(d.factCoverage?.cargoRecords.nativeHbls).toEqual(['SYN-UNIV-005']);
 const changed=structuredClone(p);changed.pages[0].textSource='ocr';
 expect(groundShipping(wire,changed,'house_manifest').factCoverage?.cargoRecords.nativeHbls).toBeUndefined();
});
