import { z } from "zod";
import type { AIUsage } from "../documents/schema";
import type { safeError } from "../documents/errors";
export const semanticEvidenceSchema = z.strictObject({
  fieldId: z.string().min(1).max(500),
  quote: z.string().min(1).max(300),
  blockIds: z.array(z.string().min(1).max(40)).min(1).max(12),
});
export const semanticWireSchema = z.strictObject({
  pairs: z.array(z.strictObject({
    leftId: z.string().min(1).max(500),
    rightId: z.string().min(1).max(500),
    relation: z.enum(["same_product", "compatible_incomplete", "explicit_conflict", "different_product", "unknown"]),
    left: semanticEvidenceSchema,
    right: semanticEvidenceSchema,
    claims: z.array(z.strictObject({
      attribute: z.enum(["kind", "material", "model", "capacity", "size", "specification", "color", "other"]),
      label: z.string().max(60),
      left: semanticEvidenceSchema,
      right: semanticEvidenceSchema,
    })).max(8),
    explanation: z.string().min(1).max(600),
  })).max(40),
});
export type SemanticWire = z.infer<typeof semanticWireSchema>;
export type SemanticDecision = SemanticWire["pairs"][number];
export interface SemanticReport {
  status: "complete" | "partial" | "failed" | "not_needed";
  inputKey: string;
  decisions: SemanticWire;
  requestedPairs: number;
  omittedPairs: number;
  model?: string;
  usage?: AIUsage;
  error?: ReturnType<typeof safeError>;
}
// Canonicalization is shared with the browser for exact cache invalidation and
// with the server HMAC. This string is never logged or sent to the AI provider.
export function stableJson(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(stableJson).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.entries(v).filter(([, x]) => x !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => JSON.stringify(k) + ":" + stableJson(x)).join(",") + "}";
  return JSON.stringify(v) ?? "null";
}
