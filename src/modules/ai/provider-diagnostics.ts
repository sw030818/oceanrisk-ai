import type { ProviderDiagnostics } from "../documents/errors";
export function providerDiagnostics(payload: unknown, httpStatus: number, model: string): ProviderDiagnostics {
  const failure = payload as { error?: { status?: unknown; message?: unknown; details?: unknown[] } } | null;
  const message = typeof failure?.error?.message === "string" ? failure.error.message : "";
  const status = failure?.error?.status;
  const allowed = ["INVALID_ARGUMENT", "RESOURCE_EXHAUSTED", "INTERNAL", "UNAVAILABLE", "PERMISSION_DENIED", "NOT_FOUND"];
  const details = Array.isArray(failure?.error?.details) ? failure.error.details : [];
  const diagnosticText = [message];
  const reasons: string[] = [];
  const allowedReasons = ["API_KEY_INVALID", "API_KEY_SERVICE_BLOCKED", "API_KEY_HTTP_REFERRER_BLOCKED", "API_KEY_IP_ADDRESS_BLOCKED", "BILLING_DISABLED", "SERVICE_DISABLED", "CONSUMER_INVALID", "LOCATION_POLICY_VIOLATED", "MODEL_NOT_FOUND", "MODEL_NOT_SUPPORTED", "QUOTA_EXCEEDED"];
  for (const item of details.slice(0, 20)) {
    if (!item || typeof item !== "object") continue;
    const detail = item as { reason?: unknown; fieldViolations?: unknown };
    if (typeof detail.reason === "string" && allowedReasons.includes(detail.reason)) reasons.push(detail.reason);
    if (!Array.isArray(detail.fieldViolations)) continue;
    for (const violation of detail.fieldViolations.slice(0, 20)) {
      if (!violation || typeof violation !== "object") continue;
      const { field, description } = violation as { field?: unknown; description?: unknown };
      if (typeof field === "string") diagnosticText.push(field);
      if (typeof description === "string") diagnosticText.push(description);
    }
  }
  return {
    httpStatus,
    status: typeof status === "string" && allowed.includes(status) ? status as ProviderDiagnostics["status"] : "UNKNOWN",
    ...(/^gemini-[a-zA-Z0-9._-]+$/.test(model) ? { model } : {}),
    requestFields: ["responseFormat", "response_format", "responseJsonSchema", "response_json_schema", "responseSchema", "response_schema", "thinkingConfig", "thinking_config", "maxOutputTokens", "max_output_tokens", "temperature", "generationConfig", "generation_config", "systemInstruction", "system_instruction"].filter(field => diagnosticText.some(text => text.includes(field))),
    ...(reasons.length ? { reasons: [...new Set(reasons)] } : {}),
    quotaWindow: /per.?day|per_day/i.test(message) ? "day" : /per.?minute|per_minute/i.test(message) ? "minute" : "unknown",
    quotaLimitZero: /limit\s*:\s*0\b/i.test(message),
  };
}
