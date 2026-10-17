import type { ShippingDocument, ShippingField } from "./schema";
import { independentlyVerified } from "./effective";
import { factHbl } from "./facts";
import { relateShipping } from "./relationships";
import { identifiers32, ref32, refKey32, scope32, text32, verified32, type FieldRef } from "./review-evidence";
import { stableJson } from "./semantic-schema";
export const SEMANTIC_MAX_PAIRS = 40;
export interface SemanticProduct {
  id: string;
  ref: FieldRef;
  hbl: string;
  documentType: ShippingDocument["detectedType"];
  whole: boolean;
  descriptions: { value: string; blockIds: string[] }[];
  hsCode: string | null;
}
export interface SemanticPair { left: SemanticProduct; right: SemanticProduct; relationshipId: string; }
export function semanticInputKey(documents: ShippingDocument[]) {
  return stableJson([...documents].sort((a, b) => a.id.localeCompare(b.id)));
}
export function semanticContext(documents: ShippingDocument[]) {
  const products: SemanticProduct[] = [];
  for (const d of documents) {
    if (d.classificationStatus !== "classified" || d.extractionStatus === "not_performed") continue;
    const documentHbl = factHbl(d);
    const add = (field: ShippingField, hs: ShippingField | undefined, entry: {itemId?: string; cargoId?: string}, complete: boolean, count: number, hbl: string, documentField=false) => {
      const ref = ref32(d, "goodsDescription", field, entry), source = field.current.source;
      if (!verified32(ref) || typeof field.current.value !== "string" || !source?.segments?.length || (!source.layout&&!documentField)) return;
      const descriptions = [{ value: field.current.value, blockIds: source.segments.map(s => s.blockId) }, ...(source.goodsContext ?? [])];
      products.push({ id: refKey32(ref), ref, hbl, documentType: d.detectedType,
        whole: complete && count === 1 && documents.filter(other=>other.detectedType===d.detectedType && identifiers32(other,"houseBlNumber").some(ref=>verified32(ref)&&text32(ref.field.current.value)===hbl)).length === 1 && !d.nativeScopeLimitation && !["partial", "combined_packages"].includes(scope32(d)) && d.fields.shipmentScope?.current.status !== "user_edited",
        descriptions, hsCode: hs && independentlyVerified(hs) && hs.current.source?.fileId === d.id && hs.current.source?.layout?.tableId === source.layout?.tableId && hs.current.source.layout?.rowId === source.layout?.rowId ? String(hs.current.value) : null });
    };
    if (d.items.length && documentHbl) for (const i of d.items)
      add(i.fields.goodsDescription, i.fields.hsCode, {itemId:i.id}, !!d.factCoverage?.items.complete, d.items.length, documentHbl);
    else if(documentHbl && !d.cargoRecords.length && d.fields.goodsDescription)
      add(d.fields.goodsDescription,undefined,{},false,1,documentHbl,true);
    else for (const c of d.cargoRecords) {
      const anchor = ref32(d, "houseBlNumber", c.fields.houseBlNumber, {cargoId:c.id});
      if (!verified32(anchor)) continue;
      const hbl = text32(anchor.field.current.value);
      add(c.fields.goodsDescription, c.fields.hsCode, {cargoId:c.id}, !!d.factCoverage?.cargoRecords.complete, d.cargoRecords.filter(row=>text32(row.fields.houseBlNumber.current.value)===hbl).length, hbl);
    }
  }
  products.sort((a, b) => a.id.localeCompare(b.id));
  const relations = relateShipping(documents), all: SemanticPair[] = [];
  for (const [index, left] of products.entries()) for (const right of products.slice(index + 1)) {
    if (left.ref.documentId === right.ref.documentId || left.hbl !== right.hbl || documents.find(d=>d.id===left.ref.documentId)?.detectedType === documents.find(d=>d.id===right.ref.documentId)?.detectedType) continue;
    const relationship = relations.find(r => r.documentIds.includes(left.ref.documentId) && r.documentIds.includes(right.ref.documentId) && r.status === "evidence_confirmed" && !r.conflictRoles.length && !r.mappingWarnings?.length);
    if (!relationship || text32(left.ref.field.current.value) === text32(right.ref.field.current.value)) continue;
    const exactOwner=(p:SemanticProduct,otherDoc:string)=>{
      const same=products.filter(q=>q.ref.documentId===otherDoc&&text32(q.ref.field.current.value)===text32(p.ref.field.current.value));
      return same.length===1&&products.filter(q=>q.ref.documentId===p.ref.documentId&&text32(q.ref.field.current.value)===text32(p.ref.field.current.value)).length===1?same[0]:undefined;
    };
    if(exactOwner(left,right.ref.documentId)||exactOwner(right,left.ref.documentId))continue;
    all.push({left,right,relationshipId:relationship.id});
  }
  return { key: semanticInputKey(documents), products, pairs: all.slice(0, SEMANTIC_MAX_PAIRS), omittedPairs: Math.max(0, all.length - SEMANTIC_MAX_PAIRS) };
}
