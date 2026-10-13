import type { ShippingReview } from "@/modules/shipping/review-model";
import { analyzeShippingFile } from "@/modules/shipping/analysis";
import { NextResponse } from "next/server";
import { requireSameOrigin } from "@/modules/security/origin";
import { boundedFormData } from "@/modules/upload/request";
import { validateUploads } from "@/modules/upload/validate";
import { AnalysisError, safeError } from "@/modules/documents/errors";
import { summarizeShipping } from "@/modules/shipping/summary";
import { parseShippingSlots } from "@/modules/shipping/uploads";
import {
  prepareShippingFile,
  type ShippingResult,
} from "@/modules/shipping/prepare";
export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };
// Explicit analysis uses the shipping schema; the preparation operation stays
// free of provider calls. Neither path invokes inter-document comparison.
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
    const operation = form.get("operation") ?? "prepare";
    if (!["prepare", "analyze"].includes(String(operation)))
      throw new AnalysisError(
        "INVALID_OPERATION",
        "지원하지 않는 분석 요청입니다.",
        400,
      );
    const analyze = operation === "analyze";
    const results: ShippingResult[] = [];
    let stopAI = false;
    for (const [i, file] of files.entries()) {
      const result = await (analyze
        ? analyzeShippingFile(file, slots[i], { signal, skipAI: stopAI })
        : prepareShippingFile(file, slots[i], signal));
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
    const review: ShippingReview = { status: "not_performed", checks: [] };
    return NextResponse.json(
      {
        mode: analyze ? "shipping-analysis" : "pdf-preparation",
        phase: "3.1",
        results,
        summary: summarizeShipping(results),
        review,
        capabilities: {
          pdfPreparation: true,
          documentClassification: analyze,
          aiExtraction: analyze,
          triangularComparison: false,
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
