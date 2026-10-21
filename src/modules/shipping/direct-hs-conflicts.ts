import type{ShippingDocument}from'./schema';import type{ShippingCheck,ShippingRelationship}from'./review-model';import{goodsCore,hsSix}from'./equivalence';import{goodsComparisonValue}from'./goods-context';import{ref32,verified32,scope32,identifiers32,text32}from'./review-evidence';
// An untranslated third document cannot veto an independently proved literal
// HS conflict between uniquely corresponding complete carrier item collections.
export function directHsConflicts(docs:ShippingDocument[],relations:ShippingRelationship[],primary:ShippingCheck[]){
 for(const a of docs.filter(d=>d.detectedType==='house_bl'))for(const b of docs.filter(d=>d.detectedType==='house_manifest')){
  const rel=relations.find(r=>r.status==='evidence_confirmed'&&r.documentIds.includes(a.id)&&r.documentIds.includes(b.id));
  const hbls=new Set(identifiers32(a,'houseBlNumber').filter(verified32).map(f=>text32(f.field.current.value)));
  if([a,b].some(d=>docs.filter(other=>other.detectedType===d.detectedType&&identifiers32(other,'houseBlNumber').filter(verified32).some(f=>hbls.has(text32(f.field.current.value)))).length!==1))continue;
  if(!rel||[a,b].some(d=>d.classificationStatus!=='classified'||!d.collectionCoverage?.items.complete||!d.items.length||d.nativeScopeLimitation||['partial','combined_packages'].includes(scope32(d))||d.fields.shipmentScope?.current.status==='user_edited'))continue;
  const key=(i:typeof a.items[number])=>goodsCore(goodsComparisonValue(i.fields.goodsDescription));
  if([a,b].some(d=>new Set(d.items.map(key)).size!==d.items.length))continue;
  for(const left of a.items){const rights=b.items.filter(i=>key(i)===key(left));if(!key(left)||rights.length!==1)continue;const right=rights[0];
   const fields=[ref32(a,'goodsDescription',left.fields.goodsDescription,{itemId:left.id}),ref32(a,'hsCode',left.fields.hsCode,{itemId:left.id}),ref32(b,'goodsDescription',right.fields.goodsDescription,{itemId:right.id}),ref32(b,'hsCode',right.fields.hsCode,{itemId:right.id})];
   const l=hsSix(left.fields.hsCode.current.value),r=hsSix(right.fields.hsCode.current.value);if(!l||!r||l===r||!fields.every(verified32))continue;
   if(primary.some(c=>c.assessment==='confirmed_mismatch'&&c.comparison?.meaning==='hsCode'&&[a.id,b.id].every(id=>c.fields.some(f=>f.documentId===id))))continue;
   const id='native-hs/'+a.id+'/'+left.id+'/'+b.id+'/'+right.id;
   primary.push({id,rootCauseIds:[id],rootCauseKind:'value_conflict',scope:'house_bl_manifest',category:'goods',title:'같은 원문 품목의 HS 공통 6자리 충돌',assessment:'confirmed_mismatch',importance:'high',documentIds:[a.id,b.id],relationshipIds:[rel.id],fields,explanation:'검증된 같은 HBL의 전체 품목 표에서 원문 품명이 유일하게 대응하는 행의 실제 HS 공통 6자리를 비교했습니다. 다른 서류의 번역 보류와 독립적인 숫자 충돌입니다.',followUp:'해당 품목의 원문 세번과 작성자의 분류 근거를 확인해 주세요.',comparison:{meaning:'hsCode',hbl:null,scope:'hbl_record',reasonCodes:[],relatedCheckIds:[],facts:[]}});
  }
 }
}
