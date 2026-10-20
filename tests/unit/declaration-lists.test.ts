import { beforeAll, expect, it } from 'vitest';
import { fixture35 } from '../fixtures/shipping35';
import { reviewShipping } from '../../src/modules/shipping/review';
import { relateShipping } from '../../src/modules/shipping/relationships';
import { identifiers32, identifierValues32 } from '../../src/modules/shipping/review-evidence';
import { recoverNative } from '../../src/modules/shipping/recovery';
import { editShippingField } from '../../src/modules/shipping/edit';
import type { ShippingDocument } from '../../src/modules/shipping/schema';
let docs: ShippingDocument[];
beforeAll(async()=>{
 const containers=[{name:'container allocation',cn:'ABCU1234567',seal:'SEA-102',packages:6,gross:60},{name:'container allocation',cn:'DEFU7654321',seal:'SEA-205',packages:4,gross:40}];
 const rows=[{name:'SENSOR MODULE MODEL AA12',hs:'9031.80',qty:60},{name:'CONTROL RELAY MODEL BB24',hs:'8536.41',qty:40}];
 const fs=await Promise.all([
 fixture35('house_bl',{id:'list-hbl',scope:'full shipment',declarationRefs:['DECL-A-102, DECL-B-205'],rows,containers}),
 fixture35('export_declaration',{id:'list-a',scope:'full shipment',declaration:'DECL-A-102',rows:[rows[0]],containers:[containers[0]]}),
 fixture35('export_declaration',{id:'list-b',scope:'full shipment',declaration:'DECL-B-205',rows:[rows[1]],containers:[containers[1]]}),
 fixture35('house_manifest',{id:'list-mf',scope:'full shipment',declarationRefs:['DECL-B-205; DECL-A-102'],rows,containers})]);
 docs=fs.map(f=>recoverNative(f.document,f.pdf));
});
it('grounds literal native lists and matches membership without changing original or current fields',()=>{
 const before=JSON.stringify(docs),rels=relateShipping(docs);
 expect(rels).toHaveLength(5);expect(rels.every(r=>r.status==='evidence_confirmed')).toBe(true);
 const r=reviewShipping(docs);expect(r.checks.find(c=>c.declarationCoverage)?.assessment).toBe('confirmed_match');
 expect(r.checks.filter(c=>c.title==='복수 신고 대응 품목 수량')).toHaveLength(2);
 expect(r.primaryChecks!.some(c=>c.assessment==='confirmed_mismatch')).toBe(false);
 expect(JSON.stringify(docs)).toBe(before);
});
it.each(['DECL-A-102, DECL-B-205','DECL-A-102; DECL-B-205','DECL-A-102\nDECL-B-205'])('normalizes explicit delimiters only: %s',value=>{
 const f=structuredClone(identifiers32(docs[0],'declarationNumber')[0]);f.field.current.value=value;Object.assign(f.field.original,f.field.current);delete f.field.recovery;
 expect(identifierValues32(f)).toEqual(['decl-a-102','decl-b-205']);
});
it.each(['DECL-A-102,','DECL-A-102, see attached','DECL-A-102 / DECL-B-205','DECL-A-102 to DECL-B-205'])('does not invent list members from ambiguous text: %s',value=>{
 const f=structuredClone(identifiers32(docs[0],'declarationNumber')[0]);f.field.current.value=value;Object.assign(f.field.original,f.field.current);delete f.field.recovery;
 expect(identifierValues32(f)).not.toContain('decl-a-102');
});
it('never uses edited, OCR or unverified lists as aggregation proof',()=>{
 for(const mode of ['substring','edited','unverified','ocr']as const){const ds=structuredClone(docs),h=ds[0];
 for(const f of identifiers32(h,'declarationNumber')){
 if(mode==='substring')f.field.current.value='DECL-A-1020, DECL-B-2050';
 if(mode==='edited')Object.assign(f.field,editShippingField(f.field,'DECL-A-102, DECL-B-205'));
 if(mode==='unverified')f.field.current.status='unverified';
 if(mode==='ocr'&&f.field.current.source)f.field.current.source.provenance='ocr';
 }
 const rel=relateShipping(ds).find(r=>r.documentIds.includes(h.id)&&r.documentIds.includes(ds[1].id));
 if(mode==='edited')expect(rel?.status).not.toBe('evidence_confirmed');expect(reviewShipping(ds).checks.some(c=>c.declarationCoverage)).toBe(false);
 }
});
it('keeps genuinely different carrier lists on hold even when one number intersects',()=>{
 const ds=structuredClone(docs);for(const f of identifiers32(ds[3],'declarationNumber')){f.field.current.value='DECL-A-102, DECL-C-300';Object.assign(f.field.original,f.field.current);delete f.field.recovery;}
 const rel=relateShipping(ds).find(r=>r.documentIds.includes(ds[0].id)&&r.documentIds.includes(ds[3].id));
 expect(rel?.status).toBe('proposed');expect(rel?.mappingWarnings).toHaveLength(1);
});
it('does not aggregate a missing, duplicate or partial declaration after list membership succeeds',()=>{
 for(const mode of ['missing','duplicate','partial']as const){const ds=structuredClone(docs);
 if(mode==='missing')ds.splice(2,1);
 if(mode==='duplicate')ds.push(structuredClone(ds[1]));
 if(mode==='partial')ds[1].fields.shipmentScope=editShippingField(ds[1].fields.shipmentScope,'partial shipment');
 expect(reviewShipping(ds).checks.filter(c=>c.declarationCoverage)).toHaveLength(0);
 }
});
it('keeps a native, independently grounded different reference list on hold (not substring matching)',async()=>{
 const f=await fixture35('house_bl',{id:'real-other-list',scope:'full shipment',declarationRefs:['DECL-A-1020, DECL-B-2050']});
 const d=recoverNative(f.document,f.pdf),r=relateShipping([d,docs[1]])[0];
 expect(identifiers32(d,'declarationNumber')[0].field.current.status).toBe('verified');
 expect(r.status).toBe('proposed');expect(r.mappingWarnings).toHaveLength(1);
});
it('does not resolve a genuine native Seal error as list membership',async()=>{
 const f=await fixture35('export_declaration',{id:'real-wrong-seal',scope:'full shipment',declaration:'DECL-A-102',rows:[{name:'SENSOR MODULE MODEL AA12',hs:'9031.80',qty:60}],containers:[{name:'container allocation',cn:'ABCU1234567',seal:'WRONG-999',packages:6,gross:60}]});
 const ds=[docs[0],recoverNative(f.document,f.pdf),docs[2],docs[3]],r=reviewShipping(ds);
 const comparisons=r.primaryChecks!.filter(c=>c.fields.some(f=>f.fieldName==='sealNumber'&&f.documentId==='real-wrong-seal'));
 expect(comparisons.some(c=>c.assessment==='confirmed_mismatch'||c.assessment==='provisional_mismatch')).toBe(true);
 expect(comparisons.some(c=>c.scopeResolution?.kind==='container_membership'&&c.assessment==='confirmed_match')).toBe(false);
});
it('requires membership in each carrier, never a union that masks another carrier Seal conflict',async()=>{
 const f=await fixture35('house_manifest',{id:'native-conflicting-mf',scope:'full shipment',declarationRefs:['DECL-A-102, DECL-B-205'],rows:[{name:'SENSOR MODULE MODEL AA12',hs:'9031.80',qty:60},{name:'CONTROL RELAY MODEL BB24',hs:'8536.41',qty:40}],containers:[{name:'allocation',cn:'ABCU1234567',seal:'WRONG-999',packages:6,gross:60},{name:'allocation',cn:'DEFU7654321',seal:'SEA-205',packages:4,gross:40}]});
 const r=reviewShipping([docs[0],docs[1],docs[2],recoverNative(f.document,f.pdf)]);
 const wrong=r.primaryChecks!.filter(c=>c.comparison?.meaning==='sealNumber'&&c.fields.some(f=>f.documentId==='list-a')&&c.fields.some(f=>f.documentId==='native-conflicting-mf'&&f.field.current.value==='WRONG-999'));
 expect(wrong.some(c=>c.assessment==='confirmed_mismatch'||c.assessment==='provisional_mismatch')).toBe(true);
 expect(wrong.some(c=>c.scopeResolution?.kind==='container_membership'&&c.assessment==='confirmed_match')).toBe(false);
});
