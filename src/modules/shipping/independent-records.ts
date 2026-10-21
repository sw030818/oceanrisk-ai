import type{ShippingDocument}from'./schema';import type{ShippingCheck,ShippingRelationship}from'./review-model';
import{nativeRecordHbl,nativeRecordLinked}from'./native-record-link';import{ref32,scope32,text32,verified32,unit32}from'./review-evidence';
// Record-to-record comparisons are not a claim that every declaration has been
// supplied. Never infer allocations or turn an unverified field into evidence.
export function resolveIndependentRecords(checks:ShippingCheck[],documents:ShippingDocument[],relations:ShippingRelationship[]){
 for(const c of checks){
  if(!['provisional_match','provisional_mismatch'].includes(c.assessment)||!c.fields.length||!c.fields.every(verified32))continue;
  const codes=c.comparison?.reasonCodes??[];if(codes.some(r=>!['SCOPE_UNRESOLVED','DECLARATION_SCOPE_UNRESOLVED','RELATIONSHIP_UNVERIFIED'].includes(r)))continue;
  const ids=[...new Set(c.fields.map(f=>f.documentId))],ds=ids.map(id=>documents.find(d=>d.id===id)!);if(ids.length!==2||ds.some(d=>!d||d.nativeScopeLimitation||['partial','combined_packages'].includes(scope32(d))||d.fields.shipmentScope?.current.status==='user_edited'||(d.fields.shipmentScope?.current.value!=null&&d.fields.shipmentScope.current.status!=='verified'))||!nativeRecordLinked(ds[0],ds[1],relations))continue;
  if(ds.some(d=>d.detectedType!=='export_declaration'&&documents.filter(v=>v.detectedType===d.detectedType&&nativeRecordHbl(v)===nativeRecordHbl(d)).length!==1))continue;
  const meaning=c.comparison?.meaning;
  if(c.assessment==='provisional_match'&&['shipper','exporter','consignee','portOfLoading','portOfDischarge'].includes(meaning??'')){
   c.assessment='confirmed_match';c.independentOwnerProof='same_hbl_document_record';c.comparison!.reasonCodes=[];c.uncertainties=[];c.explanation='같은 검증 HBL의 원문 기재 항목을 독립 대조했습니다. 신고 목록의 완전성이나 전체 물품 합산을 확정한 결과는 아닙니다.';continue;
  }
  if(!['packageCount','grossWeight','netWeight','sealNumber'].includes(meaning??''))continue;
  const fs=c.fields.filter(f=>f.fieldName===meaning);if(fs.length<2)continue;
  const owners=fs.map(f=>{const d=documents.find(d=>d.id===f.documentId)!,cargo=f.cargoId&&d.cargoRecords.find(v=>v.id===f.cargoId),container=f.containerId&&d.containers.find(v=>v.id===f.containerId);const field=cargo?cargo.fields.containerNumber:container?container.containerNumber:undefined;return field&&verified32(ref32(d,'containerNumber',field,cargo?{cargoId:cargo.id}:{containerId:container?container.id:''}))?text32(field.current.value):null;});
  if(owners.some(v=>!v)||new Set(owners).size!==1)continue;
  if(meaning!=='sealNumber'){
   const values=fs.map(f=>{const d=documents.find(d=>d.id===f.documentId)!,cargo=d.cargoRecords.find(v=>v.id===f.cargoId),container=d.containers.find(v=>v.id===f.containerId),role=meaning==='packageCount'?'packageUnit':'weightUnit',field=cargo?.fields[role]??container?.[role],unit=field&&unit32(field.current.value,meaning==='packageCount'?'packaging':'weight');
    return field&&unit&&verified32(ref32(d,role,field,cargo?{cargoId:cargo.id}:{containerId:container!.id}))&&typeof f.field.current.value==='number'&&Number.isFinite(f.field.current.value)?{documentId:d.id,value:f.field.current.value*unit.factor,unit:unit.unit}:null;});
   if(values.some(v=>!v)||new Set(values.map(v=>v!.unit)).size!==1)continue;
   const sides=ids.map(id=>new Set(values.filter(v=>v!.documentId===id).map(v=>v!.value)));if(sides.some(v=>v.size!==1))continue;
   const equal=[...sides[0]][0]===[...sides[1]][0];if(equal!==(c.assessment==='provisional_match'))continue;
  }
  c.assessment=c.assessment==='provisional_match'?'confirmed_match':'confirmed_mismatch';c.importance=c.assessment==='confirmed_match'?'info':'high';c.independentOwnerProof='same_hbl_container_record';c.comparison!.reasonCodes=[];c.uncertainties=[];c.explanation='같은 검증 HBL·동일 원문 컨테이너 행의 기재값과 호환 단위를 직접 대조했습니다. 다른 컨테이너·전체 선적 합계·비율 배분을 사용하지 않았습니다.';
 }
}
