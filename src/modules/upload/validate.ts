import { MAX_FILES, MAX_FILE_BYTES, MAX_TOTAL_BYTES } from "./limits";
import { AnalysisError } from "../documents/errors";
export interface UploadFile {
  name: string;
  size: number;
  type: string;
}
export function validateUploads(files: UploadFile[]): void {
  if (!files.length)
    throw new AnalysisError(
      "NO_FILES",
      "분석할 PDF 파일을 선택해 주세요.",
      400,
    );
  if (files.length > MAX_FILES)
    throw new AnalysisError(
      "TOO_MANY_FILES",
      `한 번에 최대 ${MAX_FILES}개 파일을 분석할 수 있습니다.`,
      400,
    );
  for (const file of files) {
    if (
      !/\.pdf$/i.test(file.name) ||
      (file.type &&
        !["application/pdf", "application/octet-stream"].includes(file.type))
    )
      throw new AnalysisError(
        "INVALID_FORMAT",
        "텍스트 기반 PDF 파일만 업로드할 수 있습니다.",
        400,
      );
    if (!file.size)
      throw new AnalysisError(
        "EMPTY_FILE",
        "빈 파일은 분석할 수 없습니다.",
        400,
      );
    if (file.size > MAX_FILE_BYTES)
      throw new AnalysisError(
        "FILE_TOO_LARGE",
        "파일 하나의 크기는 4 MB 이하여야 합니다.",
        413,
      );
  }
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES)
    throw new AnalysisError(
      "TOTAL_TOO_LARGE",
      "전체 파일 크기의 합계는 4 MB 이하여야 합니다.",
      413,
    );
}
export function validatePdfSignature(bytes: Uint8Array): void {
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-")
    throw new AnalysisError(
      "INVALID_PDF",
      "PDF 형식이 올바르지 않습니다. 확장자만 바꾼 파일은 지원하지 않습니다.",
    );
}
