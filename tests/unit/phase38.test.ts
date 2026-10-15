import { describe, it, expect } from "vitest";
import { shipping38Fixture } from "../fixtures/shipping38";
import { numericTokens } from "../../src/modules/evidence/numbers";
import { verifyShippingField } from "../../src/modules/shipping/verify";
import { recoverNative } from "../../src/modules/shipping/recovery";
import { groundShipping } from "../../src/modules/shipping/ground";
import { shippingTypes } from "../../src/modules/shipping/catalog";
import { reviewShipping } from "../../src/modules/shipping/review";
describe("PHASE38 original-block split labels and issuer context", () => {
  it.each([1, 0.8])(
    "grounds fragmented HBL at scale %s without fixed coordinates",
    async (scale) => {
      const f = await shipping38Fixture("house_bl", { scale });
      expect(f.pdf.pages[0].blocks!.some((b) => b.text === "Gross")).toBe(true);
      expect(f.document.classificationStatus).toBe("classified");
      for (const key of [
        "grossWeight",
        "grossWeightUnit",
        "packageCount",
        "packageUnit",
      ])
        expect(f.document.fields[key].current.status, key).toBe("verified");
      expect(f.document.items[0].fields.quantity.current.status).toBe(
        "verified",
      );
      expect(f.document.items[0].fields.quantityUnit.current.status).toBe(
        "verified",
      );
    },
  );
  it.each(["Bill of Lading", "Master Bill of Lading"])(
    "rejects unsupported generic/master even fragmented: %s",
    async (title) => {
      const f = await shipping38Fixture("house_bl", { title, house: false });
      expect(f.document.classificationStatus).toBe("needs_review");
    },
  );
  it("never treats quantity evidence as gross weight", async () => {
    const f = await shipping38Fixture("export_declaration");
    const other = f.pdf.pages[0].blocks!.find((b) =>
      numericTokens(b.text).includes(720),
    )!;
    expect(
      verifyShippingField(
        { value: 720, evidence: { page: 1, blockIds: [other.id] } },
        f.pdf,
        "grossWeight",
      ).current.status,
    ).not.toBe("verified");
  });
  it("can recover a wrong normalized unit while retaining original AI value/source", async () => {
    const f = await shipping38Fixture("house_bl"),
      w = structuredClone(f.wire);
    w.fields.grossWeightUnit.value = "KG";
    const d = recoverNative(groundShipping(w, f.pdf, "house_bl"), f.pdf);
    expect(d.fields.grossWeightUnit.original.value).toBe("KG");
    expect(d.fields.grossWeightUnit.current.value).toBe("KGS");
    expect(d.fields.grossWeightUnit.recovery?.method).toBe("native");
  }, 10000);
  it("compares actual independent fragmented PDFs with quantity/package distinctions", async () => {
    const fs = await Promise.all(
      shippingTypes.map((t) => shipping38Fixture(t)),
    );
    const r = reviewShipping(fs.map((f) => recoverNative(f.document, f.pdf)));
    expect(
      r.primaryChecks!.filter((c) => c.assessment === "confirmed_mismatch"),
    ).toHaveLength(0);
    for (const key of [
      "houseBlNumber",
      "quantity",
      "packageCount",
      "grossWeight",
      "portOfLoading",
      "portOfDischarge",
    ])
      expect(
        r.primaryChecks!.some(
          (c) =>
            c.comparison?.meaning === key && c.assessment === "confirmed_match",
        ),
        key,
      ).toBe(true);
  }, 15000);
});

it("collects independent native fields while classification remains unverified, without confirming that document relationship", async () => {
  const a = await shipping38Fixture("house_bl"),
    b = await shipping38Fixture("house_manifest");
  const w = structuredClone(a.wire);
  w.typeEvidence = { page: 1, blockIds: ["not-a-real-block"] };
  w.fields.grossWeight.evidence = null;
  const before = groundShipping(w, a.pdf, "house_bl"),
    d = recoverNative(before, a.pdf);
  expect(d.classificationStatus).toBe("needs_review");
  expect(d.fields.grossWeight.current.status).toBe("verified");
  expect(d.fields.grossWeight.original.status).not.toBe("verified");
  expect(
    reviewShipping([d, b.document]).relationships!.every(
      (r) => r.status !== "evidence_confirmed",
    ),
  ).toBe(true);
}, 10000);

it("uses bounded flask/thermos vocabulary without equating lab vessels or conflicting capacity", async () => {
  const { compareGoods } =
    await import("../../src/modules/shipping/goods-semantics");
  expect(
    compareGoods(
      "STAINLESS STEEL VACUUM FLASK 600ML",
      "스테인리스 진공 보온병 600ML",
    ).status,
  ).toBe("semantic");
  expect(
    compareGoods(
      "STAINLESS STEEL VACUUM FLASK 600ML",
      "스테인리스 진공 보온병 900ML",
    ).status,
  ).toBe("different");
  expect(compareGoods("GLASS LAB FLASK", "GLASS BOTTLE").status).not.toBe(
    "semantic",
  );
});
