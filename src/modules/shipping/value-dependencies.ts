import type { ShippingCheck } from './review-model';
import type { ShippingDocument } from './schema';
import { nativeRecordHbl } from './native-record-link';
import { ref32, refKey32, text32, verified32, type FieldRef } from './review-evidence';

// Link projections to a proved literal conflict. No assessment, source value or
// native verification changes; a different row/value fault remains a new root.
export function linkValueDependencies(checks: ShippingCheck[], documents: ShippingDocument[]) {
  const self = checks.filter(c => c.assessment === 'confirmed_mismatch' && c.comparison?.scope === 'document_record' && c.comparison.reasonCodes.includes('SOURCE_CONFLICT') && c.fields.length && c.fields.every(verified32));
  for (const root of self) {
    root.rootCauseIds = [root.id]; root.rootCauseKind = 'value_conflict';
    const role = root.comparison!.meaning, keys = new Set(root.fields.filter(f => f.fieldName === role).map(refKey32));
    for (const c of checks) {
      if (!c.assessment.startsWith('provisional') || c.comparison?.meaning !== role || !c.comparison.reasonCodes.includes('SOURCE_CONFLICT') || c.comparison.reasonCodes.some(v => !['SOURCE_CONFLICT', 'SCOPE_UNRESOLVED', 'DECLARATION_SCOPE_UNRESOLVED'].includes(v)) || !c.fields.every(verified32)) continue;
      const own = c.fields.filter(f => f.fieldName === role && root.fields.some(g => g.documentId === f.documentId));
      if (own.length && own.every(f => keys.has(refKey32(f)))) { c.rootCauseIds = [...new Set([...(c.rootCauseIds ?? []), root.id])]; c.rootCauseKind = 'value_conflict'; }
    }
  }
  const owner = (f: FieldRef) => {
    const d = documents.find(d => d.id === f.documentId); if (!d) return null;
    const cargo = d.cargoRecords.find(r => r.id === f.cargoId), container = d.containers.find(r => r.id === f.containerId);
    const cn = cargo?.fields.containerNumber ?? container?.containerNumber;
    const ref = cn && ref32(d, 'containerNumber', cn, cargo ? {cargoId: cargo.id} : {containerId: container!.id});
    const hbl = nativeRecordHbl(d);
    return ref && hbl && verified32(ref) ? {hbl, cn: text32(cn!.current.value)} : null;
  };
  for (const c of checks) {
    if (!['confirmed_mismatch', 'provisional_mismatch'].includes(c.assessment) || c.comparison?.meaning !== 'sealNumber' || c.comparison.reasonCodes.some(v => !['SCOPE_UNRESOLVED', 'DECLARATION_SCOPE_UNRESOLVED'].includes(v)) || !c.fields.every(verified32)) continue;
    const refs = c.fields.filter(f => f.fieldName === 'sealNumber'), ids = [...new Set(refs.map(f => f.documentId))];
    if (ids.length !== 2 || !refs.length || refs.some(f => !owner(f))) continue;
    const hs = new Set(refs.map(f => owner(f)!.hbl)); if (hs.size !== 1) continue;
    const roots: string[] = [];
    for (const cn of new Set(refs.map(f => owner(f)!.cn))) {
      const sides = ids.map(id => [...new Set(refs.filter(f => f.documentId === id && owner(f)!.cn === cn).map(f => text32(f.field.current.value)))].sort());
      if (sides.some(v => !v.length) || JSON.stringify(sides[0]) === JSON.stringify(sides[1])) continue;
      roots.push('container-seal/' + JSON.stringify([[...hs][0], cn, sides.map(v => v.join('|')).sort()]));
    }
    if (roots.length) { c.rootCauseIds = roots; c.rootCauseKind = 'value_conflict'; }
  }
}
