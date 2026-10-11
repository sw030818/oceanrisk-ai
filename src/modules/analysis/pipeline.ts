import { extractPdfText } from "../pdf/extract";
import { extractWithGemini } from "../ai/gemini";
import { groundDocument } from "../evidence/verify";
import { safeError } from "../documents/errors";
import type {
  AnalysisResult,
  ExtractedDocument,
  PdfDocument,
} from "../documents/schema";
export async function analyzeFile(
  file: File,
  dependencies: {
    extract?: (bytes: Uint8Array) => Promise<PdfDocument["pages"]>;
    ai?: (pdf: PdfDocument) => Promise<ExtractedDocument>;
  } = {},
): Promise<AnalysisResult> {
  const pdf: PdfDocument = {
    id: crypto.randomUUID(),
    fileName: file.name,
    pages: [],
  };
  try {
    pdf.pages = await (dependencies.extract ?? extractPdfText)(
      new Uint8Array(await file.arrayBuffer()),
    );
  } catch (error) {
    return { pdf, document: null, error: safeError(error) };
  }
  try {
    const data = await (dependencies.ai ?? extractWithGemini)(pdf);
    return { pdf, document: groundDocument(data, pdf), error: null };
  } catch (error) {
    return { pdf, document: null, error: safeError(error) };
  }
}
