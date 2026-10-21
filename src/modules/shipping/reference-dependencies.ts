import { declarationAllocations } from './declaration-allocation';
import type{ShippingDocument}from'./schema';import type{ShippingCheck}from'./review-model';import{identifiers32,identifierValues32,root32,text32,verified32,refKey32}from'./review-evidence';import{nativeRecordHbl}from'./native-record-link';
// Diagnose actual native reference sets, not file names or substring matches.
// This changes causal presentation only. It never proves a shipment or a sum.
export function linkReferenceDependencies(checks:ShippingCheck[],docs:ShippingDocument[]){
 for(const bl of docs.filter(d=>d.detectedType==='house_bl'&&d.classificationStatus==='classified')){
  const hbl=nativeRecordHbl(bl);if(!hbl||docs.filter(d=>d.detectedType==='house_bl'&&nativeRecordHbl(d)===hbl).length!==1)continue;
  const hblRefs=identifiers32(bl,'houseBlNumber').filter(verified32),refs=identifiers32(bl,'declarationNumber'),known=refs.length>0&&refs.every(f=>verified32(f)&&identifierValues32(f).length>0),expected=new Set(known?refs.flatMap(identifierValues32):[]);
  const declarations=docs.filter(d=>d.detectedType==='export_declaration'&&d.classificationStatus==='classified').map(d=>{const f=root32(d,'declarationNumber');return{d,f,number:f&&verified32(f)?text32(f.field.current.value):null,hbl:nativeRecordHbl(d)};});
  const own=declarations.filter(v=>v.hbl===hbl),related=declarations.filter(v=>v.hbl===hbl||!!v.number&&expected.has(v.number));
  const carriers=docs.filter(d=>d.detectedType==='house_manifest'&&d.classificationStatus==='classified'&&nativeRecordHbl(d)===hbl),members=new Set([bl.id,...related.map(v=>v.d.id),...carriers.map(d=>d.id)]);
  const causes=new Map<string,ShippingCheck>();
  const add=(kind:NonNullable<ShippingCheck['referenceCause']>['kind'],number:string,extra:ShippingCheck['fields'])=>{
   const id='declaration-reference/'+bl.id+'/'+kind+'/'+encodeURIComponent(number),fields=[...hblRefs,...refs.filter(verified32),...extra].filter((f,i,fs)=>fs.findIndex(g=>refKey32(g)===refKey32(f))===i);
   const title={missing:'해당 신고번호의 원문 자료 확인',unlisted:'운송서류 신고 참조 목록 확인',duplicate:'같은 신고번호의 복수 문서 확인',hbl_conflict:'신고서와 운송서류의 HBL 기재 충돌'}[kind];
   const existing=causes.get(id);if(existing){for(const f of fields)if(!existing.fields.some(g=>refKey32(g)===refKey32(f)))existing.fields.push(f);return;}
   causes.set(id,{id,title,category:'reference',scope:'document',assessment:'needs_review',importance:'attention',documentIds:[...new Set(fields.map(f=>f.documentId))],relationshipIds:[],fields,rootCauseIds:[id],rootCauseKind:'reference_conflict',referenceCause:{kind,declarationNumber:number},explanation:'검증된 HBL과 실제 신고번호·운송서류 참조 목록의 포함 또는 유일성이 맞지 않습니다. 같은 원인에 의존하는 세부 검사를 함께 보존하며, 독립적인 원문 필드 비교와 실제 수치 오류는 별도로 유지합니다.',followUp:'해당 신고번호의 원본, HBL 기재, 중복·누락 또는 목록의 전체 포함 범위를 확인해 주세요.',comparison:{meaning:kind==='hbl_conflict'?'houseBlNumber':'declarationNumber',hbl,scope:'hbl_record',reasonCodes:['DECLARATION_SCOPE_UNRESOLVED'],relatedCheckIds:[],facts:[]}});
  };
  for(const number of expected){const matches=own.filter(v=>v.number===number),other=declarations.filter(v=>v.number===number&&v.hbl&&v.hbl!==hbl);
   if(matches.length>1)add('duplicate',number,matches.flatMap(v=>[v.f!,...identifiers32(v.d,'houseBlNumber').filter(verified32)]));
   else if(!matches.length&&other.length)add('hbl_conflict',number,other.flatMap(v=>[v.f!,...identifiers32(v.d,'houseBlNumber').filter(verified32)]));
   else if(!matches.length&&!own.some(v=>!v.number)&&!declarations.some(v=>v.number===number&&!v.hbl))add('missing',number,[]);
  }
  for(const v of own.filter(v=>!!v.number)){
   if(known&&!expected.has(v.number!))add('unlisted',v.number!,[v.f!,...identifiers32(v.d,'houseBlNumber').filter(verified32)]);
   if(own.filter(w=>w.number===v.number).length>1)add('duplicate',v.number!,own.filter(w=>w.number===v.number).map(w=>w.f!));
  }
  if(known)for(const carrier of carriers){const fs=identifiers32(carrier,'declarationNumber');if(!fs.length||!fs.every(f=>verified32(f)&&identifierValues32(f).length))continue;const ns=new Set(fs.flatMap(identifierValues32));
   for(const n of ns)if(!expected.has(n))add('unlisted',n,fs);
   for(const n of expected)if(!ns.has(n))add('missing',n,fs);
  }
  if(!known&&own.length>1&&!refs.some(f=>f.field.current.status==='user_edited')){
   add('missing','',[]);const missing=causes.get('declaration-reference/'+bl.id+'/missing/')!;missing.title='운송서류 전체 신고 목록 확인';missing.explanation='같은 HBL의 신고서가 여러 개 있지만 운송서류의 전체 신고 목록을 검증하지 못했습니다. 개별 원문 대조와 전체 합산의 범위 확인은 분리합니다.';
   for(const c of causes.values())if(!checks.some(p=>p.id===c.id))checks.push(c);continue;
  }
  if(!causes.size)continue;
  const candidate=causes.values().next().value!;
  const allocationRoles=new Set(declarationAllocations(docs,[{...candidate,declarationMembership:{hblDocumentId:bl.id,declarationDocumentIds:own.map(v=>v.d.id)}}]).filter(c=>c.assessment==='confirmed_match').map(c=>c.allocationCoverage!.meaning));
  for(const c of checks){
   if(c.semantic&&['INVALID_SEMANTIC_EVIDENCE','SEMANTIC_STALE','SEMANTIC_NOT_COMPLETED','AMBIGUOUS_SEMANTIC_MAPPING'].includes(c.semantic.validationCode))continue;
   if(c.referenceCause||c.rootCauseKind==='value_conflict'||c.assessment==='confirmed_match'||c.assessment==='not_applicable'||c.disposition==='informational'||!c.fields.length||!c.fields.every(verified32)||c.semantic?.nativeClaims?.length||['explicit_conflict','different_product'].includes(c.semantic?.relation??''))continue;
   const ids=[...new Set(c.fields.map(f=>f.documentId))];if(!ids.every(id=>members.has(id)))continue;
   if(c.assessment==='confirmed_mismatch'&&c.category!=='reference')continue;
   if(c.assessment==='provisional_mismatch'&&(['party','port'].includes(c.category)||c.category==='quantity'&&c.fields.filter(f=>f.fieldName==='quantity').every(f=>!!f.itemId||!!f.cargoId)))continue;
   if(['packaging','weight'].includes(c.category)&&!allocationRoles.has(c.comparison?.meaning??''))continue;
   const codes=c.comparison?.reasonCodes??[];if(codes.some(r=>!['SCOPE_UNRESOLVED','DECLARATION_SCOPE_UNRESOLVED','RELATIONSHIP_UNVERIFIED'].includes(r)))continue;
   c.rootCauseIds=[...causes.keys()];c.rootCauseKind='reference_conflict';
  }
  for(const c of causes.values())if(!checks.some(p=>p.id===c.id))checks.push(c);
 }
}
