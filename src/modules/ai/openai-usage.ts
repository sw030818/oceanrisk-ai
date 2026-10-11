import type { AIUsage } from "../documents/schema";
// Standard text pricing verified from the official model page, 2026-10-11.
// https://developers.openai.com/api/docs/models/gpt-6-luna
// No tools, images, Fast mode or regional processing are requested.
export const LUNA_PRICING = {
  input: 0.1,
  cached: 0.01,
  cacheWrite: 0.125,
  output: 0.5,
};
export const OPENAI_MAX_OUTPUT_TOKENS = 4096;
export function estimateLunaCost(
  input: number,
  output: number,
  cached = 0,
  cacheWrite = 0,
) {
  const long = input > 272000;
  return (
    ((Math.max(0, input - cached - cacheWrite) * LUNA_PRICING.input +
      cached * LUNA_PRICING.cached +
      cacheWrite * LUNA_PRICING.cacheWrite) *
      (long ? 2 : 1) +
      output * LUNA_PRICING.output * (long ? 1.5 : 1)) /
    1e6
  );
}
export function openAIUsage(
  payload: unknown,
  model: string,
  durationMs: number,
): AIUsage {
  const p = payload as {
    usage?: {
      input_tokens?: unknown;
      output_tokens?: unknown;
      input_tokens_details?: {
        cached_tokens?: unknown;
        cache_write_tokens?: unknown;
      };
      output_tokens_details?: { reasoning_tokens?: unknown };
    };
    model?: unknown;
    service_tier?: unknown;
  } | null;
  const n = (v: unknown) =>
    typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : null;
  const input = n(p?.usage?.input_tokens),
    output = n(p?.usage?.output_tokens);
  const cached = n(p?.usage?.input_tokens_details?.cached_tokens) ?? 0;
  const cacheWrite = n(p?.usage?.input_tokens_details?.cache_write_tokens) ?? 0;
  const actual =
    typeof p?.model === "string" && /^[a-zA-Z0-9._-]{1,80}$/.test(p.model)
      ? p.model
      : model;
  const knownRate =
    model === "gpt-6-luna" &&
    actual === "gpt-6-luna" &&
    [undefined, "default"].includes(p?.service_tier as "default" | undefined);
  return {
    provider: "openai",
    model: actual,
    requestCount: 1,
    retryCount: 0,
    durationMs,
    inputTokens: input,
    outputTokens: output,
    cachedInputTokens: cached,
    cacheWriteTokens: cacheWrite,
    reasoningTokens: n(p?.usage?.output_tokens_details?.reasoning_tokens),
    estimatedCostUsd:
      knownRate &&
      input !== null &&
      output !== null &&
      cached + cacheWrite <= input
        ? estimateLunaCost(input, output, cached, cacheWrite)
        : null,
    pricingSource: knownRate
      ? "https://developers.openai.com/api/docs/models/gpt-6-luna"
      : null,
  };
}
