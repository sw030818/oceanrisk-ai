import{beforeAll,it,expect}from'vitest';import{consistencyFixture}from'../fixtures/consistency';import{reviewShipping}from'../../src/modules/shipping/review';
import{matchProductRows}from'../../src/modules/shipping/product-matching';
import{ref32}from'../../src/modules/shipping/review-evidence';
let f:Awaited<ReturnType<typeof consistencyFixture>>;beforeAll(async()=>{f=await consistencyFixture();},20000);
it('connects MOCK bilingual meaning plus unique native model/HS/rows to EA/PCS declaration totals without mutating AI fields',()=>{
 const original=JSON.stringify(f.docs),r=reviewShipping(f.docs,{semantic:f.report});
 expect(r.checks.find(c=>c.declarationCoverage)?.assessment).toBe('confirmed_match');expect(r.checks.find(c=>c.declarationCoverage)?.computedValues?.map(c=>c.value)).toEqual([1000,1000]);
 expect(r.checks.filter(c=>c.allocationCoverage).every(c=>c.assessment==='confirmed_match')).toBe(true);expect(r.checks.filter(c=>c.allocationCoverage)).toHaveLength(2);
 expect(r.issues).toHaveLength(0);expect(JSON.stringify(f.docs)).toBe(original);expect(r.checks.length).toBeGreaterThan(50);
});
it.each(['absent','stale','failed','wrongquote']as const)('does not confirm an AI-only or invalid translation: %s',mode=>{
 const s=structuredClone(f.report);if(mode==='stale')s.inputKey+='changed';if(mode==='failed')s.status='failed';if(mode==='wrongquote')for(const p of s.decisions.pairs)p.left.quote='NOT IN PDF';
 const r=reviewShipping(f.docs,{semantic:mode==='absent'?undefined:s});expect(r.checks.some(c=>c.declarationCoverage)).toBe(false);expect(r.issues!.length).toBeGreaterThan(0);
});
it('never confirms totals from language alone with no explicit native product identifier',async()=>{
 const x=await consistencyFixture({noModel:true});const r=reviewShipping(x.docs,{semantic:x.report});expect(r.checks.some(c=>c.declarationCoverage)).toBe(false);
},20000);
it('matches native owners independently of product array order',()=>{
 const left=f.docs.filter(d=>d.detectedType==='export_declaration').flatMap(d=>d.items.map(i=>ref32(d,'goodsDescription',i.fields.goodsDescription,{itemId:i.id}))),bl=f.docs[0];
 const right=bl.items.map(i=>ref32(bl,'goodsDescription',i.fields.goodsDescription,{itemId:i.id})).reverse();
 const m=matchProductRows(left,right,f.docs,f.report);expect(m.strong).toBe(true);expect(m.matches.map(x=>x.right.itemId)).toEqual(bl.items.map(i=>i.id));
});
it('does not promote user-edited or unverified quantity into confirmed aggregation',()=>{
 for(const status of ['user_edited','unverified']as const){const docs=structuredClone(f.docs);docs[1].items[0].fields.quantity.current.status=status;
 const r=reviewShipping(docs,{semantic:f.report});expect(r.checks.some(c=>c.declarationCoverage)).toBe(false);}
});
it('retains a single explicit translation cause while leaving independent checks visible',async()=>{
 const x=await consistencyFixture({noModel:true}),r=reviewShipping(x.docs,{semantic:x.report});
 const roots=r.primaryChecks!.filter(c=>c.rootCauseIds?.length);expect(roots.length).toBeGreaterThan(1);
 expect(new Set(roots.flatMap(c=>c.rootCauseIds!)).size).toBe(1);
 expect(r.checks.length).toBeGreaterThan(50);expect(r.checks.filter(c=>c.allocationCoverage&&c.assessment==='confirmed_match')).toHaveLength(2);
},20000);
it.each([{quantity:580},{model:'WG43'},{seal:'WRONG-99'},{partial:true},{duplicate:true}])('preserves physically rendered error or partial/duplicate protection: %j',async change=>{
 const x=await consistencyFixture(change),r=reviewShipping(x.docs,{semantic:x.report});expect(r.issues!.length).toBeGreaterThan(0);
 if('quantity'in change)expect(r.checks.find(c=>c.declarationCoverage)?.assessment).toBe('confirmed_mismatch');
 if('model'in change||'partial'in change||'duplicate'in change)expect(r.checks.some(c=>c.declarationCoverage)).toBe(false);
 if('seal'in change)expect(r.primaryChecks!.some(c=>c.assessment==='confirmed_mismatch'&&c.fields.some(f=>f.fieldName==='sealNumber'))).toBe(true);
},20000);
