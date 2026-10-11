import { extractPdfText } from "../pdf/extract";
import { extractWithOpenAI } from "../ai/openai";
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
  let aiModel: string | undefined;
  try {
    if (dependencies.signal?.aborted)
      throw new AnalysisError(
        "REQUEST_CANCELLED",
        "분석 요청이 취소되었거나 처리 시간이 초과되었습니다.",
        408,
      );
    const data = await (
      dependencies.ai ??
      ((pdf) => extractWithOpenAI(pdf, { signal: dependencies.signal, onModelUsed: (model) => { aiModel = model; } }))
    )(pdf);
    return { pdf, document: groundDocument(data, pdf), error: null, ...(aiModel ? { aiModel } : {}) };
  } catch (error) {
    return { pdf, document: null, error: safeError(error), ...(aiModel ? { aiModel } : {}) };
  }
}
