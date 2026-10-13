import { resolveCitation } from "./citations";
import { z } from "zod";
import { extractedDocumentSchema, type PdfDocument } from "../documents/schema";

// AI locates candidate cells. Only the server may construct a literal citation.
const evidence = z
  .strictObject({
    page: z.number().int().positive(),
    blockIds: z.array(z.string().min(1).max(40)).min(1).max(12),
  })
  .nullable();
const stringField = z.strictObject({
  value: z.string().max(300).nullable(),
  evidence,
});
const numberField = z.strictObject({
  value: z
    .number()
    .finite()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER)
    .nullable(),
  evidence,
});
export const openAIWireSchema = z.strictObject({
  type: z.enum(["invoice", "packing_list", "unknown"]),
  seller: stringField,
  buyer: stringField,
  documentNumber: stringField,
  transactionReference: stringField,
  purchaseOrder: stringField,
  invoiceReference: stringField,
  shipmentReference: stringField,
  bookingReference: stringField,
  subtotalAmount: numberField,
  discountAmount: numberField,
  freightAmount: numberField,
  taxAmount: numberField,
  totalNetWeight: numberField,
  totalGrossWeight: numberField,
  totalWeightUnit: stringField,
  totalPackages: numberField,
  packageUnit: stringField,
  totalQuantity: numberField,
  totalQuantityUnit: stringField,
  currency: stringField,
  totalAmount: numberField,
  partialShipment: z.strictObject({
    value: z.enum(["yes", "no", "unknown"]),
    evidence,
  }),
  items: z
    .array(
      z.strictObject({
        description: stringField,
        quantity: numberField,
        unit: stringField,
        netWeight: numberField,
        grossWeight: numberField,
        weightUnit: stringField,
        amount: numberField,
        sku: stringField,
        unitPrice: numberField,
        packageQuantity: numberField,
        packageUnit: stringField,
      }),
    )
    .max(100),
});
export function openAIResponseSchema() {
  // OpenAI strict requires every property to be required, including nullable fields.
  return z.toJSONSchema(openAIWireSchema, { target: "draft-7" });
}
export function resolveOpenAICitations(raw: unknown, pdf: PdfDocument) {
  const wire = openAIWireSchema.parse(raw);
  const field = (candidate: Parameters<typeof resolveCitation>[0]) =>
    resolveCitation(candidate, pdf);
  const { items, ...root } = wire;
  return extractedDocumentSchema.parse({
    ...root,
    ...Object.fromEntries(
      Object.entries(root)
        .filter(([k]) => k !== "type")
        .map(([k, v]) => [k, field(v as Parameters<typeof field>[0])]),
    ),
    items: items.map((item) =>
      Object.fromEntries(Object.entries(item).map(([k, v]) => [k, field(v)])),
    ),
  });
}
