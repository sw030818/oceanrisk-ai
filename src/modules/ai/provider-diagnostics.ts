import type { ProviderDiagnostics } from "../documents/errors";
export function providerDiagnostics(payload: unknown, httpStatus: number, model: string): ProviderDiagnostics {
  const failure = payload as { error?: { status?: unknown; message?: unknown; details?: unknown[] } } | null;
  const message = typeof failure?.error?.message === "string" ? failure.error.message : "";
  const status = failure?.error?.status;
  const allowed = ["INVALID_ARGUMENT", "RESOURCE_EXHAUSTED", "INTERNAL", "UNAVAILABLE", "PERMISSION_DENIED", "NOT_FOUND"];
  return {
    httpStatus,
    status: typeof status === "string" && allowed.includes(status) ? status as ProviderDiagnostics["status"] : "UNKNOWN",
    ...(/^gemini-[a-zA-Z0-9._-]+$/.test(model) ? { model } : {}),
    requestFields: ["responseJsonSchema", "response_json_schema", "responseSchema", "response_schema", "thinkingConfig", "thinking_config", "maxOutputTokens", "max_output_tokens", "temperature", "generationConfig", "generation_config", "systemInstruction", "system_instruction"].filter(field => message.includes(field)),
    quotaWindow: /per.?day|per_day/i.test(message) ? "day" : /per.?minute|per_minute/i.test(message) ? "minute" : "unknown",
    quotaLimitZero: /limit\s*:\s*0\b/i.test(message),
  };
}
