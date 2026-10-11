import type { GroundedField } from "../documents/schema";
import { normalizeText } from "../evidence/verify";
export type Assessment =
  | "confirmed_match"
  | "confirmed_mismatch"
  | "provisional_match"
  | "provisional_mismatch"
  | "needs_review"
  | "insufficient_information";
export type CheckCategory =
  | "quantity"
  | "reference"
  | "party"
  | "unit"
  | "product"
  | "weight"
  | "packaging"
  | "arithmetic"
  | "required"
  | "document";
export interface ReviewCheck {
  id: string;
  category: CheckCategory;
  scope: "cross" | "document";
  assessment: Assessment;
  status: "match" | "mismatch" | "unverifiable";
  confidence: "confirmed" | "candidate" | "unavailable";
  title: string;
  explanation: string;
  question: string;
  item: string | null;
  leftValue?: string | number | null;
  rightValue?: string | number | null;
  unit?: string;
  fields: { label: string; field: GroundedField<string | number> }[];
  sources: GroundedField<string | number>["source"][];
  referenceWarning?: boolean;
}
export const known = (f: GroundedField<unknown> | undefined): boolean =>
  !!f && f.status === "verified" && f.value !== null;
export const hasValue = (f: GroundedField<unknown> | undefined): boolean =>
  !!f && f.value !== null && f.value !== "";
export const sameText = (a: string, b: string) =>
  normalizeText(a) === normalizeText(b);
export { canonicalUnit, packageUnit } from "../documents/units";
export const assessmentLabels: Record<Assessment, string> = {
  confirmed_match: "확인된 일치",
  confirmed_mismatch: "확인된 불일치",
  provisional_match: "잠정 일치",
  provisional_mismatch: "잠정 불일치",
  needs_review: "확인 필요",
  insufficient_information: "정보 부족",
};
export function check(
  input: Omit<ReviewCheck, "status" | "confidence" | "sources">,
): ReviewCheck {
  return {
    ...input,
    status:
      input.assessment === "confirmed_match"
        ? "match"
        : input.assessment === "confirmed_mismatch"
          ? "mismatch"
          : "unverifiable",
    confidence: input.assessment.startsWith("confirmed_")
      ? "confirmed"
      : input.assessment.startsWith("provisional_")
        ? "candidate"
        : "unavailable",
    sources: input.fields.map((f) => f.field.source),
  };
}
export function assessPair(
  left: GroundedField<string | number> | undefined,
  right: GroundedField<string | number> | undefined,
  equal: boolean,
  blockers: string[] = [],
): Assessment {
  if (!hasValue(left) || !hasValue(right)) return "insufficient_information";
  return known(left) && known(right) && !blockers.length
    ? equal
      ? "confirmed_match"
      : "confirmed_mismatch"
    : equal
      ? "provisional_match"
      : "provisional_mismatch";
}
