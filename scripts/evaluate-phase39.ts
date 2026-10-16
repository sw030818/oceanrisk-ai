// Free native PDF evaluation with explicit correct candidates and MOCK meanings.
// This never calls a provider and is not first-extraction accuracy evidence.
import {writeFile,mkdir,readFile} from "node:fs/promises";
import {cases39,oracle39} from "../tests/fixtures/shipping39";
import {shippingTypes} from "../src/modules/shipping/catalog";
import {semanticContext} from "../src/modules/shipping/semantic-context";
import {analyzeSemantics} from "../src/modules/shipping/semantic-analysis";
import {reviewShipping} from "../src/modules/shipping/review";
import {shippingValues} from "../src/modules/shipping/fields";
import {shippingOpenAIRequest} from "../src/modules/shipping/openai";
import {semanticOpenAIRequest} from "../src/modules/shipping/semantic-request";
import {requestUpperCost} from "./lib/openai-budget";
import {score39} from "./lib/phase39-score";
import type {SemanticDecision} from "../src/modules/shipping/semantic-schema";
import type {ShippingDocument} from "../src/modules/shipping/schema";
const rows=[];let extractionUpper=0,semanticUpper=0;
for(const c of cases39){
 const fixtures=await Promise.all(shippingTypes.map(t=>oracle39(c.id,t))),docs=fixtures.map(f=>f.document),context=semanticContext(docs);
 extractionUpper+=fixtures.reduce((s,f)=>s+requestUpperCost(Buffer.byteLength(JSON.stringify(shippingOpenAIRequest(f.pdf,"gpt-6-luna"))),8192),0);
 if(context.pairs.length)semanticUpper+=requestUpperCost(Buffer.byteLength(JSON.stringify(semanticOpenAIRequest(context))),8192);
 const before=reviewShipping(docs);
 // Holdout answers are never used for semantic tuning or mock decisions.
 const decisions:SemanticDecision[]=c.partition==="holdout"?[]:context.pairs.filter(p=>{
  if(!c.second)return true;
  const group=(x:typeof p.left)=>x.descriptions.some(d=>d.value.includes(c.second!.en)||d.value.includes(c.second!.ko))?2:1;
  return group(p.left)===group(p.right);
 }).map(p=>{
  const source=(x:typeof p.left)=>({fieldId:x.id,quote:String(x.ref.field.current.value),blockIds:x.ref.field.current.source!.segments!.map(s=>s.blockId)});
  const conflict=["specification","model","material","size"].includes(c.fault??"")&&(p.left.documentType==="house_manifest"||p.right.documentType==="house_manifest");
  return{leftId:p.left.id,rightId:p.right.id,relation:conflict?"explicit_conflict":"same_product",left:source(p.left),right:source(p.right),claims:conflict?[{attribute:c.fault as "material",label:"",left:source(p.left),right:source(p.right)}]:[],explanation:"MOCK evaluation opinion, not actual AI response."};
 });
 const semantic=c.partition==="holdout"?undefined:await analyzeSemantics(docs,{ai:async()=>({pairs:decisions})});
 const after=reviewShipping(docs,{semantic});
 rows.push({case:c.id,partition:c.partition??"development",kind:"Synthetic independent ReportLab PDFs; oracle first candidates; MOCK semantics",classified:docs.filter(d=>d.classificationStatus==="classified").length,presentFields:docs.flatMap(shippingValues).filter(f=>f.current.value!==null).length,verifiedFields:docs.flatMap(shippingValues).filter(f=>f.current.status==="verified").length,sourceProducts:context.products.length,before:score39(before,c.fault??null),after:c.partition==="holdout"?null:score39(after,c.fault??null),semantic:semantic?.status??"holdout-not-evaluated",semanticCodes:[...new Set(after.primaryChecks?.flatMap(c=>c.semantic?[c.semantic.validationCode]:[])??[])]});
}
let set2Cost:number|null=null;
try{const docs:ShippingDocument[]=JSON.parse(await readFile("/workspace/private-phase38/phase381-oracle-docs.json","utf8"));let first=0;for(const i of [1,2,3]){const pages=JSON.parse(await readFile(`/workspace/private-phase38/0${i}-pages.json`,"utf8"));first+=requestUpperCost(Buffer.byteLength(JSON.stringify(shippingOpenAIRequest({id:"private-input-"+i,fileName:"private.pdf",pages},"gpt-6-luna"))),8192);}const ctx=semanticContext(docs);set2Cost=first+(ctx.pairs.length?requestUpperCost(Buffer.byteLength(JSON.stringify(semanticOpenAIRequest(ctx))),8192):0);}catch{/* Optional private source is not required by CI. */}
await mkdir("test-results/phase39",{recursive:true});
const report={kind:"FREE oracle-candidate native verification + MOCK semantic evaluation; NOT OpenAI E2E",providerRequests:0,newPaidCostUsd:0,independentGenerator:"ReportLab embedded Korean font",syntheticCases:cases39.length,developmentCases:rows.filter(r=>r.partition==="development").length,holdoutSemanticEvaluated:false,rows,proposedLivePlan:{status:"NOT_APPROVED",documents:60,providerRequestsAtMost:80,automaticRetries:0,composition:"Set2 initial3 + 17 development triplets51 + final same-SHA Set2 repeat3 and blind holdout3",reservedFinalDocuments:6,estimatedSourceRequestUpperUsd:extractionUpper+semanticUpper+(set2Cost===null?0:2*set2Cost),estimateScope:"Upper bounds for expected oracle-derived request shapes only; actual unknown AI shapes are individually reserved before every request; budget stops prevail",approvedCostUsd:null,proposedCaps:{costUsd:10,documents:60,requests:120}}};
await writeFile("test-results/phase39/free-evaluation.json",JSON.stringify(report,null,2));console.log(JSON.stringify({developmentCases:report.developmentCases,holdoutSemanticEvaluated:false,classified:rows.reduce((s,r)=>s+r.classified,0),fields:rows.reduce((s,r)=>s+r.verifiedFields,0),present:rows.reduce((s,r)=>s+r.presentFields,0),before:rows.filter(r=>r.after).reduce((s,r)=>({TP:s.TP+r.before.TP,FP:s.FP+r.before.FP,FN:s.FN+r.before.FN}),{TP:0,FP:0,FN:0}),after:rows.filter(r=>r.after).reduce((s,r)=>({TP:s.TP+r.after!.TP,FP:s.FP+r.after!.FP,FN:s.FN+r.after!.FN}),{TP:0,FP:0,FN:0}),proposedLivePlan:report.proposedLivePlan}));
