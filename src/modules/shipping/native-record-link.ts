import type{ShippingDocument}from'./schema';
import type{ShippingRelationship}from'./review-model';
import{identifiers32,root32,text32,verified32}from'./review-evidence';
import{partyMatch32}from'./parties';
export function nativeRecordHbl(d:ShippingDocument){
 if(identifiers32(d,'houseBlNumber').some(f=>f.field.current.status==='user_edited'))return null;
 const fs=identifiers32(d,'houseBlNumber').filter(verified32);
 if(!fs.length)return null;
 const ids=[...new Set(fs.map(f=>text32(f.field.current.value)))];return ids.length===1?ids[0]:null;
}
// A reference-list gap is not permission to mix shipments, nor a veto on
// independently verified fields in the same explicitly named HBL record.
export function nativeRecordLinked(a:ShippingDocument,b:ShippingDocument,relations:ShippingRelationship[]){
 if([a,b].some(d=>d.classificationStatus!=='classified'||d.references.some(r=>r.number.current.status==='user_edited')||['houseBlNumber','declarationNumber','shipmentReference','shipper','consignee','exporter','exporterIdentifier'].some(role=>d.fields[role]?.current.status==='user_edited'||d.additionalFields.some(f=>f.meaning===role&&f.field.current.status==='user_edited'))))return false;
 const h=nativeRecordHbl(a);if(!h||nativeRecordHbl(b)!==h)return false;
 const r=relations.find(r=>r.documentIds.includes(a.id)&&r.documentIds.includes(b.id));
 if(!r||!r.sharedRoles.includes('houseBlNumber')||r.conflictRoles.length||r.status!=='evidence_confirmed'&&!r.mappingWarnings?.length)return false;
 for(const role of ['shipper','consignee']){const x=root32(a,role),y=root32(b,role);if(x&&y&&verified32(x)&&verified32(y)){const m=partyMatch32(x,y);if(!m.certain||m.addressConflict||m.same===false)return false;}}
 return true;
}
