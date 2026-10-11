import { z } from "zod";
export const documentTypeSchema = z.enum([
  "invoice",
  "packing_list",
  "unknown",
]);
export const evidenceSchema = z.object({
  page: z.number().int().positive(),
  quote: z.string().min(1).max(800),
});
export const stringFieldSchema = z.object({
  value: z.string().max(300).nullable(),
  evidence: evidenceSchema.nullable(),
});
export const numberFieldSchema = z.object({
  value: z
    .number()
    .finite()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER)
    .nullable(),
  evidence: evidenceSchema.nullable(),
});
export const extractedDocumentSchema = z.object({
  type: documentTypeSchema,
  seller: stringFieldSchema,
  buyer: stringFieldSchema,
  documentNumber: stringFieldSchema,
  transactionReference: stringFieldSchema,
  currency: stringFieldSchema,
  totalAmount: numberFieldSchema,
  partialShipment: z.object({
    value: z.enum(["yes", "no", "unknown"]),
    evidence: evidenceSchema.nullable(),
  }),
  items: z
    .array(
      z.object({
        description: stringFieldSchema,
        quantity: numberFieldSchema,
        unit: stringFieldSchema,
        netWeight: numberFieldSchema,
        grossWeight: numberFieldSchema,
        weightUnit: stringFieldSchema,
        amount: numberFieldSchema,
      }),
    )
    .max(100),
});
export type ExtractedDocument = z.infer<typeof extractedDocumentSchema>;
export type DocumentType = z.infer<typeof documentTypeSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export interface PdfPage {
  page: number;
  text: string;
}
export interface PdfDocument {
  id: string;
  fileName: string;
  pages: PdfPage[];
}
export type VerificationStatus =
  | "verified"
  | "unverified"
  | "missing"
  | "user_edited";
export interface GroundedField<T> {
  value: T | null;
  status: VerificationStatus;
  reason: string;
  source: {
    fileId: string;
    fileName: string;
    page: number;
    quote: string;
  } | null;
}
export interface GroundedItem {
  description: GroundedField<string>;
  quantity: GroundedField<number>;
  unit: GroundedField<string>;
  netWeight: GroundedField<number>;
  grossWeight: GroundedField<number>;
  weightUnit: GroundedField<string>;
  amount: GroundedField<number>;
}
export interface GroundedDocument {
  id: string;
  fileName: string;
  type: DocumentType;
  seller: GroundedField<string>;
  buyer: GroundedField<string>;
  documentNumber: GroundedField<string>;
  transactionReference: GroundedField<string>;
  currency: GroundedField<string>;
  totalAmount: GroundedField<number>;
  partialShipment: GroundedField<"yes" | "no" | "unknown">;
  items: GroundedItem[];
}
export interface AnalysisResult {
  aiModel?: string;
  pdf: PdfDocument;
  document: GroundedDocument | null;
  error: { code: string; message: string } | null;
}
