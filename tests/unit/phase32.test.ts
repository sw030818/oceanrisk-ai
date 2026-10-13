import { unicodePdf } from "../fixtures/shipping31";
import { extractPdfText } from "@/modules/pdf/extract";
import { verifyShippingField } from "@/modules/shipping/verify";
import { beforeAll, describe, it, expect } from "vitest";
import { shipping32Fixture } from "../fixtures/shipping32";
import { reviewShipping } from "@/modules/shipping/review";
import {
  shippingCaseSchema,
  type ShippingDocument,
} from "@/modules/shipping/schema";
import {
  editShippingField,
  restoreShippingField,
} from "@/modules/shipping/edit";
import { groundShipping } from "@/modules/shipping/ground";
import { key32, unit32 } from "@/modules/shipping/review-evidence";
let normal: Awaited<ReturnType<typeof shipping32Fixture>>[];
beforeAll(async () => {
  normal = await Promise.all(
    ["house_bl", "export_declaration", "house_manifest"].map((t) =>
      shipping32Fixture(t as ShippingDocument["uploadType"]),
    ),
  );
});
const docs = () => structuredClone(normal.map((f) => f.document));
const confirmedErrors = (d: ShippingDocument[]) =>
  reviewShipping(d).checks.filter((c) => c.assessment === "confirmed_mismatch");
const check = (d: ShippingDocument[], scope: string, title: string) =>
  reviewShipping(d).checks.find((c) => c.scope === scope && c.title === title);
