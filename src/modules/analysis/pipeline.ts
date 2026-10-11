import { extractPdfText } from "../pdf/extract";
import { extractWithGemini } from "../ai/gemini";
import { groundDocument } from "../evidence/verify";
import { AnalysisError, safeError } from "../documents/errors";
import type {
  AnalysisResult,
  ExtractedDocument,
  PdfDocument,
} from "../documents/schema";
export async function analyzeFile(
  file: File,
  dependencies: {
    signal?: AbortSignal;
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
    pdf.pages = await (
      dependencies.extract ??
      ((bytes) => extractPdfText(bytes, dependencies.signal))
    )(new Uint8Array(await file.arrayBuffer()));
  } catch (error) {
    return { pdf, document: null, error: safeError(error) };
  }
  try {
    if (dependencies.signal?.aborted)
      throw new AnalysisError(
        "REQUEST_CANCELLED",
        "분석 요청이 취소되었거나 처리 시간이 초과되었습니다.",
        408,
      );
    const data = await (
      dependencies.ai ??
      ((pdf) => extractWithGemini(pdf, { signal: dependencies.signal }))
    )(pdf);
    return { pdf, document: groundDocument(data, pdf), error: null };
  } catch (error) {
    return { pdf, document: null, error: safeError(error) };
  }
}
