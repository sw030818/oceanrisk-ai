import type {
  AnalysisResult,
  ExtractedDocument,
  GroundedField,
} from "../../src/modules/documents/schema";
import { compareQuantities } from "../../src/modules/rules/quantity";
import { normalizeText } from "../../src/modules/evidence/verify";
import type { LayoutCaseId } from "../../tests/fixtures/layouts";
export function evaluateLayoutResults(
  results: AnalysisResult[],
  expected: ExtractedDocument[],
  id: LayoutCaseId,
) {
  let expectedFields = 0,
    correctValues = 0,
    groundedCorrectFields = 0;
  const equal = (a: unknown, b: unknown) =>
    typeof a === "string" && typeof b === "string"
      ? normalizeText(a) === normalizeText(b)
      : a === b;
  const count = (
    wanted: { value: unknown },
    actual: GroundedField<unknown> | undefined,
  ) => {
    if (wanted.value === null) return;
    expectedFields++;
    if (actual && equal(actual.value, wanted.value)) {
      correctValues++;
      if (actual.status === "verified") groundedCorrectFields++;
    }
  };
  for (const [index, wanted] of expected.entries()) {
    const doc = results[index]?.document;
    for (const key of [
      "seller",
      "buyer",
      "documentNumber",
      "transactionReference",
      "purchaseOrder",
      "invoiceReference",
      "partialShipment",
    ] as const)
      if (wanted[key]) count(wanted[key], doc?.[key]);
    for (const item of wanted.items) {
      const candidates =
        doc?.items.filter((row) =>
          equal(row.description.value, item.description.value),
        ) ?? [];
      const row = candidates.length === 1 ? candidates[0] : undefined;
      for (const key of ["description", "quantity", "unit"] as const)
        count(item[key], row?.[key]);
    }
  }
  const docs = results.flatMap((r) => (r.document ? [r.document] : [])),
    checks = compareQuantities(docs);
  const confirmedMismatches = checks.filter(
    (c) => c.status === "mismatch",
  ).length;
  const ruleCorrect =
    id === "reference-conflict"
      ? checks.length === 1 && checks[0].id === "conflicting-identifiers"
      : id === "missing-reference"
        ? checks.length === 2 &&
          checks.every((c) => c.confidence === "candidate")
        : checks.length === 2 &&
          checks.every(
            (c) =>
              c.confidence === "confirmed" &&
              c.status ===
                (id === "quantity-mismatch" &&
                normalizeText(c.item ?? "") === "stainless steel bolts"
                  ? "mismatch"
                  : "match"),
          );
  const providerSuccesses = results.filter(
    (r) => r.document && !r.error,
  ).length;
  const classified = expected.every(
    (e, i) => results[i]?.document?.type === e.type,
  );
  return {
    providerSuccesses,
    documentCount: expected.length,
    classified,
    expectedFields,
    correctValues,
    groundedCorrectFields,
    ruleCorrect,
    confirmedMismatches,
    passed:
      providerSuccesses === expected.length &&
      classified &&
      correctValues === expectedFields &&
      groundedCorrectFields === expectedFields &&
      ruleCorrect,
    ruleStates: checks.map((c) => ({
      status: c.status,
      confidence: c.confidence,
    })),
    fieldStates: results.map((r) =>
      r.document
        ? {
            seller: r.document.seller.status,
            buyer: r.document.buyer.status,
            reference: r.document.transactionReference.status,
            items: r.document.items.map((i) => ({
              description: i.description.status,
              quantity: i.quantity.status,
              unit: i.unit.status,
            })),
          }
        : null,
    ),
    errorCodes: results.map((r) => r.error?.code ?? null),
    outputIssues: results.map((r) => r.error?.diagnostics?.outputIssue ?? null),
    providerDiagnostics: results.map((r) =>
      r.error?.diagnostics
        ? {
            httpStatus: r.error.diagnostics.httpStatus,
            status: r.error.diagnostics.status,
            outputIssue: r.error.diagnostics.outputIssue ?? null,
            outputFields: r.error.diagnostics.outputFields ?? [],
            outputFailures: r.error.diagnostics.outputFailures ?? [],
          }
        : null,
    ),
  };
}
