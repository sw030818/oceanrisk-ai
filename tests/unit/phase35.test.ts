import { describe, it, expect } from "vitest";
import { fixture35 } from "../fixtures/shipping35";
import { shipping34Fixture } from "../fixtures/shipping34";
import { resolveHblFact } from "../../src/modules/shipping/facts";
import { reviewShipping } from "../../src/modules/shipping/review";
import { groundShipping } from "../../src/modules/shipping/ground";
import {
  editShippingField,
  restoreShippingField,
} from "../../src/modules/shipping/edit";
import { comparisonGroups } from "../../src/modules/shipping/presentation";
const core = (r: ReturnType<typeof reviewShipping>, meaning: string) =>
  r.primaryChecks?.find(
    (c) =>
      c.comparison?.scope === "hbl_record" && c.comparison.meaning === meaning,
  );
describe("PHASE35 native shipment fact scope and independent verdicts", () => {
  it("a complete native single row maps to HBL cargo without claiming a printed total", async () => {
    const f = await fixture35("house_bl");
    const fact = resolveHblFact(f.document, "grossWeight", [f.document]);
    expect(f.document.fields.grossWeight.original.value).toBeNull();
    expect(fact.value).toBe(640);
    expect(fact.reasons).toEqual([]);
    expect(fact.derivation).toBe("single_native_row");
    expect(fact.scope).toBe("hbl_total");
    expect(fact.refs[0].itemId).toBeTruthy();
    expect(f.document.fields.grossWeight.original.value).toBeNull();
  });
  it("complete HBL row and labelled declaration/manifest totals give a real three-way match without full-contract wording", async () => {
    const a = await fixture35("house_bl"),
      b = await fixture35("export_declaration", {
        totals: { packageCount: 60, grossWeight: 640, quantity: 720 },
      }),
      c = await fixture35("house_manifest", {
        totals: { packageCount: 60, grossWeight: 640, quantity: 720 },
      });
    const docs = [a.document, b.document, c.document],
      r = reviewShipping(docs);
    expect(r.summary?.confirmedRelationships).toBe(3);
    for (const meaning of ["quantity", "grossWeight", "packageCount"]) {
      expect(core(r, meaning)?.assessment).toBe("confirmed_match");
      expect(core(r, meaning)?.scope).toBe("triangle");
    }
    expect(r.outcomes?.mismatches).toBe(0);
    expect(core(r, "grossWeight")?.computedValues?.[0].formula).toBe(
      "single_row",
    );
  });
  it("one changed package fact is one independent mismatch across repeated legacy checks", async () => {
    const a = await shipping34Fixture("house_bl"),
      b = await shipping34Fixture("house_manifest", { packages: 54 });
    const r = reviewShipping([a.document, b.document]);
    expect(core(r, "packageCount")?.assessment).toBe("confirmed_mismatch");
    expect(r.outcomes?.mismatches).toBe(1);
    expect(r.summary!.confirmedMismatches).toBeGreaterThan(1);
    expect(r.checks.length).toBeGreaterThan(r.primaryChecks!.length);
  });
  it("a model array with one selected row cannot prove coverage of two physical rows", async () => {
    const f = await fixture35("house_bl", {
      rows: [
        { name: "SYNTHETIC BOTTLE A", hs: "7323.93-0000", qty: 260 },
        { name: "SYNTHETIC BOTTLE B", hs: "7323.94-0000", qty: 460 },
      ],
      omitRows: [1],
    });
    const fact = resolveHblFact(f.document, "quantity", [f.document]);
    expect(f.document.factCoverage?.items.complete).toBe(false);
    expect(fact.reasons).toContain("AGGREGATION_INCOMPLETE");
  });
  it("all disjoint native product rows can be summed as goods quantity, keeping components", async () => {
    const f = await fixture35("house_bl", {
      rows: [
        { name: "SYNTHETIC BOTTLE A", hs: "7323.93-0000", qty: 260 },
        { name: "SYNTHETIC BOTTLE B", hs: "7323.94-0000", qty: 460 },
      ],
    });
    const fact = resolveHblFact(f.document, "quantity", [f.document]);
    expect(fact.reasons).toEqual([]);
    expect(fact.value).toBe(720);
    expect(fact.derivation).toBe("sum_native_rows");
    expect(fact.componentKeys).toHaveLength(2);
  });
  it("multi-product packaging cannot be added without independent allocation", async () => {
    const f = await fixture35("house_bl", {
      rows: [
        {
          name: "SYNTHETIC BOTTLE A",
          hs: "7323.93-0000",
          qty: 260,
          packages: 40,
        },
        {
          name: "SYNTHETIC BOTTLE B",
          hs: "7323.94-0000",
          qty: 460,
          packages: 40,
        },
      ],
    });
    const fact = resolveHblFact(f.document, "packageCount", [f.document]);
    expect(fact.reasons.length).toBeGreaterThan(0);
    expect(fact.value).toBeNull();
  });
  it("duplicate description rows are not independent cargo for automatic summation", async () => {
    const f = await fixture35("house_bl", {
      rows: [
        { name: "SYNTHETIC SAME ITEM", hs: "7323.93-0000", qty: 260 },
        { name: "SYNTHETIC SAME ITEM", hs: "7323.93-0000", qty: 460 },
      ],
    });
    const fact = resolveHblFact(f.document, "quantity", [f.document]);
    expect(fact.reasons).toContain("DUPLICATE_CARGO");
    expect(fact.value).toBeNull();
  });
  it("independent complete container rows aggregate once", async () => {
    const f = await fixture35("house_bl", {
      rows: [],
      containers: [
        {
          name: "",
          cn: "SYN-CN-35-A",
          seal: "SYN-SEAL-A",
          packages: 20,
          gross: 300,
        },
        {
          name: "",
          cn: "SYN-CN-35-B",
          seal: "SYN-SEAL-B",
          packages: 40,
          gross: 340,
        },
      ],
    });
    const fact = resolveHblFact(f.document, "packageCount", [f.document]);
    expect(fact.reasons).toEqual([]);
    expect(fact.value).toBe(60);
    expect(fact.componentKeys).toHaveLength(2);
  });
  it("duplicate container numbers cannot be summed", async () => {
    const f = await fixture35("house_bl", {
      rows: [],
      containers: [
        {
          name: "",
          cn: "SYN-CN-35-A",
          seal: "SYN-SEAL-A",
          packages: 20,
          gross: 300,
        },
        {
          name: "",
          cn: "SYN-CN-35-A",
          seal: "SYN-SEAL-B",
          packages: 40,
          gross: 340,
        },
      ],
    });
    const fact = resolveHblFact(f.document, "packageCount", [f.document]);
    expect(fact.reasons).toContain("DUPLICATE_CARGO");
    expect(fact.value).toBeNull();
  });
  for (const scope of ["partial shipment", "combined packages"])
    it(scope + " never confirms whole-cargo numbers", async () => {
      const a = await fixture35("house_bl", { scope }),
        b = await fixture35("house_manifest", {
          totals: { packageCount: 60, grossWeight: 640 },
        });
      const r = reviewShipping([a.document, b.document]);
      expect(core(r, "packageCount")?.assessment).not.toBe("confirmed_match");
      expect(core(r, "packageCount")?.comparison?.reasonCodes).toContain(
        scope.startsWith("partial") ? "PARTIAL_SHIPMENT" : "COMBINED_PACKAGES",
      );
    });
  it("a partial table notice is not complete HBL cargo", async () => {
    const f = await fixture35("house_bl", { notice: "Selected items only" });
    expect(
      resolveHblFact(f.document, "quantity", [f.document]).reasons,
    ).toContain("AGGREGATION_INCOMPLETE");
  });
  it("same container is not a strong reference for different HBLs", async () => {
    const a = await shipping34Fixture("house_bl"),
      b = await shipping34Fixture("house_manifest", {
        hbl: "OTHER-HBL",
        packages: 54,
      });
    const r = reviewShipping([a.document, b.document]);
    expect(r.summary?.confirmedRelationships).toBe(0);
    expect(r.outcomes?.mismatches ?? 0).toBe(0);
  });
  it("multiple declaration scopes and duplicate declaration IDs are held", async () => {
    const a = await fixture35("house_bl"),
      b = await fixture35("export_declaration", { id: "ed35-a" }),
      c = await fixture35("export_declaration", { id: "ed35-b" });
    const f = resolveHblFact(b.document, "quantity", [
      a.document,
      b.document,
      c.document,
    ]);
    expect(f.reasons).toContain("DECLARATION_SCOPE_UNRESOLVED");
    const r = reviewShipping([a.document, b.document, c.document]);
    expect(
      r.primaryChecks?.some(
        (c) =>
          c.comparison?.facts.some(
            (f) => f.documentType === "export_declaration",
          ) && c.assessment === "confirmed_match",
      ),
    ).toBe(false);
  });
  it("an optional document-only net weight is not a cross-document warning", async () => {
    const a = await fixture35("house_bl"),
      b = await fixture35("export_declaration");
    const r = reviewShipping([a.document, b.document]);
    expect(core(r, "netWeight")?.assessment).toBe("not_applicable");
    expect(core(r, "netWeight")?.comparison?.reasonCodes).toEqual([
      "FIELD_NOT_APPLICABLE",
    ]);
  });
  it("wrong numeric role/citation cannot become a verified fact", async () => {
    const f = await fixture35("house_bl"),
      wire = structuredClone(f.wire);
    wire.items[0].fields.quantity.evidence =
      wire.items[0].fields.grossWeight.evidence;
    const doc = groundShipping(wire, f.pdf, "house_bl");
    expect(resolveHblFact(doc, "quantity", [doc]).reasons).toContain(
      "EVIDENCE_UNVERIFIED",
    );
  });
  it("user edit stays provisional, restoration and recalculation cost no AI request", async () => {
    const a = await fixture35("house_bl"),
      b = await fixture35("house_manifest", {
        totals: { packageCount: 60, grossWeight: 640 },
      });
    const original = JSON.stringify(
      a.document.items[0].fields.packageCount.original,
    );
    a.document.items[0].fields.packageCount = editShippingField(
      a.document.items[0].fields.packageCount,
      54,
    );
    const r = reviewShipping([a.document, b.document]);
    expect(core(r, "packageCount")?.assessment).toBe("provisional_mismatch");
    expect(core(r, "packageCount")?.comparison?.reasonCodes).toContain(
      "USER_EDITED",
    );
    expect(
      JSON.stringify(a.document.items[0].fields.packageCount.original),
    ).toBe(original);
    a.document.items[0].fields.packageCount = restoreShippingField(
      a.document.items[0].fields.packageCount,
    );
    expect(
      core(reviewShipping([a.document, b.document]), "packageCount")
        ?.assessment,
    ).toBe("confirmed_match");
  });
  it("same snapshots and document/item order yield identical derived results", async () => {
    const a = await fixture35("house_bl", {
        rows: [
          { name: "SYNTHETIC ITEM A", hs: "7323.93-0000", qty: 260 },
          { name: "SYNTHETIC ITEM B", hs: "7323.94-0000", qty: 460 },
        ],
      }),
      b = await fixture35("house_manifest", {
        rows: [],
        totals: { quantity: 720 },
      });
    const r = reviewShipping([a.document, b.document]);
    const reordered = structuredClone(a.document);
    reordered.items.reverse();
    expect(reviewShipping([b.document, reordered])).toEqual(r);
    expect(reviewShipping([a.document, b.document])).toEqual(r);
    expect(
      comparisonGroups(r, [a.document, b.document]).flatMap((g) => g.checks),
    ).toHaveLength(r.checks.length);
  });
  it("old and OCR snapshots cannot invent native row proof", async () => {
    const f = await fixture35("house_bl");
    delete f.document.factCoverage;
    expect(
      resolveHblFact(f.document, "packageCount", [f.document]).reasons,
    ).toContain("AGGREGATION_INCOMPLETE");
    const pages = structuredClone(f.pdf.pages);
    pages[0].textSource = "ocr";
    const doc = groundShipping(f.wire, { ...f.pdf, pages }, "house_bl");
    expect(resolveHblFact(doc, "packageCount", [doc]).reasons).toContain(
      "EVIDENCE_UNVERIFIED",
    );
  });
  it("explicit printed HBL total is preferred and is never a copied row field", async () => {
    const f = await fixture35("house_bl", {
      totals: { quantity: 720, packageCount: 60, grossWeight: 640 },
    });
    const fact = resolveHblFact(f.document, "grossWeight", [f.document]);
    expect(fact.derivation).toBe("literal");
    expect(fact.scope).toBe("document_total");
    expect(fact.alternatives?.[0].derivation).toBe("single_native_row");
    expect(fact.reasons).toEqual([]);
  });
  it("a printed total conflicting with a complete row total is an independent document error", async () => {
    const a = await fixture35("house_bl", { totals: { packageCount: 65 } }),
      b = await fixture35("house_manifest", { totals: { packageCount: 60 } });
    const r = reviewShipping([a.document, b.document]);
    expect(
      resolveHblFact(a.document, "packageCount", [a.document, b.document])
        .reasons,
    ).toContain("SOURCE_CONFLICT");
    expect(
      r.primaryChecks?.some(
        (c) =>
          c.scope === "document" &&
          c.assessment === "confirmed_mismatch" &&
          c.comparison?.reasonCodes.includes("SOURCE_CONFLICT"),
      ),
    ).toBe(true);
    expect(core(r, "packageCount")?.assessment).toBe("provisional_mismatch");
  });
  it("absent mandatory declaration quantity remains required, not inapplicable", async () => {
    const a = await fixture35("house_bl"),
      b = await fixture35("export_declaration", {
        rows: [{ name: "SYNTHETIC ITEM", hs: "7323.93-0000" }],
      });
    const r = reviewShipping([a.document, b.document]);
    expect(
      r.primaryChecks?.some(
        (c) =>
          c.scope === "document" &&
          c.assessment === "insufficient_information" &&
          c.comparison?.meaning === "quantity",
      ),
    ).toBe(true);
  });
  it("stated incompatible goods units are not hidden as optional fields", async () => {
    const a = await fixture35("house_bl"),
      b = await fixture35("house_manifest", {
        rows: [
          {
            name: "SYNTHETIC METAL BOTTLE 600ML",
            hs: "7323.93-0000",
            qty: 720,
            unit: "CTNS",
          },
        ],
      });
    const r = reviewShipping([a.document, b.document]);
    expect(core(r, "quantity")?.assessment).toBe("not_comparable");
    expect(core(r, "quantity")?.comparison?.reasonCodes).toContain(
      "UNIT_INCOMPATIBLE",
    );
  });
  it("a Manifest with two HBLs resolves only explicit disjoint rows for the selected HBL", async () => {
    const f = await fixture35("house_manifest", {
      rows: [],
      cargos: [
        {
          name: "SYNTHETIC ITEM A",
          hbl: "HB-SYN-35-A",
          cn: "SYN-CN-A",
          seal: "SEAL-A",
          packages: 20,
          gross: 300,
        },
        {
          name: "SYNTHETIC ITEM B",
          hbl: "HB-SYN-35-B",
          cn: "SYN-CN-B",
          seal: "SEAL-B",
          packages: 40,
          gross: 340,
        },
      ],
    });
    const fact = resolveHblFact(
      f.document,
      "packageCount",
      [f.document],
      false,
      "hb-syn-35-a",
    );
    expect(fact.reasons).toEqual([]);
    expect(fact.value).toBe(20);
    expect(fact.componentKeys).toHaveLength(1);
    expect(fact.scopeEvidence).toContain("explicit_verified_cargo_hbl");
  });
  it("other HBL cargo sharing the same container blocks packaging aggregation", async () => {
    const f = await fixture35("house_manifest", {
      rows: [],
      cargos: [
        {
          name: "SYNTHETIC ITEM A",
          hbl: "HB-SYN-35-A",
          cn: "SYN-CN-A",
          seal: "SEAL-A",
          packages: 20,
          gross: 300,
        },
        {
          name: "SYNTHETIC ITEM B",
          hbl: "HB-SYN-35-B",
          cn: "SYN-CN-A",
          seal: "SEAL-A",
          packages: 40,
          gross: 340,
        },
      ],
    });
    const fact = resolveHblFact(
      f.document,
      "packageCount",
      [f.document],
      false,
      "hb-syn-35-a",
    );
    expect(fact.reasons.length).toBeGreaterThan(0);
    expect(fact.scope).toBe("unknown");
  });
  it("editing a printed root cannot be ignored in favour of its unchanged item copy", async () => {
    const a = await shipping34Fixture("house_bl"),
      b = await shipping34Fixture("house_manifest");
    a.document.fields.packageCount = editShippingField(
      a.document.fields.packageCount,
      54,
    );
    const r = reviewShipping([a.document, b.document]);
    expect(core(r, "packageCount")?.assessment).toBe("provisional_mismatch");
    expect(
      core(r, "packageCount")?.comparison?.facts.find(
        (f) => f.documentType === "house_bl",
      )?.value,
    ).toBe(54);
  });
  it("editing a child quantity recomputes the effective HBL scope instead of returning a stale printed total", async () => {
    const a = await fixture35("house_bl", { totals: { quantity: 720 } }),
      b = await fixture35("house_manifest", { totals: { quantity: 720 } });
    a.document.items[0].fields.quantity = editShippingField(
      a.document.items[0].fields.quantity,
      734,
    );
    const r = reviewShipping([a.document, b.document]);
    expect(core(r, "quantity")?.assessment).toBe("provisional_mismatch");
    expect(
      core(r, "quantity")?.comparison?.facts.find(
        (f) => f.documentType === "house_bl",
      )?.value,
    ).toBe(734);
  });
  it("a multi-HBL document total stays outside a selected HBL scope rather than becoming an invented difference", async () => {
    const a = await fixture35("house_bl"),
      b = await fixture35("house_manifest", {
        rows: [],
        totals: { quantity: 1440 },
        cargos: [
          {
            name: "SYNTHETIC ITEM A",
            hbl: "HB-SYN-35-A",
            cn: "SYN-CN-A",
            seal: "SEAL-A",
            packages: 20,
            gross: 300,
          },
          {
            name: "SYNTHETIC ITEM B",
            hbl: "HB-SYN-35-B",
            cn: "SYN-CN-B",
            seal: "SEAL-B",
            packages: 40,
            gross: 340,
          },
        ],
      });
    const r = reviewShipping([a.document, b.document]);
    expect(core(r, "quantity")?.assessment).toBe("needs_review");
    expect(core(r, "quantity")?.comparison?.reasonCodes).toContain(
      "SCOPE_UNRESOLVED",
    );
  });
});

