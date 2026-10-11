import { z } from "zod";
export const documentTypeSchema = z.enum(["invoice", "packing_list", "unknown"]);
export const evidenceSchema = z.object({ page: z.number().int().positive(), quote: z.string().max(800) });
export const stringFieldSchema = z.object({ value: z.string().max(300).nullable(), evidence: evidenceSchema.nullable() });
export const numberFieldSchema = z.object({ value: z.number().finite().nonnegative().nullable(), evidence: evidenceSchema.nullable() });
export const extractedDocumentSchema = z.object({
  type: documentTypeSchema,
  seller: stringFieldSchema, buyer: stringFieldSchema, documentNumber: stringFieldSchema,
  currency: stringFieldSchema, totalAmount: numberFieldSchema,
  partialShipment: z.enum(["yes", "no", "unknown"]),
  items: z.array(z.object({ description: stringFieldSchema, quantity: numberFieldSchema, unit: stringFieldSchema, netWeight: numberFieldSchema, grossWeight: numberFieldSchema, weightUnit: stringFieldSchema, amount: numberFieldSchema })).max(100),
});
export type ExtractedDocument = z.infer<typeof extractedDocumentSchema>;
export type DocumentType = z.infer<typeof documentTypeSchema>;
