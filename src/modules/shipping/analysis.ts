import { recoverNative } from "./recovery";
import { recoverTargeted } from "./targeted-recovery";
import { prepareShippingFile, type ShippingResult } from "./prepare";
import { extractShippingWithOpenAI } from "./openai";
import { groundShipping } from "./ground";
import { safeError } from "../documents/errors";
import type { ShippingType } from "./catalog";
import type { ShippingWire } from "./ai-schema";
import type { PdfDocument, AIUsage } from "../documents/schema";
import { ocrCandidates, ocrPdfPages } from "../pdf/ocr";
export async function analyzeShippingFile(
  file: File,
  slot: ShippingType,
  options: {
    signal?: AbortSignal;
    ai?: (pdf: PdfDocument) => Promise<ShippingWire>;
    skipAI?: boolean;
    documentId?: string;
    allowOCR?: boolean;
    ocr?: typeof ocrPdfPages;
    prepared?: ShippingResult;
    recovery?: boolean;
    recoveryDeadline?: number;
  } = {},
): Promise<ShippingResult> {
  const result =
    options.prepared ??
    (await prepareShippingFile(file, slot, options.signal, options.documentId));
  result.recoveryRequests = 0;
  if (result.error) return result;
  if (options.skipAI)
    return {
      ...result,
      error: {
        code: "BATCH_STOPPED",
        message:
          "이번 요청의 API 권한/이용 한도 오류로 추가 AI 호출을 중단했습니다. PDF 원문은 확인할 수 있습니다.",
      },
    };
  let aiUsage: AIUsage | undefined, aiModel: string | undefined;
  try {
    if (options.allowOCR && ocrCandidates(result.pdf).length) {
      result.ocrPages = ocrCandidates(result.pdf);
      try {
        result.pdf = await (options.ocr ?? ocrPdfPages)(
          new Uint8Array(await file.arrayBuffer()),
          result.pdf,
          {
            signal: options.signal,
            onModelUsed: (model) => {
              aiModel = model;
            },
            onUsage: (usage) => {
              result.ocrUsage = usage;
            },
          },
        );
      } catch (error) {
        result.ocrError = safeError(error);
        if (
          !result.pdf.pages.some(
            (p) => p.ocrStatus !== "candidate" && p.text.trim().length >= 40,
          )
        )
          return { ...result, error: result.ocrError, aiModel };
      }
    }
    if (!result.pdf.pages.some((p) => p.text.trim().length >= 8))
      return {
        ...result,
        error: {
          code: "NO_READABLE_TEXT",
          message:
            "읽을 수 있는 텍스트가 없습니다. OCR을 실행하지 않았거나 이미지가 판독되지 않았습니다. 선명한 사본을 사용해 주세요.",
        },
        aiModel,
      };
    const wire = await (
      options.ai ??
      ((pdf) =>
        extractShippingWithOpenAI(pdf, {
          signal: options.signal,
          onModelUsed: (model) => {
            aiModel = model;
          },
          onUsage: (usage) => {
            aiUsage = usage;
          },
        }))
    )(result.pdf);
    let doc = groundShipping(wire, result.pdf, slot);
    if (options.recovery !== false) {
      doc = recoverNative(doc, result.pdf);
      if (process.env.SHIPPING_TARGETED_RECOVERY_ENABLED === "true") {
        const recovered = await recoverTargeted(doc, result.pdf, {
          signal: options.signal,
          deadline: options.recoveryDeadline,
          onRequest: () => {
            result.recoveryRequests = 1;
          },
        });
        doc = recovered.document;
        result.recoveryUsage = recovered.usage;
      }
    }
    if (result.ocrPages?.length || result.pdf.pages.some((p) => p.ocrStatus)) {
      doc.extractionStatus = "partial";
      doc.informationWarnings.push(
        "스캔/OCR 페이지는 원본 이미지의 숫자·단위를 직접 확인해야 합니다. OCR 인식값을 원문 검증 성공으로 사용하지 않습니다.",
      );
    }
    return {
      ...result,
      document: doc,
      detectedType: doc.detectedType,
      typeMismatch:
        doc.classificationStatus === "classified"
          ? doc.detectedType !== slot
          : null,
      error: null,
      aiUsage,
      aiModel,
    };
  } catch (error) {
    return { ...result, error: safeError(error), aiUsage, aiModel };
  }
}
