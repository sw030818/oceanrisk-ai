import { reviewShipping } from "@/modules/shipping/review";
import type { ShippingReview } from "@/modules/shipping/review-model";
import { analyzeShippingFile } from "@/modules/shipping/analysis";
import { NextResponse } from "next/server";
import { requireSameOrigin } from "@/modules/security/origin";
import { boundedFormData } from "@/modules/upload/request";
import { validateUploads } from "@/modules/upload/validate";
import { AnalysisError, safeError } from "@/modules/documents/errors";
import { summarizeShipping } from "@/modules/shipping/summary";
import {
  parseShippingSlots,
  parseShippingIds,
} from "@/modules/shipping/uploads";
import {
  prepareShippingFile,
  type ShippingResult,
} from "@/modules/shipping/prepare";
export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };
// Explicit analysis uses the shipping schema; the preparation operation stays
// free of provider calls. Only analysis invokes the deterministic review.
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(105000),
    ]);
    const form = await boundedFormData(request, signal);
    const entries = form.getAll("files");
    if (entries.some((e) => !(e instanceof File)))
      throw new AnalysisError(
        "INVALID_REQUEST",
        "PDF 파일 업로드 요청이 올바르지 않습니다.",
        400,
      );
    const files = entries as File[];
    validateUploads(files);
    const slots = parseShippingSlots(form.get("slots"), files.length);
    const ids = parseShippingIds(form.get("documentIds"), files.length);
    const operation = form.get("operation") ?? "prepare";
    if (!["prepare", "analyze"].includes(String(operation)))
      throw new AnalysisError(
        "INVALID_OPERATION",
        "지원하지 않는 분석 요청입니다.",
        400,
      );
    const analyze = operation === "analyze";
    const started = performance.now();
    const results: ShippingResult[] = [];
    let stopAI = false;
    for (const [i, file] of files.entries()) {
      const prepared = await prepareShippingFile(
        file,
        slots[i],
        signal,
        ids?.[i],
      );
      const allowOCR = form.get("ocr") === "auto";
      const needsOCR =
        allowOCR && prepared.pdf.pages.some((p) => p.ocrStatus === "candidate");
      const defer =
        analyze &&
        !stopAI &&
        !prepared.error &&
        i > 0 &&
        100000 - (performance.now() - started) < (needsOCR ? 90000 : 45000);
      const result = defer
        ? {
            ...prepared,
            error: {
              code: "BATCH_DEFERRED",
              message:
                "현재 요청의 안전한 처리 시간을 확보하기 위해 아직 AI를 호출하지 않았습니다. 다음 단일 파일 배치에서 분석합니다.",
            },
          }
        : analyze
          ? await analyzeShippingFile(file, slots[i], {
              signal,
              skipAI: stopAI,
              documentId: ids?.[i],
              allowOCR,
              prepared,
              recoveryDeadline:
                Date.now() +
                Math.max(0, 105000 - (performance.now() - started)),
            })
          : prepared;
      results.push(result);
      if (
        result.error &&
        [
          "API_AUTH_OR_CONFIG",
          "API_RATE_LIMIT",
          "INVALID_MODEL",
          "API_NOT_CONFIGURED",
        ].includes(result.error.code)
      )
        stopAI = true;
    }
    const review: ShippingReview = analyze
      ? reviewShipping(results.flatMap((r) => (r.document ? [r.document] : [])))
      : { status: "not_performed", checks: [] };
    return NextResponse.json(
      {
        mode: analyze ? "shipping-analysis" : "pdf-preparation",
        phase: "3.7",
        results,
        summary: summarizeShipping(results, review),
        review,
        capabilities: {
          pdfPreparation: true,
          documentClassification: analyze,
          aiExtraction: analyze,
          pairComparison: analyze,
          triangularComparison: analyze,
        },
        aiCalled: results.some((r) => !!r.aiModel),
      },
      { headers },
    );
  } catch (error) {
    return NextResponse.json(
      { error: safeError(error) },
      {
        status: error instanceof AnalysisError ? error.httpStatus : 500,
        headers,
      },
    );
  }
}
