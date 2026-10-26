import { nativeProductIdentifiers } from "./product-identifiers";
import{nativeRecordLinked}from'./native-record-link';
import type { ShippingDocument, ShippingField } from "./schema";
import { independentlyVerified } from "./effective";
import { factHbl } from "./facts";
import { relateShipping } from "./relationships";
import { identifiers32, registerShippingSet, ref32, refKey32, scope32, text32, verified32, type FieldRef } from "./review-evidence";
import { stableJson } from "./semantic-schema";
export const SEMANTIC_MAX_PAIRS = 40;
export interface SemanticProduct {
  id: string;
  ref: FieldRef;
  hbl: string;
  documentType: ShippingDocument["detectedType"];
  whole: boolean;
  collectionComplete: boolean;
  descriptions: { value: string; blockIds: string[] }[];
  hsCode: string | null;
}
export interface SemanticPair { left: SemanticProduct; right: SemanticProduct; relationshipId: string; relationshipConfirmed?:boolean; uniqueCounterpart?: boolean; }
// Product name with its explicit attribute values (MODEL/SIZE/CAPACITY/RAM)
// removed: "CERAMIC COFFEE MUG 350ML MODEL CM-350" -> "ceramic coffee mug 350ml".
// A "(57 PCS)" quantity line and a "SAID TO CONTAIN:" heading are not the name.
// Used only to prove WHICH row is the counterpart, never that attributes agree.
function nameKeys(p: SemanticProduct) {
  return new Set(p.descriptions.map((d) =>
    d.value.normalize("NFKC").replace(/^\s*SAID\s+TO\s+CONTAIN\s*:?/i, " ")
      .replace(/\(\s*\d[\d,.]*\s*[A-Z]{2,8}\s*\)/gi, " ")
      .replace(/\b(?:MODEL|STYLE|SIZE|CAPACITY|RAM)\s*[:=#]?\s+[A-Z0-9]+(?:[.,_\/-][A-Z0-9]+)*/gi, " ")
      .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim(),
  ).filter((k) => (k.match(/\p{L}{2,}/gu) ?? []).length >= 2));
}
export function semanticInputKey(documents: ShippingDocument[]) {
  return stableJson([...documents].sort((a, b) => a.id.localeCompare(b.id)));
}
export function semanticContext(documents: ShippingDocument[]) {
  registerShippingSet(documents);
  const products: SemanticProduct[] = [];
  for (const d of documents) {
    if (d.classificationStatus !== "classified" || d.extractionStatus === "not_performed") continue;
    const documentHbl = factHbl(d);
    const add = (field: ShippingField, hs: ShippingField | undefined, entry: {itemId?: string; cargoId?: string}, complete: boolean, count: number, hbl: string, documentField=false) => {
      const ref = ref32(d, "goodsDescription", field, entry), source = field.current.source;
      if (!verified32(ref) || typeof field.current.value !== "string" || !source?.segments?.length || (!source.layout&&!documentField)) return;
      const descriptions = [{ value: field.current.value, blockIds: source.segments.map(s => s.blockId) }, ...(source.goodsContext ?? [])];
      const collectionComplete=complete && documents.filter(other=>other.detectedType===d.detectedType && identifiers32(other,"houseBlNumber").some(ref=>verified32(ref)&&text32(ref.field.current.value)===hbl)).length===1 && !d.nativeScopeLimitation && !["partial","combined_packages"].includes(scope32(d)) && d.fields.shipmentScope?.current.status!=="user_edited";
      products.push({ id: refKey32(ref), ref, hbl, documentType: d.detectedType,
        collectionComplete,whole:collectionComplete&&count===1,
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
    const a=documents.find(d=>d.id===left.ref.documentId)!,b=documents.find(d=>d.id===right.ref.documentId)!;
    const relationship = relations.find(r => r.documentIds.includes(a.id) && r.documentIds.includes(b.id) && (r.status === "evidence_confirmed" && !r.conflictRoles.length && !r.mappingWarnings?.length||nativeRecordLinked(a,b,relations)));
    if (!relationship || text32(left.ref.field.current.value) === text32(right.ref.field.current.value)) continue;
    const exactOwner=(p:SemanticProduct,otherDoc:string)=>{
      const same=products.filter(q=>q.ref.documentId===otherDoc&&text32(q.ref.field.current.value)===text32(p.ref.field.current.value));
      return same.length===1&&products.filter(q=>q.ref.documentId===p.ref.documentId&&text32(q.ref.field.current.value)===text32(p.ref.field.current.value)).length===1?same[0]:undefined;
    };
    if(exactOwner(left,right.ref.documentId)||exactOwner(right,left.ref.documentId))continue;
    all.push({left,right,relationshipId:relationship.id,relationshipConfirmed:relationship.status==='evidence_confirmed'&&!relationship.mappingWarnings?.length&&!relationship.conflictRoles.length});
  }
  // A multi-item row is a proven counterpart when both complete collections of
  // this HBL have the same row count and its attribute-free name is printed on
  // exactly one row of each document. Repeated or partial names stay unproven.
  for (const pair of all) {
    const rows = (p: SemanticProduct) => products.filter((q) => q.ref.documentId === p.ref.documentId && q.hbl === p.hbl);
    const left = rows(pair.left), right = rows(pair.right);
    const share = (a: SemanticProduct, b: SemanticProduct) => [...nameKeys(a)].some((k) => nameKeys(b).has(k));
    // Single-row documents stay governed by `whole` alone.
    pair.uniqueCounterpart = pair.left.collectionComplete && pair.right.collectionComplete && left.length > 1 && left.length === right.length &&
      share(pair.left, pair.right) &&
      left.every((q) => q === pair.left || !share(q, pair.right)) &&
      right.every((q) => q === pair.right || !share(q, pair.left));
  }
  // Preserve the complete small candidate set (including negative alternatives)
  // and its diagnostics. Reduce only a large Cartesian set that risks saturating
  // the fixed provider output budget; never infer final identity here.
  const selected=all.length<=SEMANTIC_MAX_PAIRS/2?all:all.filter(({left,right})=>{
    // An explicit, uniquely grounded model/SKU on another row supplies a
    // candidate owner, not a translation or a final product verdict. Do not
    // spend semantic output on Cartesian pairs with an already identified other
    // owner. A changed/missing/duplicate identifier retains all candidates.
    const nativeOwner=(p:SemanticProduct,otherDoc:string)=>{
      const ids=nativeProductIdentifiers(p);if(ids.length!==1)return undefined;
      const same=products.filter(q=>q.ref.documentId===otherDoc&&nativeProductIdentifiers(q).length===1&&nativeProductIdentifiers(q)[0]===ids[0]);
      return same.length===1&&products.filter(q=>q.ref.documentId===p.ref.documentId&&nativeProductIdentifiers(q).includes(ids[0])).length===1?same[0]:undefined;
    };
    const lo=nativeOwner(left,right.ref.documentId),ro=nativeOwner(right,left.ref.documentId);
    return !(lo&&lo.id!==right.id||ro&&ro.id!==left.id);
  });
  return { key: semanticInputKey(documents), products, pairs: selected.slice(0, SEMANTIC_MAX_PAIRS), omittedPairs: Math.max(0, selected.length - SEMANTIC_MAX_PAIRS) };
}
