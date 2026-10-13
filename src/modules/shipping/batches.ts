import { MAX_FILE_BYTES, MAX_TOTAL_BYTES } from "../upload/limits";
import { validateUploads } from "../upload/validate";
import { AnalysisError } from "../documents/errors";
import type { ShippingType } from "./catalog";
import type { ShippingResult } from "./prepare";
export const MAX_WORKSPACE_FILES = 24;
export const MAX_WORKSPACE_BYTES = 64 * 1024 * 1024;
export const SHIPPING_BATCH_FILES = 2;
export interface ShippingUpload {
  id: string;
  file: File;
  slot: ShippingType;
}
export function shippingBatches(entries: ShippingUpload[]): ShippingUpload[][] {
  if (!entries.length)
    throw new AnalysisError("NO_FILES", "PDF 파일을 선택해 주세요.", 400);
  if (entries.length > MAX_WORKSPACE_FILES)
    throw new AnalysisError(
      "TOO_MANY_FILES",
      `검토 공간에는 최대 ${MAX_WORKSPACE_FILES}개 PDF를 등록할 수 있습니다.`,
      400,
    );
  if (entries.reduce((n, e) => n + e.file.size, 0) > MAX_WORKSPACE_BYTES)
    throw new AnalysisError(
      "TOTAL_TOO_LARGE",
      "검토 공간의 전체 파일 합계는 64 MB 이하여야 합니다.",
      413,
    );
  if (new Set(entries.map((e) => e.id)).size !== entries.length)
    throw new AnalysisError(
      "INVALID_DOCUMENT_IDS",
      "파일 식별자가 중복되었습니다.",
      400,
    );
  const batches: ShippingUpload[][] = [];
  for (const entry of entries) {
    validateUploads([entry.file]);
    if (entry.file.size > MAX_FILE_BYTES)
      throw new AnalysisError("FILE_TOO_LARGE", "파일당 최대 4 MB입니다.", 413);
    let batch = batches[batches.length - 1];
    if (
      !batch ||
      batch.length >= SHIPPING_BATCH_FILES ||
      batch.reduce((n, e) => n + e.file.size, 0) + entry.file.size >
        MAX_TOTAL_BYTES
    ) {
      batch = [];
      batches.push(batch);
    }
    batch.push(entry);
  }
  return batches;
}
export function failedShippingUpload(
  entry: ShippingUpload,
  code: string,
  message: string,
): ShippingResult {
  return {
    pdf: { id: entry.id, fileName: entry.file.name, pages: [] },
    uploadSlot: entry.slot,
    originalUploadSlot: entry.slot,
    document: null,
    detectedType: null,
    typeMismatch: null,
    error: { code, message },
  };
}
// Merge by stable upload ID, never filename. A later failed batch cannot erase
// a successful document. Review is computed over this merged set, not batches.
export function mergeShippingResults(
  current: ShippingResult[],
  incoming: ShippingResult[],
): ShippingResult[] {
  const map = new Map(current.map((r) => [r.pdf.id, r]));
  for (const r of incoming) {
    const prior = map.get(r.pdf.id);
    if (!prior || !r.error || prior.error) map.set(r.pdf.id, r);
  }
  return [...map.values()];
}
