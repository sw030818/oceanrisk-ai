import type { ShippingDocument } from "../../src/modules/shipping/schema";
import { reviewShipping } from "../../src/modules/shipping/review";
import { shippingValues } from "../../src/modules/shipping/fields";
import { independentlyVerified } from "../../src/modules/shipping/effective";
import { truth37 } from "../../tests/fixtures/phase37/truth";
import type { Scenario37 } from "../../tests/fixtures/phase37/development";
export const core37 = [
  "houseBlNumber",
  "declarationNumber",
  "goodsDescription",
  "hsCode",
  "shipper",
  "consignee",
  "quantity",
  "packageCount",
  "grossWeight",
  "containerNumber",
  "sealNumber",
  "portOfLoading",
  "portOfDischarge",
];
export function measure37(s: Scenario37, docs: ShippingDocument[]) {
  const r = reviewShipping(docs),
    checks = r.primaryChecks ?? r.checks,
    t = truth37(s);
  const core = checks.filter(
    (c) =>
      c.comparison?.scope === "hbl_record" &&
      core37.includes(c.comparison.meaning),
  );
  const errors = [
    ...new Set(
      core
        .filter((c) => c.assessment === "confirmed_mismatch")
        .map((c) => c.comparison!.meaning),
    ),
  ];
  const found = t.fault
    ? checks.some(
        (c) =>
          (c.comparison?.meaning === t.fault ||
            c.fields.some((f) => f.fieldName === t.fault)) &&
          [
            "confirmed_mismatch",
            "provisional_mismatch",
            "needs_review",
          ].includes(c.assessment),
      )
    : false;
  const allowed = new Set(t.allowedDifferences);
  const fp = errors.filter(
    (e) => !allowed.has(e as NonNullable<typeof t.fault>),
  );
  const fields = docs
    .flatMap(shippingValues)
    .filter((f) => f.current.value !== null);
  const relationships = r.relationships ?? [];
  const expectedDocuments =
    s.variant === "multi-declaration" ||
    s.variant === "split-item" ||
    s.variant === "duplicate"
      ? 4
      : 3;
  const expectedPairCount =
    s.variant === "unsupported" || s.error === "houseBlNumber"
      ? 1
      : expectedDocuments === 4
        ? 5
        : 3;
  const relationTruthConflict = s.error === "houseBlNumber";
  const trueConfirmed = relationships.filter(
    (rel) =>
      rel.status === "evidence_confirmed" &&
      (!relationTruthConflict ||
        !rel.documentIds.some((id) => id.endsWith("house_manifest"))),
  ).length;
  const falseConfirmed = relationships.filter(
    (rel) =>
      rel.status === "evidence_confirmed" &&
      relationTruthConflict &&
      rel.documentIds.some((id) => id.endsWith("house_manifest")),
  ).length;
  return {
    id: s.id,
    partition: s.partition,
    kind: s.kind,
    layout: s.layout,
    language: s.language,
    variant: s.variant ?? null,
    expectedFault: t.fault,
    expectedDocuments,
    documents: docs.length,
    classified: docs.filter((d) => d.classificationStatus === "classified")
      .length,
    fieldPresent: fields.length,
    fieldVerified: fields.filter(independentlyVerified).length,
    expectedPairCount,
    relationshipTP: trueConfirmed,
    relationshipFP: falseConfirmed,
    relationships: relationships.map((rel) => ({
      status: rel.status,
      sharedRoles: rel.sharedRoles,
      conflictRoles: rel.conflictRoles,
    })),
    confirmedErrors: errors,
    confirmedFalsePositives: fp,
    faultDetected: found,
    confirmedFaultDetected: t.confirmedFault
      ? errors.includes(t.confirmedFault)
      : null,
    provisional: core.filter(
      (c) =>
        c.assessment.startsWith("provisional") ||
        c.assessment === "needs_review" ||
        c.assessment === "insufficient_information",
    ).length,
    independentIssues: r.issues?.length ?? null,
    requiredMissing: r.outcomes?.requiredMissing ?? null,
    aggregation: checks
      .filter((c) => c.title === "복수 신고 물품 수량 합계")
      .map((c) => ({
        assessment: c.assessment,
        derived: c.computedValues?.length ?? 0,
      })),
    primary: core.map((c) => ({
      meaning: c.comparison!.meaning,
      status: c.assessment,
      codes: c.comparison!.reasonCodes,
    })),
  };
}
export function summarize37(rows: ReturnType<typeof measure37>[]) {
  const sum = (
    k:
      | "documents"
      | "classified"
      | "fieldPresent"
      | "fieldVerified"
      | "relationshipTP"
      | "relationshipFP"
      | "expectedPairCount"
      | "provisional",
  ) => rows.reduce((n, r) => n + r[k], 0);
  const faults = rows.filter((r) => r.expectedFault),
    normal = rows.filter((r) => r.kind === "normal"),
    tp = rows.filter((r) => r.confirmedFaultDetected === true).length,
    fn = rows.filter((r) => r.confirmedFaultDetected === false).length,
    fp = rows.reduce((n, r) => n + r.confirmedFalsePositives.length, 0);
  return {
    scenarios: rows.length,
    documents: sum("documents"),
    classified: sum("classified"),
    fieldPresent: sum("fieldPresent"),
    fieldVerified: sum("fieldVerified"),
    fieldVerificationRate: sum("fieldVerified") / sum("fieldPresent"),
    errorScenarios: faults.length,
    flaggedFaults: faults.filter((r) => r.faultDetected).length,
    confirmedTP: tp,
    confirmedFP: fp,
    confirmedFN: fn,
    confirmedPrecision: tp + fp ? tp / (tp + fp) : null,
    confirmedRecall: tp + fn ? tp / (tp + fn) : null,
    relationshipTP: sum("relationshipTP"),
    relationshipFP: sum("relationshipFP"),
    relationshipExpected: sum("expectedPairCount"),
    normalScenarios: normal.length,
    normalWithHolds: normal.filter((r) => r.provisional > 0).length,
    unresolvedCoreComparisons: sum("provisional"),
  };
}

