import {it,expect} from "vitest";
import {oracle39,cases39} from "../fixtures/shipping39";
import {shippingTypes} from "../../src/modules/shipping/catalog";
import {semanticContext} from "../../src/modules/shipping/semantic-context";
import {analyzeSemantics} from "../../src/modules/shipping/semantic-analysis";
import {reviewShipping} from "../../src/modules/shipping/review";
import type {SemanticDecision} from "../../src/modules/shipping/semantic-schema";
it.each(cases39.filter(c=>c.partition!=="holdout"))("MOCK semantics + independent native PDF engine: $id",async(c)=>{
 const fs=await Promise.all(shippingTypes.map(t=>oracle39(c.id,t))),docs=fs.map(f=>f.document),context=semanticContext(docs);
 const decisions:SemanticDecision[]=context.pairs.filter(p=>{
   if(!c.second)return true;
   const group=(x:typeof p.left)=>x.descriptions.some(d=>d.value.includes(c.second!.en)||d.value.includes(c.second!.ko))?2:1;
   return group(p.left)===group(p.right);
 }).map(p=>{
  const source=(x:typeof p.left)=>({fieldId:x.id,quote:String(x.ref.field.current.value),blockIds:x.ref.field.current.source!.segments!.map(s=>s.blockId)});
  const conflict=["specification","model","material","size"].includes(c.fault??"")&&(p.left.documentType==="house_manifest"||p.right.documentType==="house_manifest");
  return {leftId:p.left.id,rightId:p.right.id,relation:conflict?"explicit_conflict":"same_product",left:source(p.left),right:source(p.right),claims:conflict?[{attribute:c.fault as "material",label:"",left:source(p.left),right:source(p.right)}]:[],explanation:"MOCK semantic opinion; native PDF and deterministic checks are real."};
 });
 const report=await analyzeSemantics(docs,{ai:async()=>({pairs:decisions})}),r=reviewShipping(docs,{semantic:report}),errors=r.primaryChecks!.filter(x=>x.assessment==="confirmed_mismatch");
 expect(docs.every(d=>d.classificationStatus==="classified")).toBe(true);
 if(!c.fault){expect(errors.map(c=>[c.title,c.comparison?.meaning])).toEqual([]);expect(r.primaryChecks!.some(c=>c.semantic&&c.assessment==="provisional_match")).toBe(true);}
 else if(["specification","model","material","size"].includes(c.fault))expect(r.primaryChecks!.some(x=>["confirmed_mismatch","provisional_mismatch"].includes(x.assessment)&&x.category==="goods")).toBe(true);
 else expect(r.primaryChecks!.some(x=>x.assessment==="confirmed_mismatch"&&x.comparison?.meaning===c.fault),JSON.stringify(r.primaryChecks!.filter(x=>x.assessment!=="not_applicable").map(x=>[x.comparison?.meaning,x.assessment,x.comparison?.reasonCodes]))).toBe(true);
 if(c.id==="multi-normal")expect(r.primaryChecks!.some(c=>c.semantic?.validationCode==="AMBIGUOUS_SEMANTIC_MAPPING")).toBe(false);
},20000);