describe("literal non-Latin goods cannot become an empty canonical product", () => {
  it("keeps an unalignable goods owner provisional even with equal verified HS", async () => {
    const a = await fixture35("house_bl");
    const b = await fixture35("export_declaration", {
      totals: { quantity: 720, packageCount: 60, grossWeight: 640 },
      rows: [
        {
          name: "금속 용기",
          hs: "7323.93-0000",
          qty: 720,
          packages: 60,
          gross: 640,
        },
      ],
    });
    const r = reviewShipping([a.document, b.document]);
    expect(core(r, "quantity")?.assessment).toBe("confirmed_match");
    for (const meaning of ["goodsDescription", "hsCode"]) {
      expect(core(r, meaning)?.comparison?.reasonCodes).toContain(
        "SCOPE_UNRESOLVED",
      );
      expect(core(r, meaning)?.assessment).not.toBe("confirmed_mismatch");
      expect(core(r, meaning)?.assessment).not.toBe("confirmed_match");
    }
  });
  it("two different non-Latin descriptions are not an exact match through empty strings", async () => {
    const a = await fixture35("house_bl", {
        rows: [{ name: "금속 용기", hs: "7323.93-0000", qty: 720 }],
      }),
      b = await fixture35("house_manifest", {
        rows: [{ name: "유리 용기", hs: "7323.93-0000", qty: 720 }],
      });
    const r = reviewShipping([a.document, b.document]);
    expect(core(r, "goodsDescription")?.assessment).not.toBe("confirmed_match");
    expect(core(r, "hsCode")?.assessment).not.toBe("confirmed_match");
    expect(core(r, "goodsDescription")?.comparison?.reasonCodes).toContain(
      "SCOPE_UNRESOLVED",
    );
  });
});