// A fixed gold denominator prevents an extractor from improving its score by
// leaving difficult fields null. Deduplicate the same physical field, including
// backward-compatible first-Seal aliases. No gold is supplied to the provider.
export function goldCoverage37(
  expected: ShippingDocument[],
  actual: ShippingDocument[],
) {
  const readings = (d: ShippingDocument) =>
    [
      ...Object.entries(d.fields).map(([role, field]) => ({ role, field })),
      ...d.additionalFields.map((f) => ({ role: f.meaning, field: f.field })),
      ...d.items.flatMap((i) =>
        Object.entries(i.fields).map(([role, field]) => ({ role, field })),
      ),
      ...d.cargoRecords.flatMap((i) =>
        Object.entries(i.fields).map(([role, field]) => ({ role, field })),
      ),
      ...d.containers.flatMap((c) =>
        Object.entries(c).flatMap(([role, f]) =>
          role === "id"
            ? []
            : role === "sealNumbers"
              ? (c.sealNumbers ?? []).map((field) => ({
                  role: "sealNumber",
                  field,
                }))
              : [
                  {
                    role,
                    field:
                      f as import("../../src/modules/shipping/schema").ShippingField,
                  },
                ],
        ),
      ),
      ...d.references.map((r) => ({
        role:
          r.kind === "house_bl"
            ? "houseBlNumber"
            : r.kind === "export_declaration"
              ? "declarationNumber"
              : r.kind,
        field: r.number,
      })),
    ].filter(
      (r) =>
        r.field?.current?.value !== null &&
        r.field?.current?.value !== undefined,
    );
  let goldFields = 0,
    extractedCorrect = 0,
    verifiedCorrect = 0;
  for (const d of expected) {
    const gold = [
      ...new Map(
        readings(d).map((r) => [
          JSON.stringify([
            r.role,
            r.field.current.value,
            r.field.current.source?.page,
            r.field.current.source?.segments?.map((s) => s.blockId),
          ]),
          r,
        ]),
      ).values(),
    ];
    const predictions = actual.find((p) => p.id === d.id);
    const actualFields = predictions ? readings(predictions) : [];
    for (const g of gold) {
      goldFields++;
      const normalize = (v: unknown) =>
        g.role === "hsCode"
          ? String(v).replace(/[. -]/g, "")
          : typeof v === "string"
            ? v.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim()
            : v;
      const matches = actualFields.filter(
        (p) =>
          p.role === g.role &&
          normalize(p.field.current.value) === normalize(g.field.current.value),
      );
      if (matches.length) extractedCorrect++;
      if (
        matches.some(
          (p) =>
            independentlyVerified(p.field) &&
            p.field.current.source?.page === g.field.current.source?.page &&
            p.field.current.source?.segments?.some((s) =>
              g.field.current.source?.segments?.some(
                (t) => t.blockId === s.blockId,
              ),
            ) &&
            (!g.field.current.source?.layout ||
              (p.field.current.source?.layout?.rowId ===
                g.field.current.source.layout.rowId &&
                p.field.current.source?.layout?.tableId ===
                  g.field.current.source.layout.tableId)),
        )
      )
        verifiedCorrect++;
    }
  }
  return {
    goldFields,
    extractedCorrect,
    verifiedCorrect,
    extractionRecall: goldFields ? extractedCorrect / goldFields : null,
    verifiedGoldRecall: goldFields ? verifiedCorrect / goldFields : null,
  };
}
