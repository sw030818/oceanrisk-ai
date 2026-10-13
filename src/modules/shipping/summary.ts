import type { ShippingReview } from "./review-model";
import type { ShippingResult } from "./prepare";
export function summarizeShipping(
  results: ShippingResult[],
  review?: ShippingReview,
) {
  const ready = results.filter((r) => r.document && !r.error);
  const types = new Set(
    ready
      .filter((r) => r.document?.classificationStatus !== "needs_review")
      .map((r) => r.detectedType ?? r.uploadSlot),
  );
  const analyzed = ready.filter(
    (r) => r.document?.extractionStatus !== "not_performed",
  );
  return {
    uploadedDocuments: results.length,
    uploadedTypes: new Set(results.map((r) => r.uploadSlot)).size,
    classifiedTypes: new Set(
      analyzed
        .filter((r) => r.document?.classificationStatus === "classified")
        .map((r) => r.detectedType),
    ).size,
    successfulDocuments: ready.length,
    analyzedDocuments: analyzed.length,
    partialDocuments: analyzed.filter(
      (r) => r.document?.extractionStatus === "partial" || r.typeMismatch,
    ).length,
    failedDocuments: results.length - ready.length,
    comparisonReadiness:
      types.size === 3
        ? "ready_for_triangle"
        : types.size >= 2
          ? "ready_for_pair"
          : "insufficient_documents",
    comparisonStatus:
      review?.pairStatus === "performed"
        ? ("performed" as const)
        : ("not_performed" as const),
    extractionStatus: analyzed.length
      ? ("performed" as const)
      : ("not_performed" as const),
  };
}
