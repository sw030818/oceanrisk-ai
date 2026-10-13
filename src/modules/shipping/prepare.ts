import { extractPdfText } from "../pdf/extract";
import { safeError } from "../documents/errors";
import type { AIUsage, PdfDocument } from "../documents/schema";
import { createShippingDocument, type ShippingDocument } from "./schema";
import type { ShippingType } from "./catalog";
export interface ShippingResult {
  aiUsage?: AIUsage;
  aiModel?: string;
  ocrUsage?: AIUsage;
  ocrPages?: number[];
  ocrError?: ReturnType<typeof safeError>;
  pdf: PdfDocument;
  uploadSlot: ShippingType;
  originalUploadSlot?: ShippingType;
  document: ShippingDocument | null;
  detectedType: ShippingType | null;
  typeMismatch: boolean | null;
  error: ReturnType<typeof safeError> | null;
}
export async function prepareShippingFile(
  file: File,
  slot: ShippingType,
  signal?: AbortSignal,
  documentId?: string,
): Promise<ShippingResult> {
  const pdf: PdfDocument = {
    id: documentId ?? crypto.randomUUID(),
    fileName: file.name,
    pages: [],
  };
  try {
    pdf.pages = await extractPdfText(
      new Uint8Array(await file.arrayBuffer()),
      signal,
      true,
      true,
    );
    return {
      pdf,
      uploadSlot: slot,
      originalUploadSlot: slot,
      document: createShippingDocument(pdf, slot),
      detectedType: null,
      typeMismatch: null,
      error: null,
    };
  } catch (error) {
    return {
      pdf,
      uploadSlot: slot,
      originalUploadSlot: slot,
      document: null,
      detectedType: null,
      typeMismatch: null,
      error: safeError(error),
    };
  }
}
