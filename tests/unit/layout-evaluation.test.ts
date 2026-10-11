import { describe, expect, it } from "vitest";
import { evaluateLayoutResults } from "../../scripts/lib/layout-evaluation";
import { layoutFixture } from "../fixtures/layouts";
import { groundDocument } from "@/modules/evidence/verify";

describe("live evaluation never substitutes provider failures with mock success", () => {
  it("keeps failed document fields in the coverage denominator", async () => {
    const fixtures = await Promise.all([
      layoutFixture("party-tables", "invoice"),
      layoutFixture("party-tables", "packing_list"),
    ]);
    const report = evaluateLayoutResults(
      [],
      fixtures.map((f) => f.data),
      "party-tables",
    );
    expect(report.providerSuccesses).toBe(0);
    expect(report.expectedFields).toBe(25);
    expect(report.groundedCorrectFields).toBe(0);
    expect(report.classified).toBe(false);
    expect(report.passed).toBe(false);
  });
  it("does not count correct but unverified numbers as grounded or completed", async () => {
    const fixtures = await Promise.all([
      layoutFixture("party-tables", "invoice"),
      layoutFixture("party-tables", "packing_list"),
    ]);
    const results = fixtures.map((f) => ({
      pdf: f.pdf,
      document: groundDocument(f.data, f.pdf),
      error: null,
    }));
    results[0].document.items[0].quantity.status = "unverified";
    const report = evaluateLayoutResults(
      results,
      fixtures.map((f) => f.data),
      "party-tables",
    );
    expect(report.correctValues).toBe(report.expectedFields);
    expect(report.groundedCorrectFields).toBe(report.expectedFields - 1);
    expect(report.ruleCorrect).toBe(false);
    expect(report.passed).toBe(false);
  });
});
