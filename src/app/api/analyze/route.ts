import { parseUploadSlots } from "@/modules/upload/slots";
import { requireSameOrigin } from "@/modules/security/origin";
import { NextResponse } from "next/server";
import { validateUploads } from "@/modules/upload/validate";
import { MAX_TOTAL_BYTES } from "@/modules/upload/limits";
import { AnalysisError, safeError } from "@/modules/documents/errors";
import { analyzeFile } from "@/modules/analysis/pipeline";
import type { AnalysisResult } from "@/modules/documents/schema";
export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };
const MAX_REQUEST_BYTES = MAX_TOTAL_BYTES + 128 * 1024;
async function boundedFormData(
  request: Request,
  signal: AbortSignal,
): Promise<FormData> {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
    throw new AnalysisError(
      "INVALID_REQUEST",
      "PDF 파일 업로드 요청 형식이 올바르지 않습니다.",
      400,
    );
  if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES)
    throw new AnalysisError(
      "TOTAL_TOO_LARGE",
      "전체 업로드 요청 크기가 너무 큽니다.",
      413,
    );
  if (!request.body)
    throw new AnalysisError("NO_FILES", "PDF 파일을 선택해 주세요.", 400);
  const reader = request.body.getReader();
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      if (signal.aborted)
        throw new AnalysisError(
          "REQUEST_CANCELLED",
          "업로드가 취소되었거나 처리 시간이 초과되었습니다.",
          408,
        );
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new AnalysisError(
          "TOTAL_TOO_LARGE",
          "전체 업로드 요청 크기가 너무 큽니다.",
          413,
        );
      }
      chunks.push(value);
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
  if (signal.aborted)
    throw new AnalysisError(
      "REQUEST_CANCELLED",
      "업로드가 취소되었거나 처리 시간이 초과되었습니다.",
      408,
    );
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return await new Response(body, {
      headers: { "Content-Type": request.headers.get("content-type")! },
    }).formData();
  } catch {
    throw new AnalysisError(
      "INVALID_REQUEST",
      "업로드 요청을 읽지 못했습니다.",
      400,
    );
  }
}
export async function POST(request: Request) {
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
    return NextResponse.json(
      {
        results,
        mode: "live",
        aiConfigured: Boolean(process.env.GEMINI_API_KEY),
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
