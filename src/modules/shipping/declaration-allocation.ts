import { relateShipping } from "./relationships";
import type { ShippingCheck } from './review-model';
import type { ShippingDocument } from './schema';
import { containerViews32, containerEntry32, ref32, root32, verified32, unit32, text32, scope32, identifiers32 } from './review-evidence';
// Whole-vs-declaration totals are not equal quantities. Only a disjoint, fully
// enumerated native container allocation proves how to add those declarations.
export function declarationAllocations(documents:ShippingDocument[],proofs:ShippingCheck[]):ShippingCheck[]{
 const out:ShippingCheck[]=[]; const relationships=relateShipping(documents);
 for(const proof of proofs.filter(c=>c.declarationCoverage||c.declarationMembership)){
  const g=(proof.declarationCoverage??proof.declarationMembership)!,bl=documents.find(d=>d.id===g.hblDocumentId)!;
  const blIds=new Set(identifiers32(bl,"houseBlNumber").filter(verified32).map(f=>text32(f.field.current.value)));if(blIds.size!==1)continue;
  const decls=g.declarationDocumentIds.map(id=>documents.find(d=>d.id===id)!);
  const carriers=[bl,...documents.filter(d=>d.detectedType==='house_manifest'&&d.id!==bl.id&&d.classificationStatus==='classified'&&relationships.some(r=>r.status==='evidence_confirmed'&&r.documentIds.includes(bl.id)&&r.documentIds.includes(d.id))&&new Set(identifiers32(d,"houseBlNumber").filter(verified32).map(f=>text32(f.field.current.value))).size===1&&identifiers32(d,"houseBlNumber").filter(verified32).some(f=>blIds.has(text32(f.field.current.value))))];
  const rows=(d:ShippingDocument)=>{
   if(d.nativeScopeLimitation||["partial","combined_packages"].includes(scope32(d))||(d.fields.shipmentScope?.current.value!=null&&d.fields.shipmentScope.current.status!=="verified"))return null;
   const rs=containerViews32(d);if(!d.collectionCoverage?.containers.complete||!rs.length)return null;
   const ids=rs.map(c=>ref32(d,'containerNumber',c.containerNumber,containerEntry32(c)));
   if(!ids.every(verified32)||new Set(ids.map(f=>text32(f.field.current.value))).size!==rs.length)return null;return rs;
  };
  const cr=carriers.map(rows),dr=decls.map(rows);if([...cr,...dr].some(rs=>!rs))continue;
  const assigned=dr.flatMap(rs=>rs!.map(c=>text32(c.containerNumber.current.value)));
  if(new Set(assigned).size!==assigned.length||cr.some(rs=>rs!.length!==assigned.length||rs!.some(c=>!assigned.includes(text32(c.containerNumber.current.value)))))continue;
  for(const[meaning,unitRole,kind]of [['packageCount','packageUnit','packaging'],['grossWeight','grossWeightUnit','weight']]as const){
   const sets=[...carriers,...decls].map((d,i)=>{
    const cs=[...cr,...dr][i]!;const fs=cs.map(c=>ref32(d,meaning,c[meaning],containerEntry32(c))),us=cs.map(c=>ref32(d,unitRole,meaning==='packageCount'?c.packageUnit:c.weightUnit,containerEntry32(c)));
    const root=root32(d,meaning),ru=root32(d,unitRole),units=us.map(u=>unit32(u.field.current.value,kind));
    if(!root||!ru||![...fs,...us,root,ru].every(verified32)||units.some(u=>!u)||!unit32(ru.field.current.value,kind)||fs.some(f=>typeof f.field.current.value!=='number'))return null;
    const rootUnit=unit32(ru.field.current.value,kind)!;if(units.some(u=>u!.unit!==rootUnit.unit))return null;
    const values=fs.map((f,j)=>Number(f.field.current.value)*units[j]!.factor);return{d,fs,us,root,ru,units,values,total:values.reduce((a,b)=>a+b,0),rootValue:Number(root.field.current.value)*unit32(ru.field.current.value,kind)!.factor};
   });
   if(sets.some(s=>!s)||new Set(sets.flatMap(s=>s!.units.map(u=>u!.unit))).size!==1)continue;
   const safe=sets.every(s=>Number.isFinite(s!.total)&&Number.isSafeInteger(Math.ceil(s!.total))&&Number.isFinite(s!.rootValue));if(!safe)continue;
   const ds=sets.slice(carriers.length),sum=ds.reduce((n,s)=>n+s!.rootValue,0),targets=sets.slice(0,carriers.length);
   // Every named container must carry the same allocation in every carrier.
   const aligned=decls.every((d,i)=>dr[i]!.every((c,j)=>targets.every((s,k)=>{
    const index=cr[k]!.findIndex(v=>text32(v.containerNumber.current.value)===text32(c.containerNumber.current.value));return index>=0&&Math.abs(s!.values[index]-ds[i]!.values[j])<=1e-9;
   })));
   const same=aligned&&sets.every(s=>Math.abs(s!.rootValue-s!.total)<=Math.max(1,Math.abs(s!.total))*1e-9)&&targets.every(s=>Math.abs(s!.rootValue-sum)<=Math.max(1,Math.abs(sum))*1e-9);
   out.push({id:proof.id+'/allocation/'+meaning,title:'복수 신고 '+(meaning==='packageCount'?'포장 개수':'총중량')+' 합계',scope:'document',category:meaning==='packageCount'?'packaging':'weight',assessment:same?'confirmed_match':'confirmed_mismatch',importance:same?'info':'high',documentIds:sets.map(s=>s!.d.id),relationshipIds:proof.relationshipIds,fields:sets.flatMap(s=>[...s!.fs,...s!.us,s!.root,s!.ru]),explanation:'명시된 전체 신고의 서로 다른 컨테이너 할당·동일 단위·각 신고 기재 합계와 모든 운송서류의 실제 컨테이너 행 및 기재 합계를 대조했습니다. 비율 배분이나 추정 합산은 하지 않았습니다.',followUp:'신고별 컨테이너 할당과 해당 원문 포장/중량 기재값을 확인해 주세요.',allocationCoverage:{groupCheckId:proof.id,meaning,documentIds:sets.map(s=>s!.d.id)},computedValues:[{documentId:decls.map(d=>d.id).join('+'),value:sum,unit:sets[0]!.units[0]!.unit,formula:'sum',componentKeys:ds.map(s=>s!.d.id)}]});
  }
 }
 return out;
}
