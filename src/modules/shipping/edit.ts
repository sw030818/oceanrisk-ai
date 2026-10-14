import { editField } from "../evidence/verify";
import type { ShippingField } from "./schema";
export function editShippingField(
  field: ShippingField,
  value: string | number | null,
): ShippingField {
  return { ...field, current: editField(field.current, value) };
}
export function restoreShippingField(field: ShippingField): ShippingField {
  return {
    ...field,
    current: structuredClone(field.recovery?.field ?? field.original),
  };
}
