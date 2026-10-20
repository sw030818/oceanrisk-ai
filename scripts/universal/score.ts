// Independent evaluation adapter. This module is never imported by app/provider
// request code. Missing/wrong/unsupported fields remain in the denominator.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import type {ShippingDocument,ShippingField} from '../../src/modules/shipping/schema';
import type {ShippingResult} from '../../src/modules/shipping/prepare';
import {shippingValues} from '../../src/modules/shipping/fields';
const norm=(v:unknown)=>String(v??'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
const ident=(v:unknown)=>norm(v).replace(/[ .-]/g,'');
const unit=(v:unknown)=>['pcs','ea','piece','pieces'].includes(norm(v))?'pcs':['ctn','ctns','carton','cartons','ct'].includes(norm(v))?'ctn':['kg','kgs'].includes(norm(v))?'kg':norm(v);
type Truth={id:string;partition:string;hbl:string;declaration:string;shipper:string;consignee:string;pol:string;pod:string;packages:number;gross:number;items:{en:string;ko:string;hs:string;quantity:number}[];containers:{container:string;seal:string;packages:number;gross:number}[]};
const equal=(role:string,a:unknown,b:unknown)=>typeof b==='number'?typeof a==='number'&&Math.abs(a-b)<1e-8:role.endsWith('Unit')||role==='weightUnit'?unit(a)===unit(b):['hsCode','containerNumber','sealNumber','houseBlNumber','declarationNumber'].includes(role)?ident(a)===ident(b):norm(a)===norm(b);
export function scoreDocument(result:ShippingResult|undefined,t:Truth,type:string){
 const d=result?.document;let expected=0,firstCorrect=0,currentCorrect=0,verifiedCorrect=0,verifiedWrong=0,firstMissing=0,wrongCitations=0,correctButUnverified=0,rowAmbiguities=0;
 const fields:{scope:string;role:string;first:boolean;current:boolean;verified:boolean;code:string|null}[]=[];
 const count=(scope:string,role:string,value:unknown,choices:ShippingField[])=>{
  expected++;const original=choices.filter(f=>equal(role,f.original.value,value)),current=choices.filter(f=>equal(role,f.current.value,value));
  const goodFirst=original.length>0,goodCurrent=current.length>0,proven=current.filter(f=>f.current.status==='verified');
  firstCorrect+=Number(goodFirst);currentCorrect+=Number(goodCurrent);verifiedCorrect+=Number(proven.length>0);
  if(!choices.some(f=>f.original.value!==null))firstMissing++;
  verifiedWrong+=Number(choices.some(f=>f.current.status==='verified'&&!equal(role,f.current.value,value)));
  correctButUnverified+=Number(goodFirst&&original[0].original.status!=='verified');
  wrongCitations+=Number(choices.some(f=>f.original.value!==null&&['missing_evidence','value_mismatch','quote_not_found','block_not_found'].includes(f.original.verificationCode??'')));
  fields.push({scope,role,first:goodFirst,current:goodCurrent,verified:proven.length>0,code:choices.find(f=>f.current.status==='unverified')?.current.verificationCode??null});
 };
 const root=(role:string)=>d?[...(d.fields[role]?[d.fields[role]]:[]),...d.additionalFields.filter(f=>f.meaning===role).map(f=>f.field),...d.references.filter(r=>r.kind===(role==='houseBlNumber'?'house_bl':role==='declarationNumber'?'export_declaration':'__none')).map(r=>r.number)]:[];
 // A duplicate reference aliases the same field; do not count it as two correct
 // candidates, but keep every genuinely conflicting candidate in scoring.
 const distinct=(fs:ShippingField[])=>[...new Map(fs.map(f=>[JSON.stringify([f.original.value,f.current.value,f.current.source?.segments]),f])).values()];
 for(const[role,value]of Object.entries({houseBlNumber:t.hbl,declarationNumber:t.declaration,[type==='export_declaration'?'exporter':'shipper']:t.shipper,consignee:t.consignee,portOfLoading:t.pol,portOfDischarge:t.pod,shipmentScope:'full shipment',quantity:t.items.reduce((n,r)=>n+r.quantity,0),quantityUnit:'PCS',packageCount:t.packages,packageUnit:'CTN',grossWeight:t.gross,grossWeightUnit:'KG'}))count('document',role,value,distinct(root(role)));
 for(const [index,item]of t.items.entries()){
  const description=type==='export_declaration'?item.ko:item.en;
  const all=[...(d?.items??[]),...(d?.cargoRecords??[])];
  const matches=all.filter(row=>[row.fields.goodsDescription?.current.value,row.fields.goodsDescription?.original.value].some(v=>norm(v)===norm(description)));
  // Prefer the goods table when both native goods and cargo tables legitimately
  // describe the same item; ambiguous duplicate rows in one table stay unscored.
  const items=matches.filter(r=>d?.items.includes(r as ShippingDocument['items'][number]));
  const rows=items.length?items:matches;
  if(rows.length>1)rowAmbiguities++;
  for(const[role,value]of Object.entries({goodsDescription:description,hsCode:item.hs,quantity:item.quantity,quantityUnit:'PCS'}))count('item-'+index,role,value,rows.length===1&&rows[0].fields[role]?[rows[0].fields[role]]:[]);
 }
 for(const[index,c]of t.containers.entries()){
  const rows=d?.containers.filter(r=>ident(r.containerNumber.current.value)===ident(c.container)||ident(r.containerNumber.original.value)===ident(c.container))??[];
  if(rows.length>1)rowAmbiguities++;
  for(const[role,value]of Object.entries({containerNumber:c.container,sealNumber:c.seal,packageCount:c.packages,packageUnit:'CTN',grossWeight:c.gross,weightUnit:'KG'}))count('container-'+index,role,value,rows.length===1?[rows[0][role as 'sealNumber']]:[]);
 }
 const failureCodes:Record<string,number>={};for(const f of d?shippingValues(d):[])if(f.current.status==='unverified')failureCodes[f.current.verificationCode??'unknown']=(failureCodes[f.current.verificationCode??'unknown']??0)+1;
 return{type,classified:d?.classificationStatus==='classified'&&d.detectedType===type,initialClassification:d?.classification?.original.value===type,apiFailed:!result||!!result.error||!result.document,expected,firstCorrect,currentCorrect,verifiedCorrect,verifiedWrong,firstMissing,wrongCitations,correctButUnverified,rowAmbiguities,failureCodes,fields};
}
const arg=(k:string)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3);
if(process.argv[1]?.endsWith('/score.ts')){
 if(arg('consistency-input')){await(await import('./consistency-score')).scoreConsistency(arg('consistency-input')!,arg('out')??'test-results/consistency/scored.json');process.exit(0);}
 const stage=arg('stage'),sha=arg('sha');if(!stage||!sha)throw Error('Select stage/source');
 const corpus=arg('corpus')==='replacement'?'tests/fixtures/universal-replacement/':'tests/fixtures/universal/';
 const truth=JSON.parse(await readFile(corpus+'truth.json','utf8')) as Truth[],manifest=JSON.parse(await readFile(corpus+'manifest.json','utf8')) as {case:string;type:string;fault?:string;parent?:string}[];
 const inputDir=['replay','replayretired'].includes(stage)?'test-results/universal/replay':'test-results/universal/private';
 const names=(await readdir(inputDir)).filter(n=>n.startsWith(stage+'-')&&n.endsWith(sha+'.json'));
 const required=arg('require-cases');if(required && names.length!==Number(required))throw Error('Incomplete case set; do not publish an inflated denominator');
 const cases=[];
 for(const name of names){const x=JSON.parse(await readFile(inputDir+'/'+name,'utf8')),t=truth.find(t=>t.id===x.case)!;const fault=manifest.find(m=>m.case===x.case)?.fault,base=fault?truth.find(v=>v.id===manifest.find(m=>m.case===x.case)!.parent)!:t;
  const docs=['house_bl','export_declaration','house_manifest'].map(type=>scoreDocument(x.initial.results.find((r:ShippingResult)=>r.uploadSlot===type),type==='house_manifest'?t:base,type));
  const checks=x.review.primaryChecks??x.review.checks,confirmed=checks.filter((c:{assessment:string})=>c.assessment==='confirmed_mismatch'),expectedRole=fault==='model'?'goodsDescription':fault;
  const observedRole=(c:{comparison?:{meaning:string};fields?:{fieldName:string}[]})=>c.comparison?.meaning??(new Set(c.fields?.map(f=>f.fieldName)).size===1?c.fields?.[0].fieldName:undefined);
  const tp=!!fault&&confirmed.some((c:{comparison?:{meaning:string};fields?:{fieldName:string}[];category:string})=>observedRole(c)===expectedRole||fault==='houseBlNumber'&&c.category==='reference');
  const provisional=!!fault&&checks.some((c:{assessment:string;comparison?:{meaning:string};category:string})=>['provisional_mismatch','needs_review','not_comparable'].includes(c.assessment)&&(c.comparison?.meaning===expectedRole||fault==='houseBlNumber'&&c.category==='reference'));
  const relationships=x.review.relationships as {status:string;documentIds:string[]}[];
  const slotByDoc=new Map((x.initial.results as ShippingResult[]).map(r=>[r.pdf.id,r.uploadSlot]));
  const correctRelation=(r:typeof relationships[number])=>r.documentIds.length===2&&r.documentIds.every(id=>slotByDoc.has(id))&&new Set(r.documentIds.map(id=>slotByDoc.get(id)==='house_manifest'?t.hbl:base.hbl)).size===1;
  const linked=relationships.filter(r=>r.status==='evidence_confirmed'),relationshipTP=linked.filter(correctRelation).length,relationshipFP=linked.filter(r=>!correctRelation(r)).length,expectedRelationships=fault==='houseBlNumber'?1:3;
  cases.push({relationshipTP,relationshipFP,relationshipFN:Math.max(0,expectedRelationships-relationshipTP),expectedRelationships,case:x.case,stage,sourceSha:sha,partition:t.partition,fault,documents:docs,confirmedErrors:confirmed.map((c:{comparison?:{meaning:string};fields?:{fieldName:string}[];category:string})=>observedRole(c)??c.category),confirmedTP:Number(tp),warningDetection:tp||provisional,falseNegative:!!fault&&!tp,falsePositive:confirmed.filter((c:{comparison?:{meaning:string};fields?:{fieldName:string}[];category:string})=>!fault||observedRole(c)!==expectedRole&&!(fault==='houseBlNumber'&&c.category==='reference')).length,outcomes:x.review.outcomes,independentActionIssues:x.review.issues?.length,relationships:x.review.relationships.map((r:{status:string;kind:string})=>({status:r.status,kind:r.kind})),durationMs:x.durationMs,paidDocuments:x.paidDocuments,reusedParents:x.reusedParents,sourceShaStable:x.sourceShaStable,semanticStatus:x.semantic?.status??'not_needed'});
 }
 const docs=cases.flatMap(c=>c.documents),sum=(k:string)=>docs.reduce((n,d)=>n+Number(d[k as keyof typeof d]??0),0);
 const summary={stage,sourceSha:sha,synthetic:true,cases:cases.length,documents:docs.length,classified:docs.filter(d=>d.classified).length,apiFailures:docs.filter(d=>d.apiFailed).length,expectedRelationships:cases.reduce((n,c)=>n+c.expectedRelationships,0),relationshipTP:cases.reduce((n,c)=>n+c.relationshipTP,0),relationshipFP:cases.reduce((n,c)=>n+c.relationshipFP,0),relationshipFN:cases.reduce((n,c)=>n+c.relationshipFN,0),expectedCoreFields:sum('expected'),firstCorrect:sum('firstCorrect'),currentCorrect:sum('currentCorrect'),verifiedCorrect:sum('verifiedCorrect'),verifiedWrong:sum('verifiedWrong'),correctButUnverified:sum('correctButUnverified'),firstMissing:sum('firstMissing'),wrongCitations:sum('wrongCitations'),confirmedFP:cases.reduce((n,c)=>n+c.falsePositive,0),confirmedTP:cases.reduce((n,c)=>n+c.confirmedTP,0),confirmedFN:cases.filter(c=>c.falseNegative).length,warningDetected:cases.filter(c=>c.fault&&c.warningDetection).length,medianDurationMs:cases.map(c=>c.durationMs).sort((a,b)=>a-b)[Math.floor(cases.length/2)],rows:cases};
 await mkdir('test-results/universal/evidence',{recursive:true});await writeFile('test-results/universal/evidence/'+stage+'-'+sha+'.json',JSON.stringify(summary,null,2));console.log(JSON.stringify({...summary,rows:undefined}));
}
