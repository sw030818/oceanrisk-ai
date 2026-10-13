import { prepareShippingFile, type ShippingResult } from "./prepare";
import { extractShippingWithOpenAI } from "./openai";
import { groundShipping } from "./ground";
import { safeError } from "../documents/errors";
import type { ShippingType } from "./catalog";
import type { ShippingWire } from "./ai-schema";
import type { PdfDocument, AIUsage } from "../documents/schema";
export async function analyzeShippingFile(
  file: File,
  slot: ShippingType,
  options: {
    signal?: AbortSignal;
    ai?: (pdf: PdfDocument) => Promise<ShippingWire>;
    skipAI?: boolean;
  } = {},
): Promise<ShippingResult> {
  const result = await prepareShippingFile(file, slot, options.signal);
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
    const doc = groundShipping(wire, result.pdf, slot);
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
