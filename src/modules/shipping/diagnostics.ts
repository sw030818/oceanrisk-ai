// Counts and machine codes only. No field values, text, quotes or identifiers.
import type { ShippingDocument } from "./schema";
import type { ShippingReview } from "./review-model";
import { shippingValues } from "./fields";
export function safeShippingDiagnostics(
  documents: ShippingDocument[],
  review: ShippingReview,
) {
  const count = (xs: string[]) =>
    Object.fromEntries(
      [...new Set(xs)].sort().map((x) => [x, xs.filter((v) => v === x).length]),
    );
  const values = documents.flatMap(shippingValues),
    known = values.filter((f) => f.original.value !== null);
  return {
    documents: documents.length,
    classifications: count(documents.map((d) => d.classificationStatus)),
    extraction: {
      candidateFields: known.length,
      verifiedFields: known.filter((f) => f.original.status === "verified")
        .length,
      missingCandidates: values.length - known.length,
    },
    evidence: count(
      known
        .filter((f) => f.original.status !== "verified")
        .map((f) => f.original.verificationCode ?? "unspecified"),
    ),
    scope: count(
      (review.primaryChecks ?? []).flatMap(
        (c) => c.comparison?.facts.flatMap((f) => f.reasons) ?? [],
      ),
    ),
    comparison: count(
      (review.primaryChecks ?? review.checks).flatMap(
        (c) => c.comparison?.reasonCodes ?? [],
      ),
    ),
    outcomes: review.outcomes ?? null,
    originalChecks: review.checks.length,
  };
}
