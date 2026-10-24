import { nativeProductIdentifiers as identifiers } from "./product-identifiers";
import { relateShipping } from "./relationships";
import { goodsComparisonValue } from './goods-context';
import { goodsCore, hsSix } from './equivalence';
import {cargoDescription}from'./cargo-description';
import {normalizeText}from'../evidence/verify';
import { semanticContext, type SemanticProduct } from './semantic-context';
import { semanticWireSchema, type SemanticReport } from './semantic-schema';
import { nativeAttributeClaims, validateSemanticDecision } from './semantic-validation';
import { refKey32, verified32, type FieldRef } from './review-evidence';
import type { ShippingDocument } from './schema';

export interface ProductMapping {
  left: FieldRef; right: FieldRef;
  proof: 'literal' | 'literal_native_identifier' | 'native_identifier_and_ai' | 'ai_only';
}
export function matchProductRows(left: FieldRef[], right: FieldRef[], documents: ShippingDocument[], report?: SemanticReport) {
  const relationships=relateShipping(documents);
  const context = semanticContext(documents), parsed = semanticWireSchema.safeParse(report?.decisions);
  const decisions = report?.inputKey === context.key && report.status !== 'failed' && parsed.success ? parsed.data.pairs : [];
  const product = (r:FieldRef) => context.products.find(p=>p.id===refKey32(r));
  const hs = (r:FieldRef) => product(r)?.hsCode;
  const nativeUnique = (p:SemanticProduct, refs:FieldRef[]) => {
    const ids=identifiers(p); return ids.length===1 && refs.filter(r=>{
      const q=product(r); return q && identifiers(q).includes(ids[0]);
    }).length===1;
  };
  const candidate = (a:FieldRef,b:FieldRef):ProductMapping|undefined => {
    if(!verified32(a)||!verified32(b)||!relationships.some(r=>r.status==="evidence_confirmed"&&!r.conflictRoles.length&&!r.mappingWarnings?.length&&r.documentIds.includes(a.documentId)&&r.documentIds.includes(b.documentId)))return;
    const l=product(a),r=product(b);
    if(l&&r&&nativeAttributeClaims({left:l,right:r,relationshipId:''}).length)return;
    // Legacy literal proof remains independent of a semantic provider response.
    const ld=documents.find(d=>d.id===a.documentId),rd=documents.find(d=>d.id===b.documentId);
    const itemHs=(d:typeof ld,f:FieldRef)=>d?.items.find(i=>i.id===f.itemId)?.fields.hsCode;
    const lh=itemHs(ld,a),rh=itemHs(rd,b);
    const literalHs=lh&&rh&&verified32({...a,field:lh,fieldName:'hsCode'})&&verified32({...b,field:rh,fieldName:'hsCode'})&&!!hsSix(lh.current.value)&&hsSix(lh.current.value)===hsSix(rh.current.value);
    if(literalHs&&goodsCore(goodsComparisonValue(a.field))===goodsCore(goodsComparisonValue(b.field)))
      return {left:a,right:b,proof:'literal'};
    if(!l||!r||l.hbl!==r.hbl||!l.hbl)return;
    // A classification-code error cannot veto an otherwise literal, uniquely
    // identified native row. HS discrepancies remain separate numeric checks.
    const li=identifiers(l),ri=identifiers(r),sameId=li.length===1&&ri.length===1&&li[0]===ri[0]&&nativeUnique(l,left)&&nativeUnique(r,right);
    const literalName=(v:unknown)=>typeof v==='string'?normalizeText(cargoDescription(v).goods):'';
    if(lh&&rh&&verified32({...a,field:lh,fieldName:'hsCode'})&&verified32({...b,field:rh,fieldName:'hsCode'})&&hsSix(lh.current.value)&&hsSix(rh.current.value)&&sameId&&literalName(goodsComparisonValue(a.field))&&literalName(goodsComparisonValue(a.field))===literalName(goodsComparisonValue(b.field)))return{left:a,right:b,proof:'literal_native_identifier'};
    const pair=context.pairs.find(p=>(p.left.id===l.id&&p.right.id===r.id)||(p.left.id===r.id&&p.right.id===l.id));
    if(!pair||nativeAttributeClaims(pair).length)return;
    const ds=decisions.filter(d=>d.leftId===pair.left.id&&d.rightId===pair.right.id);
    if(ds.length!==1||!['same_product','compatible_incomplete'].includes(ds[0].relation)||validateSemanticDecision(ds[0],pair).assessment!=='provisional_match')return;
    // A unique explicit model/SKU printed on both rows anchors the AI pairing.
    // A form without HS (B/L) cannot contradict it; two different HS codes do.
    const compatible=!hs(a)||!hs(b)||hsSix(hs(a))===hsSix(hs(b));
    const anchored=compatible&&sameId;
    return {left:a,right:b,proof:anchored?'native_identifier_and_ai':'ai_only'};
  };
  const graph=left.map(a=>right.map(b=>candidate(a,b)).filter((m):m is ProductMapping=>!!m));
  const matches:ProductMapping[]=[];
  for(const row of graph){if(row.length!==1)continue;const m=row[0];if(graph.filter(g=>g.some(c=>refKey32(c.right)===refKey32(m.right))).length===1)matches.push(m);}
  return {matches,complete:left.length>0&&left.length===right.length&&matches.length===left.length,
    strong:left.length>0&&left.length===right.length&&matches.length===left.length&&matches.every(m=>m.proof!=='ai_only')};
}
