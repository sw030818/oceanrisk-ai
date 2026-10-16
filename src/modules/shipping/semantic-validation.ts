import { normalizeText } from "../evidence/verify";
import { numericTokens } from "../evidence/numbers";
import type { SemanticDecision } from "./semantic-schema";
import type { SemanticProduct, SemanticPair } from "./semantic-context";
import type { ShippingAssessment } from "./review-model";
export function semanticEvidenceValid(e: SemanticDecision["left"], p: SemanticProduct) {
  if (e.fieldId !== p.id || new Set(e.blockIds).size !== e.blockIds.length) return false;
  const quote = normalizeText(e.quote);
  if(!quote)return false;
  return p.descriptions.some(d => {
    if (!normalizeText(d.value).includes(quote) || !e.blockIds.every(id=>d.blockIds.includes(id))) return false;
    const blocks = p.ref.field.current.source?.blocks ?? [];
    const selected = e.blockIds.map(id=>blocks.find(b=>b.id===id));
    if (selected.every(b=>!!b)) {
      const text = selected.map(b=>b!.text).join(" ");
      return normalizeText(text).includes(quote);
    }
    // Native bilingual context stores a whole proved line and all of its IDs.
    // Without per-word blocks, a partial set of that line's IDs is not proof.
    return e.blockIds.length===d.blockIds.length && d.blockIds.every(id=>e.blockIds.includes(id));
  });
}
export function literalAttributeConflict(claim: SemanticDecision["claims"][number]) {
  if (!["model","capacity","size","specification"].includes(claim.attribute)) return false;
  const label = normalizeText(claim.label);
  const labels={model:/^(model(?:\s*(?:no\.?|number))?|모델(?:명|번호)?|part\s*(?:no\.?|number)|sku|item\s*code)$/,size:/^(size|사이즈|치수)$/,capacity:/^(capacity|용량|volume|용적)$/,specification:/^(ram|memory|메모리|diameter|직경|length|길이|width|너비|height|높이|thickness|두께|voltage|전압|power|출력|specification|규격)$/};
  if(!labels[claim.attribute as keyof typeof labels]?.test(label))return false;
  const values = [claim.left.quote,claim.right.quote].map(quote=>{
    const text=normalizeText(quote), parts=text.split(label);
    if(parts.length!==2 || (parts[0] && /[\p{L}\p{N}]$/u.test(parts[0])) || (parts[1] && /^[\p{L}]/u.test(parts[1]))) return null;
    return parts.join("").replace(/^[\s:=#-]+|[\s:=#-]+$/g,"").trim();
  });
  if(values.some(v=>!v)) return false;
  const [a,b]=values as [string,string];
  if(claim.attribute==="model")return /^[a-z0-9][a-z0-9._-]{0,60}$/i.test(a)&&/^[a-z0-9][a-z0-9._-]{0,60}$/i.test(b)&&a!==b;
  if(claim.attribute==="size"&&[a,b].every(v=>/^(xxs|xs|s|m|l|xl|xxl|xxxl)$/i.test(v)))return a!==b;
  const parsed=[a,b].map(v=>v.match(/^(\d+(?:[.,]\d+)*)\s*([a-zµμ가-힣%]+)?$/i));
  if(parsed.some(p=>!p))return false;
  const units=parsed.map(p=>p![2]??"");
  if(units[0]!==units[1]||units.some(u=>/^(pcs?|ea|pieces?|ctns?|cartons?|kgs?|packages?)$/i.test(u)))return false;
  const ns=parsed.map(p=>numericTokens(p![1]));
  return ns.every(n=>n.length===1)&&ns[0][0]!==ns[1][0];
}
export function validateSemanticDecision(d: SemanticDecision, pair: SemanticPair): {assessment:ShippingAssessment;reason:string;code:string} {
  if(!semanticEvidenceValid(d.left,pair.left)||!semanticEvidenceValid(d.right,pair.right)||d.claims.some(c=>!semanticEvidenceValid(c.left,pair.left)||!semanticEvidenceValid(c.right,pair.right)))
    return {assessment:"needs_review",code:"INVALID_SEMANTIC_EVIDENCE",reason:"AI가 인용한 필드·원문·블록 소속이 맞지 않아 의미 판단을 사용하지 않습니다."};
  const native = nativeAttributeClaims(pair);
  if (native.length) return { assessment: pair.left.whole && pair.right.whole ? "confirmed_mismatch" : "provisional_mismatch", code:"VERIFIED_LITERAL_ATTRIBUTE_CONFLICT", reason:"AI 응답과 별개로, 같은 선적 원문의 공통 모델/규격 라벨에 서로 다른 기재값이 확인됐습니다. 전체 품목 범위가 불명확하면 잠정으로 보호합니다." };
  if(d.relation==="same_product"||d.relation==="compatible_incomplete")
    return {assessment:"provisional_match",code:d.relation==="same_product"?"AI_SEMANTIC_EQUIVALENCE":"AI_INCOMPLETE_ATTRIBUTES",reason:"검증된 원문에 대한 AI 의미 대응입니다. 언어적 판단은 잠정이며 누락된 속성을 추정하거나 확정 일치 건수로 올리지 않습니다."};
  if(d.relation==="explicit_conflict"||d.relation==="different_product") {
    const literal=d.claims.some(c=>literalAttributeConflict(c)&&unambiguousClaim(c,pair)), firm=literal&&pair.left.whole&&pair.right.whole;
    return {assessment:firm?"confirmed_mismatch":"provisional_mismatch",code:firm?"VERIFIED_LITERAL_ATTRIBUTE_CONFLICT":"AI_SEMANTIC_DIFFERENCE",reason:firm?"같은 선적의 유일한 전체 품목 원문에서 공통 속성 라벨과 서로 다른 기재값을 독립 대조했습니다.":"AI가 상품/속성 차이를 제안했습니다. 번역·품목 대응·범위 또는 독립적인 명시 속성 입증이 부족해 잠정 차이로 표시합니다."};
  }
  return {assessment:"needs_review",code:"AI_MEANING_UNRESOLVED",reason:"AI도 상품의 의미 대응을 판단하지 못했습니다. 실제 품목·규격을 작성자에게 확인해 주세요."};
}

// A small attribute-label safety check, independent of product vocabulary or AI
// verdicts. It never translates or supplies missing attributes. RAM/model data
// explicitly printed on BOTH sides cannot be erased by an AI "same family".
export function nativeAttributeClaims(pair:SemanticPair):SemanticDecision["claims"] {
  const attributes=(p:SemanticProduct)=>{
    const out=new Map<string,{quote:string;value:string;ids:string[];attribute:"model"|"size"|"capacity"|"specification";label:string}[]>();
    for(const d of p.descriptions){
      const patterns=[/\b(MODEL|SIZE|CAPACITY|RAM)\s*[:=#]?\s+([A-Z0-9]+(?:[.,_-][A-Z0-9]+)*(?:\s*(?:GB|MB|TB|ML|MM|CM))?)\b/gi,/\b(\d+(?:[.,]\d+)?\s*(?:GB|MB|TB))\s+(RAM)\b/gi];
      for(const[index,re]of patterns.entries())for(const m of d.value.matchAll(re)){
        const label=index===0?m[1]:m[2],value=normalizeText(index===0?m[2]:m[1]),key=label.toLowerCase();
        const xs=out.get(key)??[];xs.push({quote:m[0],value,ids:d.blockIds,attribute:key==="model"?"model":key==="size"?"size":key==="capacity"?"capacity":"specification",label});out.set(key,xs);
      }
    }
    return out;
  };
  const left=attributes(pair.left),right=attributes(pair.right),claims:SemanticDecision["claims"]=[];
  for(const[label,xs]of left){const ys=right.get(label);if(!ys||new Set(xs.map(x=>x.value)).size!==1||new Set(ys.map(y=>y.value)).size!==1)continue;const x=xs[0],y=ys[0];const c={attribute:x.attribute,label:x.label,left:{fieldId:pair.left.id,quote:x.quote,blockIds:x.ids},right:{fieldId:pair.right.id,quote:y.quote,blockIds:y.ids}};if(literalAttributeConflict(c)&&semanticEvidenceValid(c.left,pair.left)&&semanticEvidenceValid(c.right,pair.right))claims.push(c);}
  return claims;
}

// A single item can be a kit containing several models. A selected quote must
// account for EVERY occurrence of its attribute label in the proved owner span;
// choosing one convenient model out of a multi-model row cannot prove a conflict.
function unambiguousClaim(c:SemanticDecision["claims"][number],pair:SemanticPair) {
  const label=normalizeText(c.label);
  return [[c.left,pair.left],[c.right,pair.right]].every(([e,p])=>{
    const evidence=e as SemanticDecision["left"],product=p as SemanticProduct;
    const quote=normalizeText(evidence.quote),offset=quote.indexOf(label);let count=0;
    for(const d of product.descriptions){const text=normalizeText(d.value);let start=0,pos:number;
      while((pos=text.indexOf(label,start))!==-1){start=pos+label.length;
        if(/[\p{L}\p{N}]/u.test(text[pos-1]??"")||/[\p{L}]/u.test(text[start]??""))continue;
        count++;const from=pos-offset,to=from+quote.length;
        if(from<0||text.slice(from,to)!==quote||/[\p{L}\p{N}]/u.test(text[to]??""))return false;
      }
    }
    return count>0;
  });
}
