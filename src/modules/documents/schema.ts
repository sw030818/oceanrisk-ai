import { z } from "zod";
import type { ProviderDiagnostics } from "./errors";
export const documentTypeSchema = z.enum([
  "invoice",
  "packing_list",
  "unknown",
]);
export const evidenceSchema = z.object({
  page: z.number().int().positive(),
  quote: z.string().min(1).max(800),
  segments: z
    .array(
      z.object({
        blockId: z.string().min(1).max(40),
        quote: z.string().min(1).max(800),
      }),
    )
    .min(1)
    .max(12)
    .optional(),
});
export const evidenceIssueSchema = z.enum([
  "page_missing",
  "block_missing",
  "duplicate_block",
  "citation_too_long",
]);
export type EvidenceIssue = z.infer<typeof evidenceIssueSchema>;
export const stringFieldSchema = z.object({
  value: z.string().max(300).nullable(),
  evidence: evidenceSchema.nullable(),
  evidenceIssue: evidenceIssueSchema.optional(),
});
export const numberFieldSchema = z.object({
  value: z
    .number()
    .finite()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER)
    .nullable(),
  evidence: evidenceSchema.nullable(),
  evidenceIssue: evidenceIssueSchema.optional(),
});
export const extractedDocumentSchema = z.object({
  type: documentTypeSchema,
  seller: stringFieldSchema,
  buyer: stringFieldSchema,
  documentNumber: stringFieldSchema,
  transactionReference: stringFieldSchema,
  purchaseOrder: stringFieldSchema.optional(),
  invoiceReference: stringFieldSchema.optional(),
  shipmentReference: stringFieldSchema.optional(),
  bookingReference: stringFieldSchema.optional(),
  subtotalAmount: numberFieldSchema.optional(),
  discountAmount: numberFieldSchema.optional(),
  freightAmount: numberFieldSchema.optional(),
  taxAmount: numberFieldSchema.optional(),
  totalNetWeight: numberFieldSchema.optional(),
  totalGrossWeight: numberFieldSchema.optional(),
  totalWeightUnit: stringFieldSchema.optional(),
  totalPackages: numberFieldSchema.optional(),
  packageUnit: stringFieldSchema.optional(),
  totalQuantity: numberFieldSchema.optional(),
  totalQuantityUnit: stringFieldSchema.optional(),
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
        sku: stringFieldSchema.optional(),
        unitPrice: numberFieldSchema.optional(),
        packageQuantity: numberFieldSchema.optional(),
        packageUnit: stringFieldSchema.optional(),
      }),
    )
    .max(100),
});
export type ExtractedDocument = z.infer<typeof extractedDocumentSchema>;
export type DocumentType = z.infer<typeof documentTypeSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export interface PdfPage {
  textSource?: "pdf_text" | "ocr";
  ocrStatus?: "candidate" | "recognized" | "failed";
  page: number;
  text: string;
  width?: number;
  height?: number;
  blocks?: PdfBlock[];
}
export interface PdfBlock {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  row: number;
}
export type UploadSlot = "invoice" | "packing_list";
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
  verificationCode?:
    | "verified"
    | "missing_value"
    | "missing_evidence"
    | "quote_mismatch"
    | "value_mismatch"
    | "role_mismatch"
    | "ambiguous_cell"
    | "row_mismatch"
    | "context_unverified"
    | "user_edited"
    | "ocr_unverified"
    | EvidenceIssue;
  source: {
    fileId: string;
    fileName: string;
    page: number;
    quote: string;
    segments?: Evidence["segments"];
    blocks?: PdfBlock[];
    layout?: {
      tableId: string;
      rowId: string;
      role: string;
      unit: string | null;
    };
    semanticRole?: string;
    provenance?: "pdf_text" | "ocr";
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
  sku?: GroundedField<string>;
  unitPrice?: GroundedField<number>;
  packageQuantity?: GroundedField<number>;
  packageUnit?: GroundedField<string>;
}
export interface GroundedDocument {
  id: string;
  fileName: string;
  type: DocumentType;
  seller: GroundedField<string>;
  buyer: GroundedField<string>;
  documentNumber: GroundedField<string>;
  transactionReference: GroundedField<string>;
  purchaseOrder?: GroundedField<string>;
  invoiceReference?: GroundedField<string>;
  shipmentReference?: GroundedField<string>;
  bookingReference?: GroundedField<string>;
  subtotalAmount?: GroundedField<number>;
  discountAmount?: GroundedField<number>;
  freightAmount?: GroundedField<number>;
  taxAmount?: GroundedField<number>;
  totalNetWeight?: GroundedField<number>;
  totalGrossWeight?: GroundedField<number>;
  totalWeightUnit?: GroundedField<string>;
  totalPackages?: GroundedField<number>;
  packageUnit?: GroundedField<string>;
  totalQuantity?: GroundedField<number>;
  totalQuantityUnit?: GroundedField<string>;
  currency: GroundedField<string>;
  totalAmount: GroundedField<number>;
  partialShipment: GroundedField<"yes" | "no" | "unknown">;
  items: GroundedItem[];
}
export interface AnalysisResult {
  aiUsage?: AIUsage;
  uploadSlot?: UploadSlot;
  typeMismatch?: boolean;
  aiModel?: string;
  pdf: PdfDocument;
  document: GroundedDocument | null;
  error: {
    code: string;
    message: string;
    diagnostics?: ProviderDiagnostics;
  } | null;
}
export interface AIUsage {
  provider: "openai";
  model: string;
  requestCount: number;
  retryCount: number;
  durationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number | null;
  estimatedCostUsd: number | null;
  pricingSource: string | null;
}
