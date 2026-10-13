import type { ShippingResult } from "./prepare";
export function summarizeShipping(results: ShippingResult[]) {
  const ready = results.filter((r) => r.document && !r.error);
  const types = new Set(ready.map((r) => r.uploadSlot));
  return {
    successfulDocuments: ready.length,
    failedDocuments: results.length - ready.length,
    comparisonReadiness:
      types.size === 3
        ? "ready_for_triangle"
        : types.size >= 2
          ? "ready_for_pair"
          : "insufficient_documents",
    comparisonStatus: "not_performed" as const,
    extractionStatus: "not_performed" as const,
  };
}
