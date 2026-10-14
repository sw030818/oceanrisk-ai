import { it, expect } from "vitest";
import { scenario37 } from "../fixtures/phase37/cases";
import { development37 } from "../fixtures/phase37/development";
import { groundShipping } from "../../src/modules/shipping/ground";
import {
  recoverCitedClassification,
  verifyClassification,
} from "../../src/modules/shipping/verify";
import { reviewShipping } from "../../src/modules/shipping/review";
import { recoverNative } from "../../src/modules/shipping/recovery";
import { reviewIssues } from "../../src/modules/shipping/issues";
it("recovers actual Korean manifest title contradiction, preserving the wrong initial AI type", async () => {
  const { fixtures } = await scenario37(development37[1]);
  const f = fixtures[2],
    wire = structuredClone(f.wire);
  wire.type = "house_bl";
  const d = groundShipping(wire, f.pdf, "house_manifest");
  expect(d.detectedType).toBe("house_manifest");
  expect(d.classificationStatus).toBe("classified");
  expect(d.classification?.original.value).toBe("house_bl");
  expect(d.classification?.original.status).toBe("unverified");
  expect(d.classification?.current.value).toBe("house_manifest");
  expect(d.classification?.recovery?.method).toBe("native");
  const r = reviewShipping(
    fixtures.map((v, i) => recoverNative(i === 2 ? d : v.document, v.pdf)),
  );
  expect(r.outcomes?.mismatches).toBe(0);
  expect(r.issues).toHaveLength(0);
});
it.each(["fabricated", "unknown", "ocr", "mixed"])(
  "never repairs unsupported %s title evidence",
  async (mode) => {
    const { fixtures } = await scenario37(development37[1]);
    const f = fixtures[2],
      pdf = structuredClone(f.pdf);
    if (mode === "ocr") pdf.pages[0].textSource = "ocr";
    if (mode === "mixed") {
      const p = structuredClone(pdf.pages[0]);
      p.page = 2;
      p.blocks![0].text = "EXPORT DECLARATION";
      pdf.pages.push(p);
    }
    const original = verifyClassification(
      mode === "unknown" ? "unknown" : "house_bl",
      mode === "fabricated"
        ? { page: 1, blockIds: ["invented"] }
        : f.wire.typeEvidence,
      pdf,
    );
    const d = recoverCitedClassification(original, pdf);
    expect(d).toEqual(original);
    expect(d.current.status).not.toBe("verified");
  },
);
it("joins the same reference dependency but preserves independent numerical errors and all check IDs", async () => {
  const { fixtures } = await scenario37(development37[15]);
  const r = reviewShipping(
    fixtures.map((f) => recoverNative(f.document, f.pdf)),
  );
  const rel = r.relationships!.find((r) => r.status === "conflict")!;
  const f = rel.evidence.filter((f) => f.fieldName === "houseBlNumber");
  const base = {
    id: "ref",
    scope: "house_bl_manifest" as const,
    category: "reference" as const,
    assessment: "provisional_mismatch" as const,
    relationshipIds: [rel.id],
    fields: f,
    explanation: "reference conflict",
    followUp: "confirm reference",
  };
  const dependent = {
    ...base,
    id: "weight-held",
    category: "weight" as const,
    assessment: "provisional_match" as const,
  };
  const error = {
    ...base,
    id: "independent-weight",
    category: "weight" as const,
    assessment: "confirmed_mismatch" as const,
  };
  const issues = reviewIssues({
    ...r,
    primaryChecks: [base, dependent, error],
  });
  expect(issues).toHaveLength(2);
  expect(
    issues.some(
      (i) =>
        i.relatedCheckIds.includes(base.id) &&
        i.relatedCheckIds.includes(dependent.id),
    ),
  ).toBe(true);
  expect(
    issues.some(
      (i) =>
        i.relatedCheckIds.includes(error.id) && i.relatedCheckIds.length === 1,
    ),
  ).toBe(true);
});
it.each(["house_bl", "export_declaration"] as const)(
  "an unverified %s candidate cannot poison an independent valid pair",
  async (type) => {
    const { fixtures } = await scenario37(development37[1]);
    const f = fixtures[2],
      wrong = structuredClone(f.wire);
    wrong.type = type;
    wrong.typeEvidence = { page: 1, blockIds: ["invented"] };
    const bad = groundShipping(wrong, f.pdf, "house_manifest");
    expect(bad.classificationStatus).toBe("needs_review");
    const docs = fixtures.map((v, i) =>
      recoverNative(i === 2 ? bad : v.document, v.pdf),
    );
    const r = reviewShipping(docs);
    const known = new Set(docs.slice(0, 2).map((d) => d.id));
    const quantity = r.primaryChecks?.find(
      (c) =>
        c.comparison?.meaning === "quantity" &&
        c.comparison.scope === "hbl_record" &&
        c.fields.length > 0 &&
        c.fields.every((f) => known.has(f.documentId)),
    );
    expect(quantity?.assessment).toBe("confirmed_match");
    expect(quantity?.comparison?.reasonCodes).not.toContain("DUPLICATE_CARGO");
  },
);
it("groups declaration-membership dependency warnings while preserving every original judgment", async () => {
  const { fixtures } = await scenario37(development37[16]);
  const r = reviewShipping(
    fixtures.map((f) => recoverNative(f.document, f.pdf)),
  );
  const attention = r.primaryChecks!.filter(
    (c) => !["confirmed_match", "not_applicable"].includes(c.assessment),
  );
  expect(r.relationships?.some((rel) => rel.mappingWarnings?.length)).toBe(
    true,
  );
  expect(r.issues!.length).toBeLessThan(attention.length / 2);
  expect(
    attention.every((c) =>
      r.issues!.some((i) => i.relatedCheckIds.includes(c.id)),
    ),
  ).toBe(true);
  expect(r.issues!.some((i) => i.assessment === "confirmed_mismatch")).toBe(
    false,
  );
});
