import { describe, it, expect } from "vitest";
import {
  compareGoods,
  goodsMeaning,
} from "../../src/modules/shipping/goods-semantics";
import {
  goodsCore,
  goodsEquivalent,
  portCode,
} from "../../src/modules/shipping/equivalence";
import { shippingRole } from "../../src/modules/shipping/roles";
import { shippingStructure } from "../../src/modules/shipping/document-structure";
import { development37 } from "../fixtures/phase37/development";
import { scenario37 } from "../fixtures/phase37/cases";
import { recoverNative } from "../../src/modules/shipping/recovery";
import { reviewShipping } from "../../src/modules/shipping/review";
import { measure37 } from "../../scripts/lib/phase37-metrics";
import { reviewIssues } from "../../src/modules/shipping/issues";
import { reserve37, policy37 } from "../../scripts/lib/phase37-live";
import { reconcileTestBudget } from "../../scripts/lib/openai-budget";
import { fixture35 } from "../fixtures/shipping35";
describe("PHASE37 semantic attributes preserve unsupported language and hard conflicts", () => {
  it.each(development37.slice(0, 10))("bilingual product $id", (s) => {
    expect(compareGoods(s.product.en, s.product.ko).status).toBe("semantic");
    expect(goodsCore(s.product.en)).toBe(goodsCore(s.product.ko));
  });
  it.each([
    ["COTTON T SHIRT MODEL TX7", "면 티셔츠 모델 TX9"],
    ["GLASS STORAGE JAR 1000ML", "유리 저장 용기 750ML"],
    ["CERAMIC DINNER PLATE 25CM", "도자기 머그컵 25CM"],
    ["PLASTIC STORAGE BOX 20L", "종이 수납 상자 20L"],
    ["RUBBER SAFETY GLOVES SIZE XL", "고무 안전 장갑 사이즈 M"],
  ])("does not erase conflicting model/material/specification %s", (a, b) =>
    expect(compareGoods(a, b).status).toBe("different"),
  );
  it("retains unknown Hangul and does not infer a translation from HS", () => {
    expect(goodsCore("금속 용기")).toBe("금속 용기");
    expect(goodsCore("금속 용기")).not.toBe(goodsCore("고무 부품"));
    expect(compareGoods("금속 용기", "GLASS JARS").status).toBe("insufficient");
    expect(goodsMeaning("기타 모델 특수품").residual).not.toBe("");
  });
  it("preserves alphabetic parenthetical model and size conflicts", () => {
    expect(
      goodsEquivalent("RUBBER GLOVES (SIZE XL)", "RUBBER GLOVES (SIZE M)"),
    ).toBe("different");
    expect(
      goodsEquivalent(
        "COTTON T SHIRT (MODEL TX7)",
        "COTTON T SHIRT (MODEL TX9)",
      ),
    ).toBe("different");
  });
  it("keeps missing qualifiers provisional", () =>
    expect(compareGoods("COTTON T SHIRT MODEL TX7", "면 티셔츠").status).toBe(
      "partial",
    ));
  it.each([
    ["House B/L No / 하우스 B/L 번호", "houseBlNumber"],
    ["QTY / 수량", "quantity"],
    ["Total Gross Weight / 총중량", "totalGrossWeight"],
    ["Packages / 수량", null],
    ["Gross Weight / 순중량", null],
  ])("bilingual role %s", (label, role) =>
    expect(shippingRole(label!)).toBe(role),
  );
  it.each([
    ["Rotterdam, Netherlands", "NLRTM"],
    ["Tokyo", "JPTYO"],
    ["BUSAN", "KRPUS"],
    ["Busan China", null],
    ["Victoria", null],
    ["DEHAM", "DEHAM"],
    ["USXYZ", "USXYZ"],
  ])("exact port provenance %s", (value, code) =>
    expect(portCode(value)).toBe(code),
  );
});
describe("PHASE37 independent generated PDF development regression (oracle candidates, NOT live AI)", () => {
  for (const s of development37)
    it(`${s.id}: ${s.kind} ${s.error ?? s.variant ?? s.layout}`, async () => {
      const { fixtures } = await scenario37(s),
        docs = fixtures.map((f) => recoverNative(f.document, f.pdf)),
        m = measure37(s, docs);
      expect(m.confirmedFalsePositives).toEqual([]);
      expect(m.relationshipFP).toBe(0);
      if (s.error) expect(m.faultDetected).toBe(true);
      if (m.confirmedFaultDetected !== null)
        expect(m.confirmedFaultDetected).toBe(true);
      if (s.kind === "normal") {
        expect(m.provisional).toBe(0);
        expect(m.confirmedErrors).toEqual([]);
      }
      if (s.error === "goodsDescription")
        expect(
          reviewShipping(docs)
            .primaryChecks?.filter((c) => c.comparison?.meaning === "hsCode")
            .every((c) => c.assessment !== "confirmed_mismatch"),
        ).toBe(true);
      if (s.variant === "multi-declaration")
        expect(m.aggregation[0]).toEqual({
          assessment: "confirmed_match",
          derived: 2,
        });
      if (s.variant === "split-item")
        expect(m.aggregation[0].assessment).toBe("needs_review");
      if (s.variant === "partial") expect(m.confirmedErrors).toEqual([]);
      if (s.variant === "multi-container")
        expect(docs.every((d) => d.containers.length === 2)).toBe(true);
      if (s.variant === "unsupported")
        expect(docs.at(-1)?.classificationStatus).not.toBe("classified");
      for (const f of fixtures) {
        const structure = shippingStructure(f.pdf);
        expect(structure.map((p) => p.page)).toEqual(
          f.pdf.pages.map((p) => p.page),
        );
        for (const p of structure)
          for (const row of p.nativeRows)
            for (const c of row.cells)
              expect(
                f.pdf.pages
                  .find((x) => x.page === p.page)
                  ?.blocks?.some((b) => b.id === c.blockId),
              ).toBe(true);
      }
    }, 10000);
  it("recovers a printed missing declaration HBL without overwriting the initial AI extraction", async () => {
    const f = await fixture35("export_declaration");
    f.document.references = f.document.references.filter(
      (r) => r.kind !== "house_bl",
    );
    f.document.additionalFields = f.document.additionalFields.filter(
      (x) => x.meaning !== "houseBlNumber",
    );
    delete f.document.fields.houseBlNumber;
    const doc = recoverNative(f.document, f.pdf),
      field = doc.additionalFields.find(
        (x) => x.meaning === "houseBlNumber",
      )?.field;
    expect(field?.original.value).toBeNull();
    expect(field?.current.status).toBe("verified");
    expect(field?.recovery?.method).toBe("native");
  });
  it("groups exact repeated cause checks but keeps separate quantities and shipments", async () => {
    const { fixtures } = await scenario37(development37[10]);
    const r = reviewShipping(
      fixtures.map((f) => recoverNative(f.document, f.pdf)),
    );
    const c = r.primaryChecks!.find(
      (c) => c.assessment === "confirmed_mismatch",
    )!;
    const repeated = {
      ...c,
      id: c.id + "-related",
      scope: "triangle" as const,
    };
    const independent = {
      ...c,
      id: c.id + "-other-shipment",
      comparison: { ...c.comparison!, hbl: "another-shipment" },
    };
    const issues = reviewIssues({
      ...r,
      primaryChecks: [c, repeated, independent],
    });
    expect(issues).toHaveLength(2);
    expect(
      issues.some(
        (i) =>
          i.relatedCheckIds.includes(c.id) &&
          i.relatedCheckIds.includes(repeated.id),
      ),
    ).toBe(true);
  });
});
describe("PHASE37 separate non-resetting paid budget", () => {
  const fresh = () => ({
    documents: 0,
    requests: 0,
    measuredCostUsd: 0,
    unresolvedCostUpperUsd: 0,
    maxDocuments: 120,
    maxRequests: 150,
    maxCostUsd: 0.5,
  });
  it("has independent archive/ledger limits", () => {
    expect(policy37.directory).toBe("test-results/live-phase37");
    expect(policy37.evidenceRef).toBe("refs/heads/validation/phase37-evidence");
  });
  it.each(["documents", "requests", "cost"])("stops at %s cap", (cap) => {
    const b = fresh();
    if (cap === "documents") b.documents = 120;
    if (cap === "requests") b.requests = 150;
    if (cap === "cost") b.measuredCostUsd = 0.5;
    expect(() => reserve37(b, [0.001], 1)).toThrow("PHASE37_BUDGET_STOP");
  });
  it("retains unknown usage and counts failed attempts", () => {
    const b = fresh();
    reserve37(b, [0.02], 1);
    reconcileTestBudget(b, 0.02, null);
    expect(b.documents).toBe(1);
    expect(b.requests).toBe(1);
    expect(b.unresolvedCostUpperUsd).toBe(0.02);
  });
});