describe("PHASE32 deterministic relationships/comparison with actual PDF-grounded MOCK AI", () => {
  it("native evidence verifies all three normal documents and independent row coverage", () => {
    for (const f of normal) {
      expect(f.document.classificationStatus).toBe("classified");
      expect(f.document.collectionCoverage?.containers.complete).toBe(true);
    }
    expect(normal[2].document.collectionCoverage?.cargoRecords.complete).toBe(
      true,
    );
  });
  it("two types compare strong HBL relationship without requiring a third document", () => {
    const r = reviewShipping([docs()[0], docs()[2]]);
    expect(r.pairStatus).toBe("performed");
    expect(r.triangleStatus).toBe("insufficient_documents");
    expect(r.relationships?.[0].status).toBe("evidence_confirmed");
    expect(
      r.checks.some(
        (c) => c.category === "packaging" && c.assessment === "confirmed_match",
      ),
    ).toBe(true);
  });
  it("three strongly linked types form a verified triangle and no false warning", () => {
    const r = reviewShipping(docs());
    expect(r.triangleStatus).toBe("performed");
    expect(r.summary?.confirmedRelationships).toBe(3);
    expect(r.summary?.confirmedMismatches).toBe(0);
    expect(
      r.checks.filter(
        (c) => c.scope === "triangle" && c.assessment === "confirmed_match",
      ),
    ).toHaveLength(3);
  });
  it("actual differing totals and Seal values produce grounded confirmed mismatches", async () => {
    const f = await shipping32Fixture("house_manifest", "mismatch"),
      d = docs();
    d[2] = f.document;
    const r = reviewShipping(d);
    expect(
      r.checks.some(
        (c) =>
          c.category === "packaging" && c.assessment === "confirmed_mismatch",
      ),
    ).toBe(true);
    expect(
      r.checks.some(
        (c) => c.category === "weight" && c.assessment === "confirmed_mismatch",
      ),
    ).toBe(true);
    expect(
      r.checks.some(
        (c) =>
          c.title?.includes("Seal") && c.assessment === "confirmed_mismatch",
      ),
    ).toBe(true);
  });
  it("shares semantic references without comparing an HBL with an export declaration number", () => {
    const r = reviewShipping(docs());
    expect(r.relationships?.some((r) => r.conflictRoles.length)).toBe(false);
  });
  it("same container and name alone never confirm shipment identity", async () => {
    const a = await shipping32Fixture("house_bl", "uncertain"),
      b = await shipping32Fixture("house_manifest", "uncertain");
    const r = reviewShipping([a.document, b.document]);
    expect(r.relationships?.[0].status).toBe("proposed");
    expect(r.summary?.confirmedMismatches).toBe(0);
    expect(r.checks.some((c) => c.assessment === "provisional_match")).toBe(
      true,
    );
  });
  it("different shipments sharing containers and parties are protected by actual reference conflicts", async () => {
    const b = await shipping32Fixture("house_manifest", "normal", {
      hbl: "OTHER-BL",
      declaration: "OTHER-DECL",
      shipment: "OTHER-SHIP",
      roots: { packageCount: 28 },
    });
    const r = reviewShipping([docs()[0], b.document]);
    expect(r.relationships?.[0].status).toBe("conflict");
    expect(
      r.checks
        .filter((c) => c.category === "packaging")
        .every((c) => c.assessment !== "confirmed_mismatch"),
    ).toBe(true);
    expect(r.triangleStatus).not.toBe("performed");
  });
  it("conflicting HBL with a shared explicit shipment produces independent reference warning and protects quantities", async () => {
    const b = await shipping32Fixture("house_manifest", "normal", {
      hbl: "OTHER-BL",
      roots: { packageCount: 28 },
    });
    const r = reviewShipping([docs()[0], b.document]);
    expect(r.relationships?.[0].status).toBe("conflict");
    expect(
      r.checks.some(
        (c) =>
          c.category === "reference" && c.assessment === "confirmed_mismatch",
      ),
    ).toBe(true);
    expect(
      r.checks
        .filter((c) => c.category === "packaging")
        .every((c) => c.assessment !== "confirmed_mismatch"),
    ).toBe(true);
  });
  it("partial shipment continues comparisons but prevents definitive count errors", async () => {
    const b = await shipping32Fixture("house_manifest", "mismatch", {
      roots: { shipmentScope: "partial shipment" },
    });
    const r = reviewShipping([docs()[0], b.document]);
    expect(
      r.checks.some(
        (c) =>
          c.category === "packaging" && c.assessment === "provisional_mismatch",
      ),
    ).toBe(true);
    expect(
      r.checks
        .filter((c) => c.category === "packaging")
        .every((c) => c.assessment !== "confirmed_mismatch"),
    ).toBe(true);
  });
  it("PCS goods quantity is not compared to CTNS packages", () => {
    const r = reviewShipping(docs());
    for (const c of r.checks.filter((c) => c.category === "quantity"))
      expect(c.fields.some((f) => f.fieldName === "packageCount")).toBe(false);
    expect(confirmedErrors(docs())).toHaveLength(0);
  });
  it("net and gross weights never occupy one numeric comparison", () => {
    for (const c of reviewShipping(docs()).checks.filter(
      (c) => c.category === "weight",
    ))
      expect(
        c.fields.some((f) => f.fieldName === "netWeight") &&
          c.fields.some((f) => f.fieldName === "grossWeight"),
      ).toBe(false);
  });
  it("does not compare declared weight to transportation gross weight", () => {
    for (const c of reviewShipping(docs()).checks.filter(
      (c) => c.category === "weight",
    ))
      expect(c.fields.some((f) => f.fieldName === "declaredWeight")).toBe(
        false,
      );
  });
  it("item ordering cannot change deterministic comparison output", () => {
    const d = docs(),
      before = reviewShipping(d);
    d.reverse();
    for (const f of d) {
      f.items.reverse();
      f.containers.reverse();
      f.cargoRecords.reverse();
      f.references.reverse();
    }
    expect(reviewShipping(d)).toEqual(before);
  });
  it("does not arbitrarily match duplicate goods descriptions", () => {
    const d = docs();
    d[0].items.push(structuredClone(d[0].items[0]));
    d[0].items[2].id = "duplicate-description";
    const r = reviewShipping(d);
    expect(
      r.checks.some(
        (c) => c.category === "goods" && c.assessment === "needs_review",
      ),
    ).toBe(true);
    expect(
      r.checks.some(
        (c) =>
          c.title?.includes("Steel Bolts") &&
          c.fields.some((f) => f.documentId === d[0].id) &&
          c.category === "quantity" &&
          c.assessment === "confirmed_match",
      ),
    ).toBe(false);
  });
  it("wrong item row grounding prevents a definitive numeric result", () => {
    const f = normal[0],
      wire = structuredClone(f.wire);
    wire.items[0].fields.quantity = wire.items[1].fields.quantity;
    const bad = groundShipping(wire, f.pdf, "house_bl"),
      d = docs();
    d[0] = bad;
    const c = check(d, "house_bl_declaration", "품목 Steel Bolts 물품 수량");
    expect(c?.assessment).toBe("provisional_mismatch");
  });
  it("an evidence-less number is displayed only as a candidate", () => {
    const f = normal[0],
      wire = structuredClone(f.wire);
    wire.fields.packageCount.evidence = null;
    const d = docs();
    d[0] = groundShipping(wire, f.pdf, "house_bl");
    expect(
      check(d, "house_bl_manifest", "문서 전체 포장 개수")?.assessment,
    ).toBe("provisional_match");
  });
  it("edits recompute results without promoting source provenance; restore returns exact review", () => {
    const d = docs(),
      original = reviewShipping(d);
    d[0].fields.packageCount = editShippingField(d[0].fields.packageCount, 31);
    expect(
      check(d, "house_bl_manifest", "문서 전체 포장 개수")?.assessment,
    ).toBe("provisional_mismatch");
    expect(d[0].fields.packageCount.original.value).toBe(30);
    d[0].fields.packageCount = restoreShippingField(d[0].fields.packageCount);
    expect(reviewShipping(d)).toEqual(original);
  });
  it("strong relationship proof never uses a user-edited reference", () => {
    const d = [docs()[0], docs()[2]];
    for (const doc of d) doc.references = [];
    d[0].fields.houseBlNumber = editShippingField(
      d[0].fields.houseBlNumber,
      "USER-BL",
    );
    expect(reviewShipping(d).relationships?.[0].status).toBe("proposed");
  });
  it("duplicate local item/container IDs remain qualified by source document", () => {
    const d = docs(),
      r = reviewShipping(d);
    expect(d[0].items[0].id).toBe(d[1].items[0].id);
    expect(
      shippingCaseSchema.safeParse({
        documents: d,
        relationships: r.relationships,
      }).success,
    ).toBe(true);
    expect(key32(d[0].id, "item", "item-1")).not.toBe(
      key32(d[1].id, "item", "item-1"),
    );
  });
  it("ambiguous legacy unqualified local IDs are refused in a multi-document relationship", () => {
    const d = docs(),
      r = reviewShipping(d);
    const rel = structuredClone(r.relationships![0]);
    rel.containerIds = ["container-1"];
    expect(
      shippingCaseSchema.safeParse({ documents: d, relationships: [rel] })
        .success,
    ).toBe(false);
  });
  it("can group multiple Manifest cargo rows by HBL without double counting", () => {
    const r = reviewShipping([docs()[0], docs()[2]]),
      c = r.checks.find((c) => c.title === "HBL별 화물행 포장 개수 합계");
    expect(c?.assessment).toBe("confirmed_match");
    expect(c?.computedValues?.[0].value).toBe(30);
    expect(c?.computedValues?.[0].componentKeys).toHaveLength(2);
  });
  it("does not aggregate unaccounted native PDF rows omitted by AI", () => {
    const f = normal[2],
      w = structuredClone(f.wire);
    w.cargoRecords.pop();
    const d = [docs()[0], groundShipping(w, f.pdf, "house_manifest")],
      r = reviewShipping(d);
    expect(d[1].collectionCoverage?.cargoRecords.complete).toBe(false);
    expect(
      r.checks.find((c) => c.title === "HBL별 화물행 포장 개수 합계")
        ?.assessment,
    ).toBe("needs_review");
  });
  it("same-container shared packing prevents row package aggregation", () => {
    const d = docs();
    d[2].cargoRecords[1].fields.containerNumber =
      d[2].cargoRecords[0].fields.containerNumber;
    const r = reviewShipping(d);
    expect(
      r.checks.find((c) => c.title === "HBL별 화물행 포장 개수 합계")
        ?.assessment,
    ).toBe("needs_review");
  });
  it("combined packaging protects aggregate and individual totals", async () => {
    const f = await shipping32Fixture("house_manifest", "mismatch", {
      roots: { shipmentScope: "combined packages" },
    });
    const d = [docs()[0], f.document];
    expect(
      confirmedErrors(d).filter((c) => c.category === "packaging"),
    ).toHaveLength(0);
  });
  it("multiple declarations remain many-to-many and do not sum overlapping scopes", async () => {
    const ed = await shipping32Fixture("export_declaration", "normal", {
        id: "second-declaration",
        declaration: "03000-26-0032002",
        roots: { packageCount: 20 },
      }),
      d = [...docs(), ed.document],
      r = reviewShipping(d);
    expect(
      r.relationships!.filter((x) => x.documentIds.includes(ed.document.id))
        .length,
    ).toBe(2);
    expect(
      r.checks.filter(
        (c) =>
          c.category === "packaging" && c.assessment === "confirmed_mismatch",
      ),
    ).toHaveLength(0);
  });
  it("three documents lacking a three-way strong identity clique do not claim a triangle", async () => {
    const f = await shipping32Fixture("export_declaration", "uncertain"),
      d = docs();
    d[1] = f.document;
    expect(reviewShipping(d).triangleStatus).toBe("not_comparable");
    expect(reviewShipping(d).checks.some((c) => c.scope === "triangle")).toBe(
      false,
    );
  });
  it("one failed/pending document still permits the remaining two types to compare", () => {
    const d = docs();
    d[1].extractionStatus = "not_performed";
    const r = reviewShipping(d);
    expect(r.pairStatus).toBe("performed");
    expect(r.relationships).toHaveLength(1);
    expect(r.triangleStatus).toBe("insufficient_documents");
  });
  it("actual classification takes priority over the selected upload slot", () => {
    const d = docs();
    d[0].uploadType = "house_manifest";
    d[2].uploadType = "house_bl";
    expect(reviewShipping(d)).toEqual(reviewShipping(docs()));
  });
  it("unknown classification never establishes a confirmed relationship", () => {
    const d = docs();
    d[0].classificationStatus = "needs_review";
    expect(
      reviewShipping(d)
        .relationships!.filter((r) => r.documentIds.includes(d[0].id))
        .every((r) => r.status !== "evidence_confirmed"),
    ).toBe(true);
  });
  it("defined mass unit conversion is exact, ambiguous TON is not inferred", () => {
    expect(unit32("KG", "weight")).toEqual({ unit: "KG", factor: 1 });
    expect(unit32("G", "weight")).toEqual({ unit: "KG", factor: 0.001 });
    expect(unit32("MT", "weight")).toEqual({ unit: "KG", factor: 1000 });
    expect(unit32("TON", "weight")).toBeNull();
    expect(unit32("CTNS", "quantity")).toBeNull();
  });
  it("missing counterpart information is not a definitive mismatch", () => {
    const d = docs();
    d[1].fields.packageCount.current.value = null;
    d[1].fields.packageCount.current.status = "user_edited";
    expect(
      check(d, "declaration_manifest", "문서 전체 포장 개수")?.assessment,
    ).toBe("insufficient_information");
  });
  it("a source from another document cannot confer verification", () => {
    const d = docs();
    d[0].fields.packageCount = d[2].fields.packageCount;
    expect(
      check(d, "house_bl_manifest", "문서 전체 포장 개수")?.assessment,
    ).toBe("provisional_match");
  });
  it("zero analyzed documents provide not_performed without invented zero-error success", () => {
    expect(reviewShipping([]).status).toBe("not_performed");
    expect(reviewShipping([]).pairStatus).toBe("not_performed");
  });
});
it("row correspondences distinguish document-to-many-cargo and item/container sources", () => {
  const r = reviewShipping(docs());
  expect(
    r.relationships?.some(
      (r) =>
        r.entityLinks?.filter(
          (e) => e.leftKind === "document" && e.rightKind === "cargo",
        ).length === 2,
    ),
  ).toBe(true);
  expect(
    shippingCaseSchema.safeParse({
      documents: docs(),
      relationships: r.relationships,
    }).success,
  ).toBe(true);
});
it("a separate Manifest item table can supply HS/PCS only for a unique full-scope cargo name", () => {
  const f = normal[2],
    w = structuredClone(f.wire);
  w.items = structuredClone(normal[0].wire.items);
  const d = docs();
  d[2] = groundShipping(w, f.pdf, "house_manifest");
  const r = reviewShipping(d);
  expect(
    r.checks.some(
      (c) =>
        c.scope === "declaration_manifest" &&
        c.title === "품목 Steel Bolts 물품 수량" &&
        c.assessment === "confirmed_match",
    ),
  ).toBe(true);
});
it("explicit user relationship confirmation retains provisional provenance and cannot override verified conflicts", async () => {
  const a = await shipping32Fixture("house_bl", "uncertain"),
    b = await shipping32Fixture("house_manifest", "uncertain"),
    input = [a.document, b.document],
    id = reviewShipping(input).relationships![0].id,
    r = reviewShipping(input, { confirmedRelationships: [id] });
  expect(r.relationships![0].status).toBe("user_confirmed");
  expect(r.summary?.confirmedMismatches).toBe(0);
  expect(
    r.checks
      .filter((c) => ["quantity", "weight", "packaging"].includes(c.category))
      .every((c) => !c.assessment.startsWith("confirmed_")),
  ).toBe(true);
});
it("one HBL can reference different declarations without falsely declaring an identifier conflict", async () => {
  const f = await shipping32Fixture("export_declaration", "normal", {
      declaration: "03000-26-0032002",
      id: "different-declaration",
    }),
    r = reviewShipping([docs()[0], f.document]);
  expect(r.relationships![0].status).toBe("proposed");
  expect(r.relationships![0].conflictRoles).not.toContain("declarationNumber");
  expect(r.checks.find((c) => c.title === "수출신고번호")?.assessment).toBe(
    "needs_review",
  );
});
it("importance remains separate from a provisional mismatch certainty", () => {
  const d = docs();
  d[0].fields.packageCount = editShippingField(d[0].fields.packageCount, 31);
  const c = check(d, "house_bl_manifest", "문서 전체 포장 개수");
  expect(c?.assessment).toBe("provisional_mismatch");
  expect(c?.importance).toBe("high");
  expect(reviewShipping(d).summary?.confirmedMismatches).toBe(0);
});

