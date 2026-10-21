// Evaluation only. This module is never imported by extraction or semantic requests.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import type {ShippingResult} from '../../src/modules/shipping/prepare';
import type {ShippingReview,ShippingCheck} from '../../src/modules/shipping/review-model';
import {goodsComparisonValue} from '../../src/modules/shipping/goods-context';
import {goodsCore,hsSix} from '../../src/modules/shipping/equivalence';
import type {ShippingField} from '../../src/modules/shipping/schema';
type Expected={file:string;type:string;hbl:string;quantity:number;packages:number;gross:number;items:{description:string;quantity:number;hs:string}[];containers:{number:string;seal:string;packages:number;gross:number}[]};
const norm=(x:unknown)=>String(x??'').normalize('NFKC').toLowerCase().replace(/[\s,.-]/g,'');
export async function scoreConsistency(input:string,out:string){
 const x=JSON.parse(await readFile(input,'utf8')) as {sourceSha:string;case:string;initial:{results:ShippingResult[]};semantic?:{status:string};review:ShippingReview;durationMs:number;sourceShaStable:boolean};
 const truth=JSON.parse(await readFile('tests/fixtures/consistency/truth.json','utf8')) as {case:string;fault:string|null;documents:Expected[]}[];
 const t=truth.find(t=>t.case===x.case);if(!t)throw Error('Unknown evaluation case');
 const docs=t.documents.map((expected,index)=>{
  const r=x.initial.results[index],d=r?.document;let first=0,current=0,verified=0,verifiedWrong=0,total=0;
  const count=(candidate:ShippingField|ShippingField[]|undefined,value:unknown,role='')=>{
   const fs=Array.isArray(candidate)?candidate:candidate?[candidate]:[];
   total++;const eq=(v:unknown)=>role==='hs'?hsSix(v)===hsSix(value):role==='goods'?goodsCore(v)===goodsCore(value):norm(v)===norm(value);
   first+=Number(fs.some(f=>eq(f.original.value)));current+=Number(fs.some(f=>eq(f.current.value)));verified+=Number(fs.some(f=>eq(f.current.value)&&f.current.status==='verified'));verifiedWrong+=Number(fs.some(f=>f.current.status==='verified'&&!eq(f.current.value)));
  };
  for(const [role,value]of Object.entries({houseBlNumber:expected.hbl,quantity:expected.quantity,packageCount:expected.packages,grossWeight:expected.gross}))count(d?[...(d.fields[role]?[d.fields[role]]:[]),...d.additionalFields.filter(f=>f.meaning===role).map(f=>f.field)]:[],value);
  for(const item of expected.items){
   const candidates=d?.items.filter(row=>goodsCore(goodsComparisonValue(row.fields.goodsDescription))===goodsCore(item.description))??[];
   const row=candidates.length===1?candidates[0]:undefined;
   count(row?.fields.goodsDescription,item.description,'goods');count(row?.fields.quantity,item.quantity);count(row?.fields.hsCode,item.hs,'hs');
  }
  for(const c of expected.containers){const rows=d?.containers.filter(row=>norm(row.containerNumber.current.value)===norm(c.number))??[],row=rows.length===1?rows[0]:undefined;
   count(row?.containerNumber,c.number);count(row?.sealNumber,c.seal);count(row?.packageCount,c.packages);count(row?.grossWeight,c.gross);
  }
  return{file:expected.file,type:expected.type,apiSuccess:!!d&&!r.error,initialClassification:d?.classification?.original.value===expected.type,classified:d?.classificationStatus==='classified'&&d.detectedType===expected.type,total,first,current,verified,verifiedWrong};
 });
 const checks=x.review.primaryChecks??x.review.checks,role=(c:ShippingCheck)=>c.comparison?.meaning??(new Set(c.fields.map(f=>f.fieldName)).size===1?c.fields[0]?.fieldName:undefined),bad=checks.filter(c=>c.assessment==='confirmed_mismatch');
 const targetRoles:Record<string,string[]>={quantity:['quantity'],model:['goodsDescription'],hs:['hsCode'],seal:['sealNumber'],total:['quantity'],'foreign-hbl':['houseBlNumber'],'missing-declaration':['declarationNumber'],duplicate:['declarationNumber']};
 const targeted=(c:ShippingCheck)=>t.fault&&(t.fault==='duplicate'?c.referenceCause?.kind==='duplicate':t.fault==='missing-declaration'?c.referenceCause?.kind==='missing'||c.referenceCause?.kind==='unlisted':t.fault==='foreign-hbl'?c.referenceCause?.kind==='hbl_conflict'||role(c)==='houseBlNumber':targetRoles[t.fault]?.includes(role(c)??''));
 const result={kind:'ACTUAL OpenAI analysis of synthetic PDFs; evaluator truth never sent to provider',case:x.case,fault:t.fault,sourceSha:x.sourceSha,sourceShaStable:x.sourceShaStable,semantic:x.semantic?.status,documents:docs,successfulDocuments:docs.filter(d=>d.apiSuccess).length,failedDocuments:docs.filter(d=>!d.apiSuccess).length,
  firstCorrect:docs.reduce((n,d)=>n+d.first,0),currentCorrect:docs.reduce((n,d)=>n+d.current,0),verifiedCorrect:docs.reduce((n,d)=>n+d.verified,0),expectedFields:docs.reduce((n,d)=>n+d.total,0),verifiedWrong:docs.reduce((n,d)=>n+d.verifiedWrong,0),
  actionIssues:x.review.issues?.length,confirmedErrors:bad.map(c=>({id:c.id,title:c.title,role:role(c)})),confirmedFP:t.fault?null:bad.length,
  confirmedTargetDetected:!!t.fault&&bad.some(targeted),warningTargetDetected:!!t.fault&&checks.some(c=>['confirmed_mismatch','provisional_mismatch','needs_review','not_comparable'].includes(c.assessment)&&targeted(c)),
  declarationTotals:x.review.checks.filter(c=>c.declarationCoverage||c.declarationMembership||c.allocationCoverage).map(c=>({title:c.title,assessment:c.assessment,computed:c.computedValues,itemMappings:c.declarationCoverage?.itemMappings?.length})),
  relationships:x.review.relationships?.map(r=>({status:r.status,conflictRoles:r.conflictRoles})),outcomes:x.review.outcomes,durationMs:x.durationMs};
 await mkdir(out.slice(0,out.lastIndexOf('/')),{recursive:true});await writeFile(out,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,documents:undefined,relationships:undefined,confirmedErrors:result.confirmedErrors.length}));return result;
}
