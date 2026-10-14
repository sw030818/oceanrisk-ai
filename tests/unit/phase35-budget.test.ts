import { describe, it, expect } from "vitest";
import { reserve35, type Budget35 } from "../../scripts/lib/phase35-live";
const b = (): Budget35 => ({
  documents: 0,
  requests: 0,
  measuredCostUsd: 0,
  unresolvedCostUpperUsd: 0,
  maxDocuments: 60,
  maxRequests: 75,
  maxCostUsd: 0.5,
});
describe("PHASE35 separate authorization and reservations", () => {
  it("reserves document/request/cost without touching an earlier ledger", () => {
    const budget = b();
    reserve35(budget, [0.01, 0.02], 2);
    expect(budget.documents).toBe(2);
    expect(budget.requests).toBe(2);
    expect(budget.unresolvedCostUpperUsd).toBe(0.03);
    expect(budget.maxCostUsd).toBe(0.5);
  });
  it("unknown previous usage remains spent and stops the dollar limit", () => {
    const budget = b();
    budget.unresolvedCostUpperUsd = 0.49;
    expect(() => reserve35(budget, [0.02], 1)).toThrow("PHASE35_BUDGET_STOP");
    expect(budget.documents).toBe(0);
    expect(budget.unresolvedCostUpperUsd).toBe(0.49);
  });
  it("stops either document or request cap even if cheap", () => {
    const docs = b();
    docs.documents = 60;
    expect(() => reserve35(docs, [0.0001], 1)).toThrow("PHASE35_BUDGET_STOP");
    const requests = b();
    requests.requests = 75;
    expect(() => reserve35(requests, [0.0001], 1)).toThrow(
      "PHASE35_BUDGET_STOP",
    );
  });
  it("rejects invalid reservation inputs", () => {
    for (const cost of [-1, NaN, Infinity])
      expect(() => reserve35(b(), [cost], 1)).toThrow("INVALID_RESERVATION");
    expect(() => reserve35(b(), [0.01, 0.01], 1)).toThrow(
      "INVALID_RESERVATION",
    );
  });
});
