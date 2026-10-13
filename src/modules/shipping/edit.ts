import { editField } from "../evidence/verify";
import type { ShippingField } from "./schema";
export function editShippingField(
  field: ShippingField,
  value: string | number | null,
): ShippingField {
  return { original: field.original, current: editField(field.current, value) };
}
export function restoreShippingField(field: ShippingField): ShippingField {
  return { original: field.original, current: structuredClone(field.original) };
}
