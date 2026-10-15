import { it, expect } from "vitest";
import { policy38, reserve38 } from "../../scripts/lib/phase38-live";
import { reconcileTestBudget } from "../../scripts/lib/openai-budget";
const fresh = () => ({
  documents: 0,
  requests: 0,
  measuredCostUsd: 0,
  unresolvedCostUpperUsd: 0,
  maxDocuments: 8,
  maxRequests: 8,
  maxCostUsd: 0.1,
});
it("has a separate PHASE38 identity and never reserves past any approved cap", () => {
  expect(policy38.directory).toBe("test-results/live-phase38");
  expect(policy38.reserveRecovery).toBe(false);
  for (const mode of ["cost", "documents", "requests"]) {
    const b = fresh();
    if (mode === "cost") b.measuredCostUsd = 0.099;
    if (mode === "documents") b.documents = 8;
    if (mode === "requests") b.requests = 8;
    const before = structuredClone(b);
    expect(() => reserve38(b, [0.01], 1)).toThrow("PHASE38_BUDGET_STOP");
    expect(b).toEqual(before);
  }
});
it("retains unknown timeout cost and includes it in subsequent reservations", () => {
  const b = fresh();
  reserve38(b, [0.08], 1);
  reconcileTestBudget(b, 0.08, null);
  expect(b.unresolvedCostUpperUsd).toBe(0.08);
  expect(() => reserve38(b, [0.03], 1)).toThrow();
  reconcileTestBudget(b, 0.08, 0.001);
  expect(b.unresolvedCostUpperUsd).toBe(0);
  reserve38(b, [0.03], 1);
  expect(b.requests).toBe(2);
});
