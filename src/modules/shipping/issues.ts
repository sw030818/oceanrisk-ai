import type { ShippingCheck, ShippingReview } from "./review-model";
import { refKey32, verified32 } from "./review-evidence";
export interface ReviewIssue {
  id: string;
  cause:
    | "value_conflict"
    | "reference_conflict"
    | "evidence"
    | "missing"
    | "scope";
  severity: "high" | "attention";
  assessment: ShippingCheck["assessment"];
  title: string;
  explanation: string;
  followUp: string;
  documentIds: string[];
  relatedCheckIds: string[];
  fields: ShippingCheck["fields"];
}
const rank = (s: ShippingCheck["assessment"]) =>
  s === "confirmed_mismatch" ? 0 : s === "provisional_mismatch" ? 1 : 2;
// Group by the same cause AND shipment AND affected entity. Different item rows,
// documents with absent references and unrelated faults never share a key.
export function reviewIssues(review: ShippingReview): ReviewIssue[] {
  const issues = new Map<string, ReviewIssue>();
  for (const c of review.primaryChecks ?? review.checks) {
    if (c.assessment === "confirmed_match" || c.assessment === "not_applicable")
      continue;
    const codes = c.comparison?.reasonCodes ?? [];
    const blockingRelations = (review.relationships ?? []).filter(
      (r) => c.relationshipIds.includes(r.id) && r.status === "conflict",
    );
    const relationshipOnly =
      c.assessment === "provisional_match" &&
      blockingRelations.length > 0 &&
      c.fields.every(verified32);
    const cause: ReviewIssue["cause"] = relationshipOnly
      ? "reference_conflict"
      : c.assessment === "confirmed_mismatch"
        ? c.category === "reference"
          ? "reference_conflict"
          : "value_conflict"
        : codes.includes("EVIDENCE_UNVERIFIED") || codes.includes("USER_EDITED")
          ? "evidence"
          : c.assessment === "insufficient_information"
            ? "missing"
            : "scope";
    const bad = c.fields.filter((f) => !verified32(f));
    const fields = cause === "evidence" && bad.length ? bad : c.fields;
    const entities = [...new Set(fields.map((f) => refKey32(f)))].sort();
    const shipment =
      c.comparison?.hbl ??
      [...new Set(c.fields.map((f) => f.documentId))].sort().join("+");
    // Exact cause signature is intentionally conservative. No category-only or
    // fuzzy-title deduplication that could hide a separate business problem.
    const key = JSON.stringify([
      cause,
      shipment,
      relationshipOnly
        ? "relationship_guard"
        : (c.comparison?.meaning ?? c.category),
      relationshipOnly
        ? blockingRelations.map((r) => r.id).sort()
        : entities.length
          ? entities
          : [c.id],
    ]);
    const previous = issues.get(key);
    if (previous) {
      previous.relatedCheckIds = [
        ...new Set([
          ...previous.relatedCheckIds,
          c.id,
          ...(c.comparison?.relatedCheckIds ?? []),
        ]),
      ];
      if (rank(c.assessment) < rank(previous.assessment))
        previous.assessment = c.assessment;
      for (const f of c.fields)
        if (!previous.fields.some((v) => refKey32(v) === refKey32(f)))
          previous.fields.push(f);
    } else
      issues.set(key, {
        id: "issue:" + key,
        cause,
        severity: c.assessment === "confirmed_mismatch" ? "high" : "attention",
        assessment: c.assessment,
        title: relationshipOnly
          ? "서류 간 참조 연결 확인"
          : (c.title ?? c.category),
        explanation: relationshipOnly
          ? "같은 값이 기재되어 있지만 선적 참조가 충돌하여 확정 판정을 보류한 검사입니다. 연결 근거를 확인해 주세요."
          : c.explanation,
        followUp: c.followUp,
        documentIds: [
          ...new Set([
            ...(c.documentIds ?? []),
            ...c.fields.map((f) => f.documentId),
          ]),
        ],
        relatedCheckIds: [
          ...new Set([c.id, ...(c.comparison?.relatedCheckIds ?? [])]),
        ],
        fields: [...c.fields],
      });
  }
  return [...issues.values()].sort(
    (a, b) =>
      rank(a.assessment) - rank(b.assessment) || a.id.localeCompare(b.id),
  );
}
export function withReviewIssues(review: ShippingReview): ShippingReview {
  return { ...review, issues: reviewIssues(review) };
}
