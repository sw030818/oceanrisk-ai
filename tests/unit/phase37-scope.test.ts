import { beforeAll, describe, expect, it } from "vitest";
import { scenario37 } from "../fixtures/phase37/cases";
import { development37 } from "../fixtures/phase37/development";
import { recoverNative } from "../../src/modules/shipping/recovery";
import { reviewShipping } from "../../src/modules/shipping/review";
import { editShippingField } from "../../src/modules/shipping/edit";
import type { ShippingDocument } from "../../src/modules/shipping/schema";
let normal: ShippingDocument[];
beforeAll(async () => {
  const { fixtures } = await scenario37(development37[20]);
  normal = fixtures.map((f) => recoverNative(f.document, f.pdf));
});
describe("proven declaration membership replaces whole-vs-subset comparisons", () => {
  it("uses independently verified group/item comparisons, preserving original diagnostics and allocation holds", () => {
    const r = reviewShipping(normal),
      p = r.primaryChecks!;
    expect(r.checks.some((c) => c.assessment === "provisional_mismatch")).toBe(
      true,
    );
    expect(p.some((c) => c.scopeResolution?.kind === "subset")).toBe(true);
    expect(
      p
        .filter((c) => c.scopeResolution?.kind === "subset")
        .every((c) => c.assessment === "not_applicable"),
    ).toBe(true);
    expect(
      p.filter((c) => c.title === "복수 신고 대응 품목 수량"),
    ).toHaveLength(2);
    expect(p.find((c) => c.declarationCoverage)?.assessment).toBe(
      "confirmed_match",
    );
    expect(r.issues).toHaveLength(1);
    expect(r.issues![0].title).toBe("복수 신고 포장·중량 배분 확인");
    expect(r.issues![0].relatedCheckIds.length).toBeGreaterThan(1);
    expect(
      p.some(
        (c) =>
          c.scopeResolution?.kind === "allocation" &&
          c.assessment === "provisional_match",
      ),
    ).toBe(true);
  });
  it("preserves source errors, user edits and missing membership instead of resolving them from a sum", () => {
    for (const mode of ["evidence", "edit", "membership"] as const) {
      const docs = structuredClone(normal),
        ed = docs.find((d) => d.detectedType === "export_declaration")!;
      if (mode === "edit")
        ed.items[0].fields.quantity = editShippingField(
          ed.items[0].fields.quantity,
          5,
        );
      if (mode === "evidence")
        ed.items[0].fields.quantity.current.status = "unverified";
      if (mode === "membership") {
        docs[0].references = [];
        delete docs[0].fields.declarationNumber;
      }
      const r = reviewShipping(docs);
      expect(r.primaryChecks!.some((c) => c.scopeResolution)).toBe(false);
      expect(r.issues!.length).toBeGreaterThan(1);
    }
  });
  it.each([23, 24])(
    "does not resolve duplicate/split or shared scope case %i",
    async (index) => {
      const { fixtures } = await scenario37(development37[index]);
      const r = reviewShipping(
        fixtures.map((f) => recoverNative(f.document, f.pdf)),
      );
      expect(r.primaryChecks!.some((c) => c.scopeResolution)).toBe(false);
    },
  );
  it("keeps a genuine Manifest quantity error outside the aligned carrier proof", async () => {
    const { fixtures } = await scenario37({
      ...development37[20],
      error: "quantity",
    });
    const r = reviewShipping(
      fixtures.map((f) => recoverNative(f.document, f.pdf)),
    );
    expect(
      r.primaryChecks!.some(
        (c) =>
          c.assessment === "confirmed_mismatch" &&
          c.comparison?.meaning === "quantity",
      ),
    ).toBe(true);
    expect(r.issues!.some((i) => i.assessment === "confirmed_mismatch")).toBe(
      true,
    );
  });
  it("does not treat an unclassified or partial carrier as an aligned whole", () => {
    for (const mode of ["unknown", "partial"] as const) {
      const docs = structuredClone(normal),
        mf = docs.find((d) => d.detectedType === "house_manifest")!;
      if (mode === "unknown") mf.classificationStatus = "needs_review";
      else
        mf.fields.shipmentScope = editShippingField(
          mf.fields.shipmentScope,
          "partial shipment",
        );
      const r = reviewShipping(docs);
      expect(
        r
          .primaryChecks!.filter((c) => c.scopeResolution)
          .every((c) => !c.fields.some((f) => f.documentId === mf.id)),
      ).toBe(true);
    }
  });
});
