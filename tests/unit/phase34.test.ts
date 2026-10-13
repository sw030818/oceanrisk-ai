import { describe, it, expect } from "vitest";
import { unicodePdf } from "../fixtures/shipping31";
import { extractPdfText } from "../../src/modules/pdf/extract";
import { shipping34Fixture } from "../fixtures/shipping34";
import { shippingTypes } from "../../src/modules/shipping/catalog";
import { groundShipping } from "../../src/modules/shipping/ground";
import { reviewShipping } from "../../src/modules/shipping/review";
import { verifyShippingField } from "../../src/modules/shipping/verify";
import { portCode, hsSix } from "../../src/modules/shipping/equivalence";
import { unit32 } from "../../src/modules/shipping/review-evidence";
import { editShippingField } from "../../src/modules/shipping/edit";
import { comparisonGroups } from "../../src/modules/shipping/presentation";
import { reserve34 } from "../../scripts/lib/phase34-live";
describe("PHASE 3.4 independent native PDF cells and negative controls", () => {
  for (const type of shippingTypes)
    it("classifies and grounds numbered/split native " + type, async () => {
      const f = await shipping34Fixture(type);
      expect(f.pdf.pages[0].cells?.length).toBeGreaterThan(5);
      expect(f.document.classificationStatus).toBe("classified");
      expect(f.document.fields.grossWeight.original.status).toBe("verified");
      expect(f.document.fields.packageCount.original.status).toBe("verified");
      const row =
        type === "house_manifest"
          ? f.document.cargoRecords[0]
          : f.document.items[0];
      expect(row.fields.goodsDescription.original.status).toBe("verified");
      if (type !== "house_manifest") {
        expect(row.fields.quantity.original.value).toBe(720);
        expect(row.fields.quantity.original.status).toBe("verified");
      }
    });
  for (const title of [
    "Bill of Lading",
    "Master Bill of Lading",
    "Invoice for House B/L services",
  ])
    it("rejects non-House classification " + title, async () => {
      const f = await shipping34Fixture("house_bl", { title, house: false });
      expect(f.document.classificationStatus).toBe("needs_review");
    });
  it("normalizes ports and contextually CT packages without inventing units", async () => {
    const fs = await Promise.all(
      shippingTypes.map((t) => shipping34Fixture(t)),
    );
    const r = reviewShipping(fs.map((f) => f.document));
    expect(r.summary?.confirmedRelationships).toBe(3);
    expect(r.triangleStatus).toBe("performed");
    expect(r.summary?.confirmedMismatches).toBe(0);
    expect(
      r.checks
        .filter((c) => c.title === "문서 전체 포장 개수")
        .every((c) => c.assessment === "confirmed_match"),
    ).toBe(true);
    expect(
      r.checks.some(
        (c) =>
          c.category === "port" &&
          c.title?.includes("UN/LOCODE") &&
          c.assessment === "confirmed_match",
      ),
    ).toBe(true);
    expect(unit32("CT", "packaging")).toBeNull();
    expect(portCode("BUSAN, USA")).toBeNull();
    expect(portCode("XRPUS")).toBeNull();
    expect(hsSix("7010.90-1000")).toBe("701090");
  });
  for (const change of [
    { packages: 54 },
    { weight: 610 },
    { seal: "OTHER-SEAL" },
  ])
    it("detects verified changed field " + Object.keys(change)[0], async () => {
      const a = await shipping34Fixture("house_bl"),
        b = await shipping34Fixture("house_manifest", change),
        r = reviewShipping([a.document, b.document]);
      const category =
        "packages" in change
          ? "packaging"
          : "weight" in change
            ? "weight"
            : "container";
      expect(
        r.checks.some(
          (c) =>
            c.category === category && c.assessment === "confirmed_mismatch",
        ),
      ).toBe(true);
    });
  it("conflicting HBL protects numerical confirmation", async () => {
    const a = await shipping34Fixture("house_bl"),
      b = await shipping34Fixture("house_manifest", {
        hbl: "OTHER-HBL",
        packages: 54,
      });
    const r = reviewShipping([a.document, b.document]);
    expect(r.summary?.confirmedRelationships).toBe(0);
    expect(r.relationships?.[0].status).toBe("conflict");
    expect(
      r.checks.some(
        (c) =>
          c.category === "packaging" && c.assessment === "confirmed_mismatch",
      ),
    ).toBe(false);
  });
  it("partial scope remains provisional", async () => {
    const a = await shipping34Fixture("house_bl"),
      b = await shipping34Fixture("house_manifest", {
        partial: true,
        packages: 54,
      });
    const r = reviewShipping([a.document, b.document]);
    expect(
      r.checks.some(
        (c) =>
          c.category === "packaging" && c.assessment === "confirmed_mismatch",
      ),
    ).toBe(false);
    expect(r.checks.some((c) => c.assessment === "provisional_mismatch")).toBe(
      true,
    );
  });
  it("item quantity cannot cite another column or a document total", async () => {
    const f = await shipping34Fixture("export_declaration");
    const w = structuredClone(f.wire);
    w.items[0].fields.quantity.evidence = w.fields.quantity.evidence;
    const d = groundShipping(w, f.pdf, "export_declaration");
    expect(d.items[0].fields.quantity.original.status).toBe("unverified");
    w.items[0].fields.quantity = {
      value: 640,
      evidence: w.fields.grossWeight.evidence,
    };
    expect(
      groundShipping(w, f.pdf, "export_declaration").items[0].fields.quantity
        .original.status,
    ).toBe("unverified");
  });
  it("rejects absent block and opposite weight/unit roles", async () => {
    const f = await shipping34Fixture("house_bl");
    expect(
      verifyShippingField(
        { value: 640, evidence: { page: 1, blockIds: ["not-a-block"] } },
        f.pdf,
        "grossWeight",
      ).original.status,
    ).toBe("unverified");
    expect(
      verifyShippingField(f.wire.fields.grossWeight, f.pdf, "netWeight")
        .original.status,
    ).toBe("unverified");
    expect(
      verifyShippingField(f.wire.fields.packageUnit, f.pdf, "quantityUnit")
        .original.status,
    ).toBe("unverified");
  });
  it("wrong page unit cannot inherit an owner", async () => {
    const f = await shipping34Fixture("house_bl");
    const candidate = structuredClone(f.wire.items[0].fields.quantityUnit);
    candidate.evidence!.page = 2;
    expect(
      verifyShippingField(
        candidate,
        f.pdf,
        "quantityUnit",
        "item",
        f.document.items[0].fields.goodsDescription.original.source!.layout,
      ).original.status,
    ).toBe("unverified");
  });
  it("invented slash in bilingual value is not literal evidence", async () => {
    const f = await shipping34Fixture("export_declaration");
    const w = structuredClone(f.wire);
    w.items[0].fields.goodsDescription.value =
      "유리 보관 용기 / GLASS STORAGE JARS";
    expect(
      groundShipping(w, f.pdf, "export_declaration").items[0].fields
        .goodsDescription.original.status,
    ).toBe("unverified");
  });
  it("grouping preserves all checks and user edits recalculate provisionally", async () => {
    const a = await shipping34Fixture("house_bl"),
      b = await shipping34Fixture("house_manifest"),
      d = await shipping34Fixture("export_declaration");
    const r = reviewShipping([a.document, b.document, d.document]);
    const groups = comparisonGroups(r, [a.document, b.document, d.document]);
    expect(groups.flatMap((g) => g.checks)).toHaveLength(r.checks.length);
    expect(groups.length).toBeLessThan(r.checks.length);
    a.document.fields.packageCount = editShippingField(
      a.document.fields.packageCount,
      54,
    );
    const edited = reviewShipping([a.document, b.document]);
    expect(
      edited.checks.some((c) => c.assessment === "provisional_mismatch"),
    ).toBe(true);
    expect(a.document.fields.packageCount.original.status).toBe("verified");
  });
  it("new phase budget cannot exceed dollars or discard unresolved usage", () => {
    const b = {
      documents: 1,
      requests: 1,
      maxDocuments: 30,
      maxRequests: 40,
      maxCostUsd: 0.15,
      measuredCostUsd: 0.01,
      unresolvedCostUpperUsd: 0.13,
    };
    expect(() => reserve34(b, [0.02], 1)).toThrow("PHASE34_BUDGET_STOP");
    expect(b.documents).toBe(1);
  });
  it("native reported totals can compare without inventing full fulfillment", async () => {
    const fs = await Promise.all(
      shippingTypes.map((t) => shipping34Fixture(t)),
    );
    for (const f of fs) {
      f.wire.fields.shipmentScope = { value: null, evidence: null };
      f.document = groundShipping(f.wire, f.pdf, f.wire.type as "house_bl");
    }
    const r = reviewShipping(fs.map((f) => f.document));
    expect(r.relationships?.every((r) => r.scope === "unknown")).toBe(true);
    expect(
      r.checks
        .filter((c) => c.title === "문서 전체 총중량")
        .every((c) => c.assessment === "confirmed_match"),
    ).toBe(true);
    expect(
      r.checks.some((c) =>
        c.explanation.includes("전체 계약 이행/전량 선적을 입증하지 않습니다"),
      ),
    ).toBe(true);
  });
  it("native partial wording cannot be removed by an AI omission", async () => {
    const a = await shipping34Fixture("house_bl"),
      b = await shipping34Fixture("house_manifest", {
        partial: true,
        packages: 54,
      });
    b.wire.fields.shipmentScope = { value: null, evidence: null };
    b.document = groundShipping(b.wire, b.pdf, "house_manifest");
    const r = reviewShipping([a.document, b.document]);
    expect(b.document.nativeScopeLimitation).toBe("partial");
    expect(
      r.checks.some(
        (c) =>
          c.category === "packaging" && c.assessment === "confirmed_mismatch",
      ),
    ).toBe(false);
  });
  it("closed-cell tables reject a citation from another product row", async () => {
    const cells = [
      { text: "Description", x: 65, y: 118 },
      { text: "QTY", x: 235, y: 118 },
      { text: "Synthetic A", x: 60, y: 148 },
      { text: "500 PCS", x: 225, y: 148 },
      { text: "Synthetic B", x: 60, y: 188 },
      { text: "480 PCS", x: 225, y: 188 },
    ];
    const borders = [100, 130, 170].flatMap((y, i) => [
      { x: 50, y, width: 160, height: i ? 40 : 30 },
      { x: 210, y, width: 100, height: i ? 40 : 30 },
    ]);
    const bytes = unicodePdf([cells], { borders: [borders] });
    const pdf = {
      id: "wrong-row-native",
      fileName: "independent-native.pdf",
      pages: await extractPdfText(bytes, undefined, false, true),
    };
    const cite = (text: string) => ({
      page: 1,
      blockIds: [pdf.pages[0].blocks!.find((b) => b.text === text)!.id],
    });
    const owner = verifyShippingField(
      { value: "Synthetic A", evidence: cite("Synthetic A") },
      pdf,
      "goodsDescription",
      "item",
    ).original.source?.layout;
    expect(owner).toBeDefined();
    expect(
      verifyShippingField(
        { value: 480, evidence: cite("480 PCS") },
        pdf,
        "quantity",
        "item",
        owner,
      ).original.status,
    ).toBe("unverified");
    expect(
      verifyShippingField(
        { value: 500, evidence: cite("500 PCS") },
        pdf,
        "quantity",
        "item",
        owner,
      ).original.status,
    ).toBe("verified");
  });
  it("mixed total cell links each number to its own literal count unit", async () => {
    const bytes = unicodePdf(
      [
        [
          { text: "Total Packages", x: 35, y: 112 },
          { text: "60 CTN / 720 PCS", x: 35, y: 138 },
        ],
      ],
      { borders: [[{ x: 30, y: 100, width: 210, height: 60 }]] },
    );
    const pdf = {
      id: "mixed-total-native",
      fileName: "independent-mixed.pdf",
      pages: await extractPdfText(bytes, undefined, false, true),
    };
    const evidence = {
      page: 1,
      blockIds: [
        pdf.pages[0].blocks!.find((b) => b.text === "60 CTN / 720 PCS")!.id,
      ],
    };
    expect(
      verifyShippingField({ value: 60, evidence }, pdf, "packageCount").original
        .status,
    ).toBe("verified");
    expect(
      verifyShippingField({ value: 720, evidence }, pdf, "quantity").original
        .status,
    ).toBe("verified");
    expect(
      verifyShippingField({ value: "PCS", evidence }, pdf, "quantityUnit")
        .original.status,
    ).toBe("verified");
    expect(
      verifyShippingField({ value: 60, evidence }, pdf, "quantity").original
        .status,
    ).toBe("unverified");
    expect(
      verifyShippingField({ value: "CTN", evidence }, pdf, "quantityUnit")
        .original.status,
    ).toBe("unverified");
  });
});
