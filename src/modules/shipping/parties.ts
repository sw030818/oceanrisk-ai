import type { FieldRef } from "./review-evidence";
import { text32, verified32 } from "./review-evidence";
import { shippingRole } from "./roles";
const endDesignator =
  /(?:\b(?:ltd|limited|llc|inc|incorporated|corp|corporation|gmbh|ag|bv|plc)\.?|주식회사|㈜)\s*$/i;
export function partyName32(f: FieldRef | undefined) {
  if (!f || !verified32(f) || typeof f.field.current.value !== "string")
    return null;
  const value = text32(f.field.current.value),
    blocks = f.field.original.source?.blocks ?? [];
  const parts = blocks
    .map((b) => {
      let text = b.text;
      const colon = text.indexOf(":");
      if (colon >= 0 && shippingRole(text.slice(0, colon)))
        text = text.slice(colon + 1);
      if (shippingRole(text)) return null;
      const normalized = text32(text);
      return normalized && value.includes(normalized)
        ? { ...b, text: normalized }
        : null;
    })
    .filter((p) => p !== null)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  if (!parts.length) return null;
  const first = parts
    .filter((b) => b.row === parts[0].row)
    .map((b) => b.text)
    .join(" ");
  // Only a complete literal company line may remove later address rows. A
  // wrapped/ambiguous name without a closing legal designator remains uncertain.
  if (
    value !== first &&
    (!value.startsWith(first + " ") || !endDesignator.test(first))
  )
    return null;
  if (
    /^\d+\s+.+\b(?:street|st|road|rd|avenue|ave|zip|postcode)\b/i.test(first) &&
    !endDesignator.test(first)
  )
    return null;
  return {
    name: first,
    address: value === first ? "" : value.slice(first.length).trim(),
    method: value === first ? "whole_value" : "first_native_company_line",
    blockIds: parts.filter((b) => b.row === parts[0].row).map((b) => b.id),
  };
}
export function partyMatch32(a: FieldRef | undefined, b: FieldRef | undefined) {
  if (!a || !b)
    return { same: undefined, certain: false, addressConflict: false };
  const left = partyName32(a),
    right = partyName32(b),
    rawSame = text32(a.field.current.value) === text32(b.field.current.value);
  if (rawSame) return { same: true, certain: true, addressConflict: false };
  if (!left || !right)
    return { same: undefined, certain: false, addressConflict: false };
  if (
    left.name !== right.name &&
    /[가-힣]/.test(left.name) !== /[가-힣]/.test(right.name)
  )
    return { same: undefined, certain: false, addressConflict: false };
  return {
    same: left.name === right.name,
    certain: true,
    addressConflict:
      !!left.address && !!right.address && left.address !== right.address,
  };
}
