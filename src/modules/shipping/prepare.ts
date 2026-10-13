import { extractPdfText } from "../pdf/extract";
import { safeError } from "../documents/errors";
import type { PdfDocument } from "../documents/schema";
import { createShippingDocument, type ShippingDocument } from "./schema";
import type { ShippingType } from "./catalog";
export interface ShippingResult {
  pdf: PdfDocument;
  uploadSlot: ShippingType;
  document: ShippingDocument | null;
  detectedType: ShippingType | null;
  typeMismatch: boolean | null;
  error: ReturnType<typeof safeError> | null;
}
export async function prepareShippingFile(
  file: File,
  slot: ShippingType,
  signal?: AbortSignal,
): Promise<ShippingResult> {
  const pdf: PdfDocument = {
    id: crypto.randomUUID(),
    fileName: file.name,
    pages: [],
  };
  try {
    pdf.pages = await extractPdfText(
      new Uint8Array(await file.arrayBuffer()),
      signal,
    );
    return {
      pdf,
      uploadSlot: slot,
      document: createShippingDocument(pdf, slot),
      detectedType: null,
      typeMismatch: null,
      error: null,
    };
  } catch (error) {
    return {
      pdf,
      uploadSlot: slot,
      document: null,
      detectedType: null,
      typeMismatch: null,
      error: safeError(error),
    };
  }
}
