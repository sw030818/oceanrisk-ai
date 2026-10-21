import type{ShippingCheck}from'./review-model';import type{semanticContext,SemanticPair}from'./semantic-context';import{hsSix}from'./equivalence';import{nativeAttributeClaims}from'./semantic-validation';import{refKey32,verified32}from'./review-evidence';import{normalizeText}from'../evidence/verify';
type Context=ReturnType<typeof semanticContext>;
export function uniqueHsCandidate(pair:SemanticPair,context:Context){const hs=hsSix(pair.left.hsCode);return !!hs&&hs===hsSix(pair.right.hsCode)&&[pair.left,pair.right].every(p=>context.products.filter(q=>q.ref.documentId===p.ref.documentId&&hsSix(q.hsCode)===hs).length===1);}
// Causal identity is not a product verdict: same literal attribute pair on a
// unique native row is one question, even when two carriers expose that question.
export function attributeRoots(pair:SemanticPair,context:Context){
 if(!uniqueHsCandidate(pair,context))return[];const hs=hsSix(pair.left.hsCode);
 const owners=context.products.filter(p=>p.documentType==='house_bl'&&p.hbl===pair.left.hbl&&hsSix(p.hsCode)===hs);
 if(owners.length!==1)return[];const owner=owners[0];
 return nativeAttributeClaims(pair).map(c=>{const label=normalizeText(c.label),value=(q:string)=>normalizeText(q).split(label).join('').replace(/^[\s:=#-]+|[\s:=#-]+$/g,'');return'product-attribute/'+owner.id+'/'+JSON.stringify([c.attribute,...[value(c.left.quote),value(c.right.quote)].sort()]);});
}
export function linkHsSetDependencies(checks:ShippingCheck[]){
 const roots=checks.filter(c=>c.rootCauseKind==='value_conflict'&&c.assessment==='confirmed_mismatch'&&c.rootCauseIds?.includes(c.id)&&c.comparison?.meaning==='hsCode'&&c.fields.filter(f=>f.fieldName==='hsCode').length===2);
 for(const c of checks){if(c.comparison?.meaning!=='hsCode'||c.assessment!=='confirmed_mismatch'||roots.includes(c)||!c.fields.every(verified32))continue;
  const ids=[...new Set(c.fields.map(f=>f.documentId))];if(ids.length<2)continue;
  const sets=ids.map(id=>new Set(c.fields.filter(f=>f.documentId===id&&f.fieldName==='hsCode').map(f=>hsSix(f.field.current.value))));if(sets.some(s=>s.has(null)))continue;
  const difference=[...new Set(sets.flatMap(s=>[...s]))].filter(v=>!sets.every(s=>s.has(v)));if(!difference.length)continue;
  const matching=roots.filter(r=>r.fields.filter(f=>f.fieldName==='hsCode').every(f=>c.fields.some(v=>refKey32(v)===refKey32(f))));
  const covered=new Set(matching.flatMap(r=>r.fields.filter(f=>f.fieldName==='hsCode').map(f=>hsSix(f.field.current.value))));
  if(matching.length&&difference.every(v=>covered.has(v))&&[...covered].every(v=>difference.includes(v))){c.rootCauseIds=matching.map(r=>r.id);c.rootCauseKind='value_conflict';}
 }
}
