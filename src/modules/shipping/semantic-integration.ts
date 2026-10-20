import { linkDeclarationDependencies } from "./dependency-causes";
import { matchProductRows } from "./product-matching";
import { ref32 } from "./review-evidence";
import type { ShippingDocument } from "./schema";
import type { ShippingCheck, ShippingReview } from "./review-model";
import { semanticContext } from "./semantic-context";
import { semanticWireSchema, type SemanticReport } from "./semantic-schema";
import { validateSemanticDecision, nativeAttributeClaims } from "./semantic-validation";
import { withReviewIssues } from "./issues";
import { hsSix } from "./equivalence";
import { refKey32, verified32, text32 } from "./review-evidence";
export function withSemanticReview(base: ShippingReview, documents: ShippingDocument[], report?: SemanticReport): ShippingReview {
  if(!report || report.status==="not_needed")return base;
  const context=semanticContext(documents), primary=(base.primaryChecks??base.checks).map(check=>({...check})), wire=semanticWireSchema.safeParse(report.decisions);
  const fresh=report.inputKey===context.key, ds=fresh&&wire.success&&report.status!=="failed"?wire.data.pairs:[];
  const covered=new Set<string>();
  // A complete native/AI-validated declaration assignment identifies intended
  // counterparts. Cartesian pairs belonging to other items are not faults.
  const canonical=new Map<string,string>();
  for(const proof of base.checks.filter(c=>c.declarationCoverage?.itemMappings)){
    const group=proof.declarationCoverage!,bl=documents.find(d=>d.id===group.hblDocumentId)!;
    for(const i of bl.items)canonical.set(refKey32(ref32(bl,"goodsDescription",i.fields.goodsDescription,{itemId:i.id})),bl.id+"/"+i.id);
    for(const m of group.itemMappings!)canonical.set(refKey32({documentId:m.documentId,fieldName:"goodsDescription",itemId:m.itemId,field:bl.items[0].fields.goodsDescription}),bl.id+"/"+m.targetItemId);
    for(const d of documents.filter(d=>d.detectedType==="house_manifest"&&d.classificationStatus==="classified"&&d.collectionCoverage?.items.complete)){
      const mapped=matchProductRows(d.items.map(i=>ref32(d,"goodsDescription",i.fields.goodsDescription,{itemId:i.id})),bl.items.map(i=>ref32(bl,"goodsDescription",i.fields.goodsDescription,{itemId:i.id})),documents,report);
      if(mapped.strong)for(const m of mapped.matches)canonical.set(refKey32(m.left),bl.id+"/"+m.right.itemId);
    }
  }
  const disjoint=(left:string,right:string)=>canonical.has(left)&&canonical.has(right)&&canonical.get(left)!==canonical.get(right);

  for(const pair of context.pairs) {
    if(disjoint(pair.left.id,pair.right.id))continue;
    const decisions=ds.filter(d=>d.leftId===pair.left.id&&d.rightId===pair.right.id), d=decisions[0];
    const mapped=(id:string,otherDoc:string,excludedOtherId:string)=>ds.some(other=>{
      if(!["same_product","compatible_incomplete"].includes(other.relation)||[other.leftId,other.rightId].includes(excludedOtherId))return false;
      const p=context.pairs.find(p=>p.left.id===other.leftId&&p.right.id===other.rightId);
      return !!p && ((p.left.id===id&&p.right.ref.documentId===otherDoc)||(p.right.id===id&&p.left.ref.documentId===otherDoc)) && validateSemanticDecision(other,p).assessment==="provisional_match";
    });
    if((!d||["different_product","explicit_conflict"].includes(d.relation))&&mapped(pair.left.id,pair.right.ref.documentId,pair.right.id)&&mapped(pair.right.id,pair.left.ref.documentId,pair.left.id))continue;
    let tested=d?validateSemanticDecision(d,pair):{assessment:"needs_review" as const,code:fresh?"SEMANTIC_NOT_COMPLETED":"SEMANTIC_STALE",reason:fresh?(report.status==="failed"&&report.error?"상품 의미 분석 실패: "+report.error.message+" 기존 수치·참조 검사는 보존합니다.":"상품 의미 분석이 완료되지 않았습니다. 기존 수치·참조 검사는 보존합니다."):"문서/사용자 수정으로 이전 AI 의미 근거가 달라져 해당 결과를 사용하지 않습니다. 재분석 전까지 기존 검사를 유지합니다."};
    if(!d&&fresh&&canonical.has(pair.left.id)&&canonical.get(pair.left.id)===canonical.get(pair.right.id)&&!nativeAttributeClaims(pair).length)
      tested={assessment:'not_applicable',code:'VERIFIED_ALTERNATE_OWNER_PATH',reason:'이 직접 AI 의견은 완료되지 않아 사용하지 않았습니다. 같은 원문 품목의 검증된 전체 신고 대응과 운송서류의 유일한 원문 행 대응 경로가 이미 입증되어 중복 의미 확인을 요구하지 않습니다. 최초 AI 응답과 미완료 진단은 보존합니다.'};
    const rejectedCross=(other:typeof ds[number])=>{const p=context.pairs.find(p=>p.left.id===other.leftId&&p.right.id===other.rightId);return other.relation==="explicit_conflict"&&!!p&&mapped(p.left.id,p.right.ref.documentId,p.right.id)&&mapped(p.right.id,p.left.ref.documentId,p.left.id);};
    const ambiguous=ds.some(other=>other!==d&&!disjoint(other.leftId,other.rightId)&&!rejectedCross(other)&&!["unknown","different_product"].includes(other.relation)&&((other.leftId===pair.left.id&&other.rightId!==pair.right.id&&context.products.find(p=>p.id===other.rightId)?.ref.documentId===pair.right.ref.documentId)||(other.rightId===pair.right.id&&other.leftId!==pair.left.id&&context.products.find(p=>p.id===other.leftId)?.ref.documentId===pair.left.ref.documentId)));
    if(decisions.length>1||ambiguous)tested={assessment:"needs_review",code:"AMBIGUOUS_SEMANTIC_MAPPING",reason:"AI 응답에 중복/다대일 품목 대응이 있어 일대일 관계를 확정하지 않습니다."};
    const id="semantic/"+pair.left.id+"/"+pair.right.id;
    const c:ShippingCheck={id,scope:pair.left.documentType==="export_declaration"||pair.right.documentType==="export_declaration"?(pair.left.documentType==="house_manifest"||pair.right.documentType==="house_manifest"?"declaration_manifest":"house_bl_declaration"):"house_bl_manifest",category:"goods",title:"AI 상품 의미 · 규격 비교",assessment:tested.assessment,importance:tested.assessment==="confirmed_mismatch"?"high":"attention",
      disposition:tested.assessment==="provisional_match"&&["AI_SEMANTIC_EQUIVALENCE","AI_INCOMPLETE_ATTRIBUTES"].includes(tested.code)?"informational":undefined,
      documentIds:[pair.left.ref.documentId,pair.right.ref.documentId],fields:[pair.left.ref,pair.right.ref],relationshipIds:[pair.relationshipId],
      explanation:tested.reason+(d&&tested.code!=="INVALID_SEMANTIC_EVIDENCE"?" AI 설명: "+d.explanation:""),
      followUp:"원문 품명·모델·규격과 해당 품목 대응을 확인해 주세요. 사용자 수정 후에는 이전 AI 의미 결과를 재사용하지 않습니다.",
      uncertainties:tested.assessment==="confirmed_mismatch"?[]:[tested.code],
      semantic:{source:"openai",relation:d?.relation??"unknown",validationCode:tested.code,model:report.model,claims:d?.claims??[],nativeClaims:d?nativeAttributeClaims(pair):[]},
    };
    // Only replace an exactly covered, solely semantic hold. Original checks and
    // independently confirmed mismatches are never removed or downgraded.
    if(["provisional_match","confirmed_mismatch"].includes(tested.assessment)) {
      const keys=new Set(c.fields.map(refKey32));
      for(const old of primary)if(!covered.has(old.id)&&old.category==="goods"&&old.assessment.startsWith("provisional")&&old.comparison?.meaning==="goodsDescription"&&old.fields.every(f=>f.fieldName==="goodsDescription"&&verified32(f)&&keys.has(refKey32(f)))&&old.comparison.reasonCodes.every(r=>r==="SCOPE_UNRESOLVED")) {
        covered.add(old.id);c.comparison={meaning:"goodsDescription",hbl:pair.left.hbl,scope:"hbl_record",reasonCodes:[],relatedCheckIds:[old.id,...old.comparison.relatedCheckIds],facts:[]};
      }
    }
    primary.push(c);
  }
  if(context.omittedPairs)primary.push({id:"semantic/input-bound",scope:"document",category:"goods",assessment:"needs_review",title:"일부 상품 의미 비교 미완료",fields:[],relationshipIds:[],explanation:`추가 ${context.omittedPairs}개 후보는 의미 분석의 안전한 입력·출력 범위를 초과했습니다. 이미 완료된 원문·수치 검사는 보존합니다.`,followUp:"자료를 선적별로 나누어 나머지 품목의 의미를 확인해 주세요."});
  // A unique, complete native row per linked document proves the association
  // scope. AI supplies language meaning; it does not change literal HS digits.
  // Resolve ONLY the old dictionary-dependent hold, never other scope reasons.
  const semanticChecks=primary.filter(c=>c.semantic);
  for(const old of primary.filter(c=>!c.semantic&&!covered.has(c.id))) {
    if(!fresh || report.status==="failed" || !old.comparison?.hbl ||
      !["goodsDescription","hsCode"].includes(old.comparison.meaning) ||
      !old.assessment.startsWith("provisional") ||
      !old.comparison.reasonCodes.length || old.comparison.reasonCodes.some(code=>code!=="SCOPE_UNRESOLVED") ||
      old.fields.some(f=>!verified32(f)))continue;
    const ids=[...new Set(old.fields.map(f=>f.documentId))];
    const ps=ids.map(id=>context.products.filter(p=>p.ref.documentId===id&&p.hbl===old.comparison!.hbl));
    if(ids.length<2 || ps.some(xs=>!xs.length||xs.some(p=>!p.collectionComplete)||new Set(xs.map(p=>text32(p.ref.field.current.value))).size!==xs.length))continue;
    const matches:(typeof context.pairs[number])[]=[];let complete=true;
    for(const[leftIndex,lefts]of ps.entries())for(const rights of ps.slice(leftIndex+1)){
      if(lefts.length!==rights.length){complete=false;continue;}
      const used=new Set<string>();
      for(const left of lefts){
        const candidates=rights.filter(right=>String(left.ref.field.current.value)===String(right.ref.field.current.value)||semanticChecks.some(c=>c.disposition==="informational"&&c.fields.some(f=>refKey32(f)===left.id)&&c.fields.some(f=>refKey32(f)===right.id)));
        if(candidates.length!==1||used.has(candidates[0].id)){complete=false;continue;}
        used.add(candidates[0].id);matches.push({left,right:candidates[0],relationshipId:""});
      }
    }
    if(!complete)continue;
    const prior={assessment:old.assessment,explanation:old.explanation,reasonCodes:[...old.comparison.reasonCodes]};
    const hs=matches.map(({left,right})=>[hsSix(left.hsCode),hsSix(right.hsCode)]);
    if(old.comparison.meaning==="hsCode" && (!hs.length||hs.some(pair=>pair.some(v=>!v))||old.fields.some(f=>!f.itemId&&!f.cargoId&&ps[ids.indexOf(f.documentId)].length>1)))continue;
    old.assessment=old.comparison.meaning==="hsCode"?(hs.every(([a,b])=>a===b)?"confirmed_match":"confirmed_mismatch"):"provisional_match";
    if(old.comparison.meaning==="goodsDescription"){old.disposition="informational";old.title="화물 품명 · AI 상품 의미 대응";}
    old.semantic={source:"openai",relation:"compatible_incomplete",validationCode:old.comparison.meaning==="hsCode"?"VERIFIED_HS_DIGITS_NATIVE_OWNER":"AI_SEMANTIC_EQUIVALENCE",model:report.model,claims:[],prior};
    const resolvedPairs=old.comparison.meaning==="goodsDescription"?semanticChecks.filter(c=>c.disposition==="informational"&&c.fields.every(f=>ps.flat().some(p=>p.id===refKey32(f)))):[];
    for(const c of resolvedPairs)covered.add(c.id);
    old.comparison={...old.comparison,reasonCodes:[],relatedCheckIds:[...new Set([...old.comparison.relatedCheckIds,...resolvedPairs.map(c=>c.id)])]};
    old.explanation=old.comparison.meaning==="hsCode"?"같은 선적의 실제 전체 품목행과 일대일 대응을 확인한 뒤, 각 대응 품목의 검증된 HS 공통 6자리를 코드로 비교했습니다. 전체 국가별 세번 동일성이나 상품 분류의 적법성을 뜻하지 않습니다.":"AI 의미 대응: 한영·상이한 상품 설명을 검토했습니다. 같은 선적·전체 원문 행과 일대일 품목 대응은 별도로 검증했으며, 언어적 동일성은 잠정으로 구분합니다. "+resolvedPairs.map(c=>c.explanation).join(" ");
  }
  const checks=primary.filter(c=>!covered.has(c.id));
  linkDeclarationDependencies(checks,base.checks,documents);
  const outcomes=base.outcomes?{...base.outcomes,matches:checks.filter(c=>c.assessment==="confirmed_match").length,mismatches:checks.filter(c=>c.assessment==="confirmed_mismatch").length,review:checks.filter(c=>c.disposition!=="informational"&&(c.assessment.startsWith("provisional")||c.assessment==="needs_review")).length,comparisonEvidenceUnverified:new Set(checks.flatMap(c=>c.fields.filter(f=>f.field.current.value!==null&&!verified32(f)).map(refKey32))).size,informational:checks.filter(c=>c.disposition==="informational").length,independentChecks:checks.length}:undefined;
  return withReviewIssues({...base,status:checks.some(c=>c.disposition!=="informational"&&c.assessment!=="confirmed_match"&&c.assessment!=="not_applicable")?"needs_review":"complete",primaryChecks:checks,outcomes,semantic:report},documents);
}
