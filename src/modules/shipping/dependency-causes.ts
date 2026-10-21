import type { ShippingDocument } from "./schema";
import { relateShipping } from "./relationships";
import { scope32 } from "./review-evidence";
import type{ShippingCheck}from'./review-model';import{verified32}from'./review-evidence';
// Causal edges join only language/owner-dependent holds in an explicitly proved
// declaration membership. Native attribute/HS/unit faults remain independent.
export function linkDeclarationDependencies(primary:ShippingCheck[],original:ShippingCheck[],documents:ShippingDocument[]){
 const relationships=relateShipping(documents);
 for(const group of original.filter(c=>c.rootCauseIds?.length&&c.declarationMembership)){
  const members=new Set([group.declarationMembership!.hblDocumentId,...group.declarationMembership!.declarationDocumentIds]);
  for(const d of documents)if(d.detectedType==="house_manifest"&&d.classificationStatus==="classified"&&!d.nativeScopeLimitation&&!["partial","combined_packages"].includes(scope32(d))&&relationships.some(r=>r.status==="evidence_confirmed"&&r.sharedRoles.includes("houseBlNumber")&&r.documentIds.includes(group.declarationMembership!.hblDocumentId)&&r.documentIds.includes(d.id)))members.add(d.id);

  for(const c of primary){
   if(c.assessment==='confirmed_mismatch'||c.assessment==='confirmed_match'||c.assessment==='not_applicable'||c.disposition==='informational')continue;
   const ids=c.documentIds??c.fields.map(f=>f.documentId);
   if(!ids.length||!ids.every(id=>members.has(id))||!c.fields.every(verified32)||c.semantic?.nativeClaims?.length||['explicit_conflict','different_product'].includes(c.semantic?.relation??''))continue;
   const codes=c.comparison?.reasonCodes??[];
   if(codes.some(code=>!['SCOPE_UNRESOLVED','DECLARATION_SCOPE_UNRESOLVED'].includes(code)))continue;
   const role=c.comparison?.meaning;
   if(role==='hsCode'&&new Set(c.fields.filter(f=>f.fieldName==='hsCode').map(f=>String(f.field.current.value).replace(/\D/g,''))).size>1)continue;
   if(!['goodsDescription','hsCode','quantity'].includes(role??'')&&!c.semantic&&c.id!==group.id)continue;
   c.rootCauseIds=[...group.rootCauseIds!];
   c.rootCauseKind=group.rootCauseKind;
  }
 }
}
