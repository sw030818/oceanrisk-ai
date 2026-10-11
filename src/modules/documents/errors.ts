export interface ProviderDiagnostics {
  httpStatus: number;
  status: "INVALID_ARGUMENT" | "RESOURCE_EXHAUSTED" | "INTERNAL" | "UNAVAILABLE" | "PERMISSION_DENIED" | "NOT_FOUND" | "UNKNOWN";
  model?: string;
  requestFields: string[];
  quotaWindow: "minute" | "day" | "unknown";
  quotaLimitZero: boolean;
  availableModels?: string[];
}
export class AnalysisError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus = 422,
    public readonly diagnostics?: ProviderDiagnostics,
  ) {
    super(message);
    this.name = "AnalysisError";
  }
}
export function safeError(error: unknown): { code: string; message: string; diagnostics?: ProviderDiagnostics } {
  if (error instanceof AnalysisError)
    return { code: error.code, message: error.message, ...(error.diagnostics ? { diagnostics: error.diagnostics } : {}) };
  return {
    code: "ANALYSIS_FAILED",
    message: "문서를 처리하지 못했습니다. 파일을 확인하고 다시 시도해 주세요.",
  };
}
