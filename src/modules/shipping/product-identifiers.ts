import type { SemanticProduct } from "./semantic-context";
import { semanticEvidenceValid } from "./semantic-validation";
// Explicit native identifiers, never a number somewhere on the page or HS alone.
export function nativeProductIdentifiers(p: SemanticProduct): string[] {
  const values = new Set<string>();
  for (const d of p.descriptions) for (const m of d.value.matchAll(/(?:\b(?:MODEL|SKU|PART\s*(?:NO\.?|NUMBER)|ITEM\s*CODE)|모델(?:명|번호)?)\s*[:=#]?\s+([A-Z0-9]+(?:[._-][A-Z0-9]+)*)/gi)) {
    if (semanticEvidenceValid({ fieldId:p.id, quote:m[0], blockIds:d.blockIds }, p))
      values.add(m[1].normalize('NFKC').toLowerCase());
  }
  return [...values].sort();
}
