// MOCK prevalidated checks over actual, independently verified PDF HS cells.
// This tests causal grouping only, never fabricates a verified source value.
import{it,expect}from'vitest';import{fixture35}from'../fixtures/shipping35';import{recoverNative}from'../../src/modules/shipping/recovery';import{ref32}from'../../src/modules/shipping/review-evidence';import{linkHsSetDependencies}from'../../src/modules/shipping/conflict-causes';import type{ShippingCheck}from'../../src/modules/shipping/review-model';
it.each(['9001.90','8483.60'])('groups a triangle only when the exact complete code difference is covered: third %s',async third=>{
 const fixtures=await Promise.all((['9001.90',third,'8504.40']).map((hs,i)=>fixture35(i===0?'house_bl':i===1?'export_declaration':'house_manifest',{id:'hs-proof-'+i,rows:[{name:'OPTICAL MODULE MODEL OM28 / 600 PCS / 20 CTNS',hs,qty:600}]}))),docs=fixtures.map(f=>recoverNative(f.document,f.pdf)),refs=docs.map(d=>ref32(d,'hsCode',d.items[0].fields.hsCode,{itemId:d.items[0].id}));
 expect(refs.every(f=>f.field.current.status==='verified')).toBe(true);
 const base={scope:'triangle',category:'goods',assessment:'confirmed_mismatch',importance:'high',relationshipIds:[],explanation:'MOCK upstream verified discrepancy',followUp:'Check original codes',comparison:{meaning:'hsCode',hbl:'HB-SYN-35-A',scope:'hbl_record',reasonCodes:[],relatedCheckIds:[],facts:[]}}as const;
 const row={...base,id:'native-hs/proof',scope:'house_bl_manifest',fields:[refs[0],refs[2]],rootCauseIds:['native-hs/proof'],rootCauseKind:'value_conflict'},global={...base,id:'global-proof',fields:refs};const checks=[row,global]as unknown as ShippingCheck[];
 linkHsSetDependencies(checks);expect(checks[1].assessment).toBe('confirmed_mismatch');
 if(third==='9001.90'){expect(checks[1].rootCauseIds).toEqual(['native-hs/proof']);expect(checks[1].rootCauseKind).toBe('value_conflict');}else expect(checks[1].rootCauseIds).toBeUndefined();
 expect(checks[1].fields).toHaveLength(3);expect(checks[0].fields).toHaveLength(2);
},20000);
