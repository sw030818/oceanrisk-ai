import { it, expect, beforeAll } from "vitest";
import { shipping34Fixture } from "../fixtures/shipping34";
import type { ShippingDocument } from "../../src/modules/shipping/schema";
import { reviewShipping } from "../../src/modules/shipping/review";
import { reviewIssues } from "../../src/modules/shipping/issues";
import { editShippingField } from "../../src/modules/shipping/edit";
import { ref32 } from "../../src/modules/shipping/review-evidence";
import {
  literalReading,
  pairedReadings,
} from "../../src/modules/shipping/display-reading";
let docs: ShippingDocument[];
beforeAll(async () => {
  docs = await Promise.all(
    ["house_bl", "house_manifest"].map(
      async (t) =>
        (await shipping34Fixture(t as "house_bl" | "house_manifest")).document,
    ),
  );
});
it("links one bad source to dependent checks, preserving independent Seal and quantity errors", () => {
  const d = structuredClone(docs[0]),
    base = reviewShipping(docs);
  const f = d.fields.grossWeight;
  f.current.status = "unverified";
  f.current.reason = "wrong cited block";
  const template = base.primaryChecks!.find(
    (c) => c.comparison?.meaning === "grossWeight",
  )!;
  const first = {
    ...template,
    id: "bad-weight",
    assessment: "provisional_match" as const,
    fields: [ref32(d, "grossWeight", f)],
  };
  const dependent = {
    ...first,
    id: "same-source-dependent",
    category: "weight" as const,
  };
  const seal = {
    ...template,
    id: "real-seal-error",
    category: "container" as const,
    assessment: "confirmed_mismatch" as const,
    comparison: { ...template.comparison!, meaning: "sealNumber" },
  };
  const qty = {
    ...template,
    id: "real-quantity-error",
    category: "quantity" as const,
    assessment: "confirmed_mismatch" as const,
    comparison: { ...template.comparison!, meaning: "quantity" },
  };
  const r = reviewIssues(
    { ...base, primaryChecks: [first, dependent, seal, qty] },
    [d, ...docs.slice(1)],
  );
  expect(r).toHaveLength(3);
  expect(
    r.find((i) => i.relatedCheckIds.includes(first.id))?.relatedCheckIds,
  ).toContain(dependent.id);
  expect(r.filter((i) => i.assessment === "confirmed_mismatch")).toHaveLength(
    2,
  );
  expect([...new Set(r.flatMap((i) => i.relatedCheckIds))]).toEqual(
    expect.arrayContaining([first.id, dependent.id, seal.id, qty.id]),
  );
});
it("does not merge independent unverified fields just because classification failed", () => {
  const ds = structuredClone(docs),
    d = ds[0];
  d.classificationStatus = "needs_review";
  d.classification!.current.status = "unverified";
  d.fields.grossWeight.current.status = "unverified";
  d.fields.packageCount.current.status = "unverified";
  const r = reviewShipping(ds);
  expect(r.issues!.some((i) => i.cause === "classification")).toBe(true);
  expect(
    r.issues!.some((i) =>
      i.rootCauseIds?.some((k) => k.endsWith("/grossWeight")),
    ),
  ).toBe(true);
  expect(
    r.issues!.some((i) =>
      i.rootCauseIds?.some((k) => k.endsWith("/packageCount")),
    ),
  ).toBe(true);
  expect(
    r.primaryChecks!.filter(
      (c) =>
        c.fields.some((f) => f.documentId === d.id) &&
        c.assessment === "confirmed_mismatch",
    ),
  ).toHaveLength(0);
});
it("separates historical failure from current recovery and user corrections", () => {
  const ds = structuredClone(docs),
    f = ds[0].fields.grossWeight;
  f.original.status = "unverified";
  f.recovery = {
    method: "native",
    field: structuredClone(f.current),
    failureCode: "INVALID_CITATION",
    target: "document/grossWeight",
  };
  const r = reviewShipping(ds);
  expect(r.outcomes!.evidenceFailed).toBeGreaterThan(0);
  expect(r.outcomes!.evidenceRecovered).toBeGreaterThan(0);
  const before = r.outcomes!.evidenceUnverified!;
  ds[0].fields.grossWeight = editShippingField(f, 641);
  const edited = reviewShipping(ds);
  expect(edited.outcomes!.evidenceUnverified).toBe(before);
  expect(
    edited.primaryChecks!.some(
      (c) =>
        c.fields.some((f) => f.field.current.status === "user_edited") &&
        c.assessment.startsWith("provisional"),
    ),
  ).toBe(true);
});
it("preserves the verified original numeric spelling and pairs only same-owner units", () => {
  const ds = structuredClone(docs),
    f = ds[0].fields.grossWeight;
  // Same number and already-verified source: presentation must retain spelling.
  f.original.source!.segments![0].quote = "640.000 KGS";
  f.current = structuredClone(f.original);
  expect(literalReading(f)).toBe("640.000");
  const values = pairedReadings([
    ref32(ds[0], "grossWeight", f),
    ref32(ds[0], "grossWeightUnit", ds[0].fields.grossWeightUnit),
  ]);
  expect(values).toHaveLength(1);
  expect(values[0].text).toBe("640.000 KGS");
  const edited = editShippingField(f, 641);
  expect(literalReading(edited)).toBe("641");
  const wrong = pairedReadings([
    ref32(ds[0], "grossWeight", f),
    ref32(ds[1], "grossWeightUnit", ds[1].fields.grossWeightUnit),
  ]);
  expect(wrong).toHaveLength(2);
});

it("links compatible partial product meaning and identical HS owner holds without hiding an actual HS conflict", async () => {
  const fs = await Promise.all([
    shipping34Fixture("house_bl"),
    shipping34Fixture("export_declaration"),
    shipping34Fixture("house_manifest"),
  ]);
  const { recoverNative } = await import("../../src/modules/shipping/recovery");
  const r = reviewShipping(fs.map((f) => recoverNative(f.document, f.pdf)));
  const issue = r.issues!.find((i) =>
    i.rootCauseIds?.some((k) => k.includes("product-meaning")),
  );
  expect(issue).toBeDefined();
  expect(issue!.affectedFieldNames).toEqual(
    expect.arrayContaining(["goodsDescription", "hsCode"]),
  );
  expect(issue!.relatedCheckIds).toEqual(
    expect.arrayContaining(
      r
        .primaryChecks!.filter(
          (c) =>
            ["goodsDescription", "hsCode"].includes(
              c.comparison?.meaning ?? "",
            ) && c.assessment === "provisional_match",
        )
        .map((c) => c.id),
    ),
  );
  const changed = await shipping34Fixture("house_manifest", {
    hsCode: "3924.10-0000",
  });
  const bad = reviewShipping([
    ...fs.slice(0, 2).map((f) => recoverNative(f.document, f.pdf)),
    recoverNative(changed.document, changed.pdf),
  ]);
  expect(
    bad.issues!.some((i) =>
      i.rootCauseIds?.some((k) => k.includes("product-meaning")),
    ),
  ).toBe(false);
  expect(
    bad.primaryChecks!.some(
      (c) =>
        c.comparison?.meaning === "hsCode" && c.assessment.endsWith("mismatch"),
    ),
  ).toBe(true);
}, 15000);
