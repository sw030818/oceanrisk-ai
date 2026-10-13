import { parseUploadSlots } from "@/modules/upload/slots";
import { requireSameOrigin } from "@/modules/security/origin";
import { NextResponse } from "next/server";
import { validateUploads } from "@/modules/upload/validate";
import { boundedFormData } from "../upload/request";
import { AnalysisError, safeError } from "@/modules/documents/errors";
import { analyzeFile } from "@/modules/analysis/pipeline";
import type { AnalysisResult } from "@/modules/documents/schema";
import { reviewDocuments } from "@/modules/rules/review";
const headers = { "Cache-Control": "no-store, private" };
// Historical contract regression only. No public route invokes this handler.
export async function legacyPOST(request: Request) {
  try {
    requireSameOrigin(request);
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(105000),
    ]);
    const data = await boundedFormData(request, signal);
    const entries = data.getAll("files");
    if (entries.some((entry) => !(entry instanceof File)))
      throw new AnalysisError(
        "INVALID_REQUEST",
        "PDF 파일 업로드 요청이 올바르지 않습니다.",
        400,
      );
    const files = entries as File[];
    validateUploads(files);
    const slots = parseUploadSlots(data.get("slots"), files.length);
    const results: AnalysisResult[] = [];
    // Sequential processing bounds memory and provider requests.
    for (const [index, file] of files.entries()) {
      const result = await analyzeFile(file, { signal });
      const uploadSlot = slots?.[index];
      results.push(
        uploadSlot
          ? {
              ...result,
              uploadSlot,
              typeMismatch:
                !!result.document && result.document.type !== uploadSlot,
            }
          : result,
      );
    }
    const selectedInvoice = results.filter(
      (r) => r.uploadSlot === "invoice" && r.document,
    );
    const selectedPacking = results.filter(
      (r) => r.uploadSlot === "packing_list" && r.document,
    );
    const review = reviewDocuments(
      results.flatMap((r) => (r.document ? [r.document] : [])),
      selectedInvoice.length === 1 && selectedPacking.length === 1
        ? {
            invoiceId: selectedInvoice[0].pdf.id,
            packingId: selectedPacking[0].pdf.id,
          }
        : undefined,
    );
    return NextResponse.json(
      {
        results,
        // Literal evidence is already returned in results. Keep the independent
        // rule response compact instead of duplicating quotes/blocks per check.
        review: {
          status: review.status,
          selection: review.selection,
          summary: review.summary,
          checks: review.checks.map(({ fields, sources, ...verdict }) => ({
            ...verdict,
            evidenceRefs: sources.filter(Boolean).map((source) => ({
              fileId: source!.fileId,
              page: source!.page,
              tableId: source!.layout?.tableId,
              rowId: source!.layout?.rowId,
            })),
            fieldStates: fields.map(({ label, field }) => ({
              label,
              status: field.status,
              verificationCode: field.verificationCode,
            })),
          })),
        },
        mode: "live",
        aiConfigured: Boolean(process.env.OPENAI_API_KEY),
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
