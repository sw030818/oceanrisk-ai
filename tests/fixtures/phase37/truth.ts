import type { Scenario37 } from "./development";
// Defined from the document-generation specification, never from model output.
// A reference fault is a warning; it need not be a confirmed numerical mismatch.
export function truth37(s: Scenario37) {
  const fault = s.error ?? null;
  return {
    id: s.id,
    partition: s.partition,
    kind: s.kind,
    fault,
    confirmedFault:
      fault && !["houseBlNumber", "declarationNumber"].includes(fault)
        ? fault
        : null,
    expectedReferencesConflict:
      fault === "houseBlNumber" || fault === "declarationNumber",
    expectedAggregation:
      s.variant === "multi-declaration"
        ? "confirmed"
        : s.variant === "split-item"
          ? "held"
          : null,
    // The omitted-row case prints an extra 25 items in its total: a verified
    // document-total difference is real, even if its item coverage is incomplete.
    allowedDifferences:
      s.variant === "omitted-row" ? ["quantity"] : fault ? [fault] : [],
    unsupported: s.variant === "unsupported",
    partial: s.variant === "partial",
  };
}
