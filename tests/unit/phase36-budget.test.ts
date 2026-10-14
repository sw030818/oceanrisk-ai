import { describe, it, expect } from "vitest";
import {
  reserve36,
  type Budget36,
  policy36,
} from "../../scripts/lib/phase36-live";
import { reconcileTestBudget } from "../../scripts/lib/openai-budget";
const fresh = (): Budget36 => ({
  documents: 0,
  requests: 0,
  measuredCostUsd: 0,
  unresolvedCostUpperUsd: 0,
  maxDocuments: 60,
  maxRequests: 75,
  maxCostUsd: 0.5,
});
describe("independent PHASE36 budget", () => {
  it("uses a separate remote archive and ledger, with native plus extra-call reservation", () => {
    expect(policy36.directory).toBe("test-results/live-phase36");
    expect(policy36.evidenceRef).toBe("refs/heads/validation/phase36-evidence");
    const b = fresh();
    reserve36(b, [0.01], 2);
    expect(b.documents).toBe(1);
    expect(b.requests).toBe(2);
    expect(b.unresolvedCostUpperUsd).toBe(0.01);
  });
  it("stops before document, request or absolute cost caps are exceeded", () => {
    for (const b of [
      { ...fresh(), documents: 60 },
      { ...fresh(), requests: 75 },
      { ...fresh(), measuredCostUsd: 0.499 },
    ])
      expect(() => reserve36(b, [0.002], 1)).toThrow("PHASE36_BUDGET_STOP");
  });
  it("retains unknown usage and reconciles only measured calls", () => {
    const b = fresh();
    reserve36(b, [0.02], 2);
    reconcileTestBudget(b, 0.01, null);
    expect(b.unresolvedCostUpperUsd).toBe(0.02);
    reconcileTestBudget(b, 0.01, 0.002);
    expect(b.measuredCostUsd).toBe(0.002);
    expect(b.unresolvedCostUpperUsd).toBe(0.01);
  });
  it("invalid reservations do not mutate the budget", () => {
    for (const c of [NaN, -1, Infinity]) {
      const b = fresh();
      expect(() => reserve36(b, [c], 1)).toThrow("INVALID_RESERVATION");
      expect(b).toEqual(fresh());
    }
  });
});