it("grounds attached numeric units only in the correct physical parent column and owner row", async () => {
  const bytes = unicodePdf([
      [
        { text: "Goods Description", x: 35, y: 50 },
        { text: "Quantity", x: 220, y: 50 },
        { text: "Packages", x: 350, y: 50 },
        { text: "Gross Weight", x: 480, y: 50 },
        { text: "Steel Bolts", x: 35, y: 95 },
        { text: "500PCS", x: 220, y: 95 },
        { text: "20 CTNS", x: 350, y: 95 },
        { text: "320KG", x: 480, y: 95 },
      ],
    ]),
    pdf = {
      id: "attached-native",
      fileName: "synthetic-attached.pdf",
      pages: await extractPdfText(bytes),
    };
  const candidate = (value: string, text: string) => ({
    value,
    evidence: {
      page: 1,
      blockIds: [pdf.pages[0].blocks!.find((b) => b.text === text)!.id],
    },
  });
  const owner = verifyShippingField(
    candidate("Steel Bolts", "Steel Bolts"),
    pdf,
    "goodsDescription",
    "item",
  ).original.source!.layout;
  expect(
    verifyShippingField(
      candidate("PCS", "500PCS"),
      pdf,
      "quantityUnit",
      "item",
      owner,
    ).original.status,
  ).toBe("verified");
  expect(
    verifyShippingField(
      candidate("CTNS", "20 CTNS"),
      pdf,
      "packageUnit",
      "item",
      owner,
    ).original.status,
  ).toBe("verified");
  expect(
    verifyShippingField(
      candidate("KG", "320KG"),
      pdf,
      "grossWeightUnit",
      "item",
      owner,
    ).original.status,
  ).toBe("verified");
  expect(
    verifyShippingField(
      candidate("PCS", "500PCS"),
      pdf,
      "packageUnit",
      "item",
      owner,
    ).original.status,
  ).toBe("unverified");
});
it("refuses a correct weight-unit header on another page even when header row indexes coincide", async () => {
  const page = [
      { text: "Goods Description", x: 35, y: 50 },
      { text: "Gross Weight (KG)", x: 220, y: 50 },
      { text: "Steel Bolts", x: 35, y: 95 },
      { text: "300", x: 220, y: 95 },
    ],
    pdf = {
      id: "two-pages-units",
      fileName: "synthetic-unit-pages.pdf",
      pages: await extractPdfText(unicodePdf([page, page])),
    };
  const c = (value: string, p: number, text: string) => ({
    value,
    evidence: {
      page: p,
      blockIds: [pdf.pages[p - 1].blocks!.find((b) => b.text === text)!.id],
    },
  });
  const owner = verifyShippingField(
    c("Steel Bolts", 2, "Steel Bolts"),
    pdf,
    "goodsDescription",
    "item",
  ).original.source!.layout;
  expect(
    verifyShippingField(
      c("KG", 1, "Gross Weight (KG)"),
      pdf,
      "grossWeightUnit",
      "item",
      owner,
    ).original.status,
  ).toBe("unverified");
  expect(
    verifyShippingField(
      c("KG", 2, "Gross Weight (KG)"),
      pdf,
      "grossWeightUnit",
      "item",
      owner,
    ).original.status,
  ).toBe("verified");
});
it("a unit candidate citing two distinct data rows remains unverified", () => {
  const f = normal[0],
    c = structuredClone(f.wire.items[0].fields.quantityUnit);
  c.evidence!.blockIds.push(
    f.wire.items[1].fields.quantityUnit.evidence!.blockIds[0],
  );
  const d = groundShipping(
    {
      ...f.wire,
      items: [
        { fields: { ...f.wire.items[0].fields, quantityUnit: c } },
        f.wire.items[1],
      ],
    },
    f.pdf,
    "house_bl",
  );
  expect(d.items[0].fields.quantityUnit.original.status).toBe("unverified");
});
it("bilingual summary descriptions and port name/code differences are not definitive commodity/port errors", async () => {
  const f = await shipping32Fixture("house_manifest", "normal", {
      roots: { goodsDescription: "금속 패스너", portOfLoading: "KRPUS" },
    }),
    r = reviewShipping([docs()[0], f.document]);
  expect(
    r.checks.filter(
      (c) =>
        ["port", "goods"].includes(c.category) &&
        c.assessment === "confirmed_mismatch",
    ),
  ).toHaveLength(0);
  expect(
    r.checks.some(
      (c) => c.category === "port" && c.assessment === "provisional_mismatch",
    ),
  ).toBe(true);
});
it("an identity edit cannot remove a blocker and secretly restore definitive quantities", () => {
  const d = docs();
  d[0].fields.shipper = editShippingField(
    d[0].fields.shipper,
    "User Corrected Shipper",
  );
  const r = reviewShipping(d);
  expect(
    r
      .relationships!.filter((r) => r.documentIds.includes(d[0].id))
      .every((r) => r.status !== "evidence_confirmed"),
  ).toBe(true);
});
it("no-partial scope is distinct from a policy prohibiting partial shipments", async () => {
  const { scope32 } = await import("@/modules/shipping/review-evidence");
  const full = await shipping32Fixture("house_bl", "normal", {
      roots: { shipmentScope: "no partial shipment" },
    }),
    policy = await shipping32Fixture("house_bl", "normal", {
      roots: { shipmentScope: "partial shipment not permitted" },
    });
  expect(scope32(full.document)).toBe("full");
  expect(scope32(policy.document)).toBe("unknown");
});
it("deleting an identity field remains a user correction in relationship provenance", () => {
  const d = docs();
  d[0].fields.shipper = editShippingField(d[0].fields.shipper, null);
  expect(
    reviewShipping(d)
      .relationships!.filter((r) => r.documentIds.includes(d[0].id))
      .every((r) => r.status !== "evidence_confirmed"),
  ).toBe(true);
});