describe("multiple declarations are subsets of the explicitly listed HBL", () => {
  it("does not report listed declaration numbers or subset goods/HS as definitive errors", async () => {
    const rows = [
      { name: "SYNTHETIC BOTTLE A", hs: "7323.93-0000", qty: 260 },
      { name: "SYNTHETIC BOTTLE B", hs: "7323.94-0000", qty: 460 },
    ];
    const a = await fixture35("house_bl", {
        rows,
        declarationRefs: ["DECL-SYN-35-A", "DECL-SYN-35-B"],
      }),
      b = await fixture35("export_declaration", {
        id: "decl-a",
        declaration: "DECL-SYN-35-A",
        rows: [rows[0]],
      }),
      c = await fixture35("export_declaration", {
        id: "decl-b",
        declaration: "DECL-SYN-35-B",
        rows: [rows[1]],
      });
    const r = reviewShipping([a.document, b.document, c.document]);
    expect(
      r.primaryChecks?.filter((c) => c.assessment === "confirmed_mismatch"),
    ).toEqual([]);
    const membership = r.primaryChecks?.filter(
      (c) => c.title === "명시된 신고 목록 포함 여부",
    );
    expect(membership?.length).toBe(2);
    expect(membership?.every((c) => c.assessment === "confirmed_match")).toBe(
      true,
    );
    expect(
      r.checks.find((c) => c.title === "복수 신고 물품 수량 합계")?.assessment,
    ).toBe("confirmed_match");
    expect(r.checks.length).toBeGreaterThan(0);
  });
  it("an unlisted declaration remains a real conflict", async () => {
    const a = await fixture35("house_bl", {
        declarationRefs: ["DECL-SYN-35-A", "DECL-SYN-35-B"],
      }),
      b = await fixture35("export_declaration", {
        declaration: "DECL-SYN-35-OTHER",
      });
    const r = reviewShipping([a.document, b.document]);
    expect(core(r, "declarationNumber")?.assessment).not.toBe(
      "confirmed_match",
    );
  });
  it("a wide cargo table retains quantity and unit inside the actual page", async () => {
    const f = await fixture35("house_manifest", {
      rows: [],
      containers: [],
      cargos: [
        {
          name: "SYNTHETIC GOODS",
          hbl: "HB-SYN-35-A",
          cn: "SYN-CN",
          seal: "SYN-SEAL",
          packages: 80,
          gross: 820,
          qty: 720,
        },
      ],
    });
    expect(f.pdf.pages[0].width).toBeGreaterThan(842);
    expect(f.document.cargoRecords[0].fields.quantity.original.value).toBe(720);
    expect(f.document.cargoRecords[0].fields.quantityUnit.original.status).toBe(
      "verified",
    );
  });
});
