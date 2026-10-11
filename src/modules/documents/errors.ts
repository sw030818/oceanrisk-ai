export class AnalysisError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus = 422,
  ) {
    super(message);
    this.name = "AnalysisError";
  }
}
export function safeError(error: unknown): { code: string; message: string } {
  if (error instanceof AnalysisError)
    return { code: error.code, message: error.message };
  return {
    code: "ANALYSIS_FAILED",
    message: "문서를 처리하지 못했습니다. 파일을 확인하고 다시 시도해 주세요.",
  };
}
