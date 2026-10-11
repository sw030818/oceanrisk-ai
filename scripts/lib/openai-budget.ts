import { OPENAI_MAX_OUTPUT_TOKENS } from "../../src/modules/ai/openai-usage";
export interface TestBudget {
  documents: number;
  measuredCostUsd: number;
  unresolvedCostUpperUsd: number;
  maxDocuments: number;
  maxCostUsd: number;
}
export function requestUpperCost(requestBytes: number) {
  // UTF-8 bytes upper-bound text tokens, plus framing, highest input/cache-write
  // rate and a regional 10% reserve. Standard tier, no tools/images.
  const long = requestBytes + 1024 > 272000;
  return (
    (((requestBytes + 1024) * 0.125 * (long ? 2 : 1) +
      OPENAI_MAX_OUTPUT_TOKENS * 0.5 * (long ? 1.5 : 1)) /
      1e6) *
    1.1
  );
}
export function reserveTestBudget(b: TestBudget, costs: number[]) {
  if (!costs.length || costs.some((n) => !Number.isFinite(n) || n < 0))
    throw new Error("INVALID_BUDGET_RESERVATION");
  if (b.documents + costs.length > b.maxDocuments)
    throw new Error("DOCUMENT_BUDGET_STOP");
  const cost = costs.reduce((a, n) => a + n, 0);
  if (b.measuredCostUsd + b.unresolvedCostUpperUsd + cost > b.maxCostUsd)
    throw new Error("COST_BUDGET_STOP");
  b.documents += costs.length;
  b.unresolvedCostUpperUsd += cost;
  return cost;
}
export function reconcileTestBudget(
  b: TestBudget,
  upper: number,
  measured: number | null,
) {
  if (measured === null) return; // Unknown usage retains the reservation.
  if (!Number.isFinite(measured) || measured < 0)
    throw new Error("INVALID_MEASURED_COST");
  b.unresolvedCostUpperUsd = Math.max(0, b.unresolvedCostUpperUsd - upper);
  b.measuredCostUsd += measured;
}
