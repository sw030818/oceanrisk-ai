import type { ShippingDocument } from "./schema";
import type { ShippingCheck, ShippingReview } from "./review-model";
import { semanticContext } from "./semantic-context";
import { semanticWireSchema, type SemanticReport } from "./semantic-schema";
import { validateSemanticDecision, nativeAttributeClaims } from "./semantic-validation";
import { withReviewIssues } from "./issues";
import { hsSix } from "./equivalence";
import { refKey32, verified32 } from "./review-evidence";
export function withSemanticReview(base: ShippingReview, documents: ShippingDocument[], report?: SemanticReport): ShippingReview {
  if(!report || report.status==="not_needed")return base;
  const context=semanticContext(documents), primary=(base.primaryChecks??base.checks).map(check=>({...check})), wire=semanticWireSchema.safeParse(report.decisions);
  const fresh=report.inputKey===context.key, ds=fresh&&wire.success&&report.status!=="failed"?wire.data.pairs:[];
  const covered=new Set<string>();
  for(const pair of context.pairs) {
    const decisions=ds.filter(d=>d.leftId===pair.left.id&&d.rightId===pair.right.id), d=decisions[0];
    const mapped=(id:string,otherDoc:string)=>ds.some(other=>{
      if(other.relation==="unknown")return false;
      const p=context.pairs.find(p=>p.left.id===other.leftId&&p.right.id===other.rightId);
      return !!p && ((p.left.id===id&&p.right.ref.documentId===otherDoc)||(p.right.id===id&&p.left.ref.documentId===otherDoc)) && validateSemanticDecision(other,p).code!=="INVALID_SEMANTIC_EVIDENCE";
    });
    if(!d&&mapped(pair.left.id,pair.right.ref.documentId)&&mapped(pair.right.id,pair.left.ref.documentId))continue;
    let tested=d?validateSemanticDecision(d,pair):{assessment:"needs_review" as const,code:fresh?"SEMANTIC_NOT_COMPLETED":"SEMANTIC_STALE",reason:fresh?(report.status==="failed"&&report.error?"상품 의미 분석 실패: "+report.error.message+" 기존 수치·참조 검사는 보존합니다.":"상품 의미 분석이 완료되지 않았습니다. 기존 수치·참조 검사는 보존합니다."):"문서/사용자 수정으로 이전 AI 의미 근거가 달라져 해당 결과를 사용하지 않습니다. 재분석 전까지 기존 검사를 유지합니다."};
    const ambiguous=ds.some(other=>other!==d&&other.relation!=="unknown"&&((other.leftId===pair.left.id&&other.rightId!==pair.right.id&&context.products.find(p=>p.id===other.rightId)?.ref.documentId===pair.right.ref.documentId)||(other.rightId===pair.right.id&&other.leftId!==pair.left.id&&context.products.find(p=>p.id===other.leftId)?.ref.documentId===pair.left.ref.documentId)));
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
    if(ids.length<2 || ps.some(p=>p.length!==1||!p[0].whole))continue;
    const linked=ps.flatMap((p,i)=>ps.slice(i+1).map(q=>{
      if(String(p[0].ref.field.current.value)===String(q[0].ref.field.current.value))return true;
      return semanticChecks.some(c=>c.assessment==="provisional_match"&&c.fields.some(f=>refKey32(f)===p[0].id)&&c.fields.some(f=>refKey32(f)===q[0].id)&&["AI_SEMANTIC_EQUIVALENCE","AI_INCOMPLETE_ATTRIBUTES"].includes(c.semantic!.validationCode));
    }));
    if(!linked.every(Boolean))continue;
    const prior={assessment:old.assessment,explanation:old.explanation,reasonCodes:[...old.comparison.reasonCodes]};
    const hs=old.fields.filter(f=>f.fieldName==="hsCode").map(f=>hsSix(f.field.current.value));
    if(old.comparison.meaning==="hsCode" && (hs.length<2||hs.some(v=>!v)))continue;
    old.assessment=old.comparison.meaning==="hsCode"?(new Set(hs).size===1?"confirmed_match":"confirmed_mismatch"):"provisional_match";
    if(old.comparison.meaning==="goodsDescription"){old.disposition="informational";old.title="화물 품명 · AI 상품 의미 대응";}
    old.semantic={source:"openai",relation:"compatible_incomplete",validationCode:old.comparison.meaning==="hsCode"?"VERIFIED_HS_DIGITS_NATIVE_OWNER":"AI_SEMANTIC_EQUIVALENCE",model:report.model,claims:[],prior};
    const resolvedPairs=old.comparison.meaning==="goodsDescription"?semanticChecks.filter(c=>c.disposition==="informational"&&c.fields.every(f=>ps.flat().some(p=>p.id===refKey32(f)))):[];
    for(const c of resolvedPairs)covered.add(c.id);
    old.comparison={...old.comparison,reasonCodes:[],relatedCheckIds:[...new Set([...old.comparison.relatedCheckIds,...resolvedPairs.map(c=>c.id)])]};
    old.explanation=old.comparison.meaning==="hsCode"?"같은 선적의 유일한 전체 원문 품목과 AI 의미 대응을 연결한 뒤, 검증된 HS 공통 6자리 자체를 코드로 비교했습니다. 전체 국가별 세번 동일성이나 상품 분류의 적법성을 뜻하지 않습니다.":"AI 의미 대응: 한영·상이한 상품 설명을 검토했습니다. 같은 선적·유일 원문 품목 범위는 별도로 검증했으며, 언어적 동일성은 잠정으로 구분합니다.";
  }
  const checks=primary.filter(c=>!covered.has(c.id));
  const outcomes=base.outcomes?{...base.outcomes,matches:checks.filter(c=>c.assessment==="confirmed_match").length,mismatches:checks.filter(c=>c.assessment==="confirmed_mismatch").length,review:checks.filter(c=>c.disposition!=="informational"&&(c.assessment.startsWith("provisional")||c.assessment==="needs_review")).length,informational:checks.filter(c=>c.disposition==="informational").length,independentChecks:checks.length}:undefined;
  return withReviewIssues({...base,status:checks.some(c=>c.disposition!=="informational"&&c.assessment!=="confirmed_match"&&c.assessment!=="not_applicable")?"needs_review":"complete",primaryChecks:checks,outcomes,semantic:report},documents);
}
