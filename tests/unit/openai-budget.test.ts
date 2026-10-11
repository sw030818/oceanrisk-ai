import { describe, expect, it } from "vitest";
import {
  reserveTestBudget,
  reconcileTestBudget,
  requestUpperCost,
} from "../../scripts/lib/openai-budget";
const fresh = () => ({
  documents: 0,
  measuredCostUsd: 0,
  unresolvedCostUpperUsd: 0,
  maxDocuments: 20,
  maxCostUsd: 0.5,
});
describe("validation budget only (no application usage quota)", () => {
  it("reserves the long-context price multiplier conservatively", () => {
    expect(requestUpperCost(300000)).toBeGreaterThan(
      (301024 * 0.125 * 2 + 4096 * 0.5 * 1.5) / 1e6,
    );
  });
  it("stops a pair that would cross the 20-document cap", () => {
    const b = fresh();
    b.documents = 19;
    expect(() => reserveTestBudget(b, [0.01, 0.01])).toThrow(
      "DOCUMENT_BUDGET_STOP",
    );
    expect(b.documents).toBe(19);
  });
  it("retains unknown spending and prevents cost overrun", () => {
    const b = fresh();
    reserveTestBudget(b, [0.49]);
    reconcileTestBudget(b, 0.49, null);
    expect(() => reserveTestBudget(b, [0.02])).toThrow("COST_BUDGET_STOP");
    expect(b.unresolvedCostUpperUsd).toBe(0.49);
  });
  it("reconciles measured tokens while preserving attempted counts", () => {
    const b = fresh();
    const upper = reserveTestBudget(b, [0.01, 0.01]);
    reconcileTestBudget(b, upper, 0.001);
    expect(b).toMatchObject({
      documents: 2,
      measuredCostUsd: 0.001,
      unresolvedCostUpperUsd: 0,
    });
  });
  it("reserves bounded output and framing", () =>
    expect(requestUpperCost(10000)).toBeGreaterThan(0.002048));
});
