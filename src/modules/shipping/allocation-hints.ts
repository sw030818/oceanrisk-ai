import type {ShippingDocument} from './schema';
import type {ShippingCheck} from './review-model';
import {declarationAllocations} from './declaration-allocation';
import {nativeRecordHbl} from './native-record-link';
import {containerViews32,containerEntry32,root32,ref32,verified32,text32,unit32,identifierValues32} from './review-evidence';
// A counterfactual proves ONLY that reference ambiguity is the remaining cause
// of soft allocation holds. Never export this as membership or a verified sum.
function allocationSignature(d:ShippingDocument) {
 if(!d.collectionCoverage?.containers.complete)return;
 const rows=containerViews32(d),out=[];if(!rows.length)return;
 for(const c of rows){const entry=containerEntry32(c),fs=[['containerNumber',c.containerNumber],['packageCount',c.packageCount],['packageUnit',c.packageUnit],['grossWeight',c.grossWeight],['weightUnit',c.weightUnit],['sealNumber',c.sealNumber]]as const;
  if(!fs.every(([k,f])=>verified32(ref32(d,k,f,entry))))return;
  const p=unit32(c.packageUnit.current.value,'packaging'),w=unit32(c.weightUnit.current.value,'weight');if(!p||!w||typeof c.packageCount.current.value!=='number'||typeof c.grossWeight.current.value!=='number')return;
  out.push([text32(c.containerNumber.current.value),text32(c.sealNumber.current.value),p.unit,c.packageCount.current.value*p.factor,w.unit,c.grossWeight.current.value*w.factor]);
 }
 const roots=[];for(const [role,unitRole,kind]of [['packageCount','packageUnit','packaging'],['grossWeight','grossWeightUnit','weight']]as const){const f=root32(d,role),u=root32(d,unitRole),unit=u&&unit32(u.field.current.value,kind);if(!f||!u||!verified32(f)||!verified32(u)||!unit||typeof f.field.current.value!=='number')return;roots.push([unit.unit,f.field.current.value*unit.factor]);}
 const hbl=nativeRecordHbl(d);if(!hbl)return;
 return JSON.stringify([hbl,roots,out.sort((a,b)=>String(a[0]).localeCompare(String(b[0])))]);
}
export function allocationDependencyRoles(documents:ShippingDocument[],bl:ShippingDocument,candidates:ShippingDocument[],cause:ShippingCheck) {
 const groups=new Map<string,ShippingDocument[]>();
 for(const d of candidates){const f=root32(d,'declarationNumber');if(!f||!verified32(f)||identifierValues32(f).length!==1)return new Set<string>();const n=text32(f.field.current.value);groups.set(n,[...(groups.get(n)??[]),d]);}
 const selected=[];for(const group of groups.values()){
  if(group.length>1){const signatures=group.map(allocationSignature);if(signatures.some(v=>!v)||new Set(signatures).size!==1)return new Set<string>();}
  selected.push(group[0]);
 }
 if(!selected.length)return new Set<string>();
 // Foreign-HBL candidates are included for value-consistency attribution only.
 // Their literal HBL conflict remains explicit; no actual grouping is changed.
 const hypothesis={...cause,declarationMembership:{hblDocumentId:bl.id,declarationDocumentIds:selected.map(d=>d.id)}};
 return new Set(declarationAllocations(documents,[hypothesis]).filter(c=>c.assessment==='confirmed_match').map(c=>c.allocationCoverage!.meaning));
}
