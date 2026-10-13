import type { ShippingReview } from "@/modules/shipping/review-model";
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
// PHASE 3.0 intentionally imports NO AI extractor or Invoice/PL rule engine.
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
    const results: ShippingResult[] = [];
    for (const [i, file] of files.entries())
      results.push(await prepareShippingFile(file, slots[i], signal));
    const review: ShippingReview = { status: "not_performed", checks: [] };
    return NextResponse.json(
      {
        mode: "pdf-preparation",
        phase: "3.0",
        results,
        summary: summarizeShipping(results),
        review,
        capabilities: {
          pdfPreparation: true,
          documentClassification: false,
          aiExtraction: false,
          triangularComparison: false,
        },
        aiCalled: false,
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
