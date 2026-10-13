import { z } from "zod";
import {
  shippingFields,
  shippingFieldLabels,
  numericShippingFields,
  shippingTypes,
  type ShippingFieldKey,
} from "./catalog";
const citation = z
  .strictObject({
    page: z.number().int().positive(),
    blockIds: z.array(z.string().min(1).max(40)).min(1).max(12),
  })
  .nullable();
const str = z.strictObject({
  value: z.string().max(300).nullable(),
  evidence: citation,
});
const num = z.strictObject({
  value: z
    .number()
    .finite()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER)
    .nullable(),
  evidence: citation,
});
const fields = (keys: readonly string[]) =>
  z.strictObject(
    Object.fromEntries(
      keys.map((key) => [
        key,
        numericShippingFields.has(key as ShippingFieldKey) ? num : str,
      ]),
    ),
  );
export const itemFieldKeys = [
  "goodsDescription",
  "tradeDescription",
  "hsCode",
  "quantity",
  "quantityUnit",
  "packageCount",
  "packageUnit",
  "grossWeight",
  "grossWeightUnit",
  "netWeight",
  "netWeightUnit",
  "declaredWeight",
  "declaredWeightUnit",
] as const;
export const cargoFieldKeys = [
  ...shippingFields.house_manifest,
  "containerNumber",
  "sealNumber",
] as const;
export const shippingWireSchema = z.strictObject({
  type: z.enum([...shippingTypes, "unknown"]),
  typeEvidence: citation,
  fields: fields(Object.keys(shippingFieldLabels)),
  items: z.array(z.strictObject({ fields: fields(itemFieldKeys) })).max(100),
  containers: z
    .array(
      z.strictObject({
        containerNumber: str,
        sealNumber: str,
        sealNumbers: z.array(str).max(30),
        packageCount: num,
        packageUnit: str,
        grossWeight: num,
        weightUnit: str,
      }),
    )
    .max(100),
  cargoRecords: z
    .array(z.strictObject({ fields: fields(cargoFieldKeys) }))
    .max(100),
  references: z
    .array(
      z.strictObject({
        kind: z.enum([
          "house_bl",
          "export_declaration",
          "booking",
          "shipment",
          "other",
        ]),
        number: str,
      }),
    )
    .max(100),
});
export type ShippingWire = z.infer<typeof shippingWireSchema>;
export type Candidate = {
  value: string | number | null;
  evidence: { page: number; blockIds: string[] } | null;
};
export function shippingResponseSchema() {
  return z.toJSONSchema(shippingWireSchema, { target: "draft-7" });
}
