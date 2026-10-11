import { describe, expect, it } from "vitest";
import { layoutCases, layoutFixture } from "../fixtures/layouts";
import { groundDocument, verifyField } from "@/modules/evidence/verify";
import { compareQuantities } from "@/modules/rules/quantity";
import { parseUploadSlots } from "@/modules/upload/slots";
describe("actual PDF geometry with synthetic AI extractions, not live Gemini", () => {
  it.each(layoutCases)(
    "$id: grounds varied role labels/cells/rows and runs conservative comparisons",
    async (scenario) => {
      const fixtures = await Promise.all([
        layoutFixture(scenario.id, "invoice"),
        layoutFixture(scenario.id, "packing_list"),
      ]);
      const docs = fixtures.map((f) => groundDocument(f.data, f.pdf));
      for (const [i, doc] of docs.entries()) {
        expect(doc.seller.status).toBe("verified");
        expect(doc.buyer.status).toBe("verified");
        expect(doc.documentNumber.status).toBe("verified");
        expect(doc.partialShipment.status).toBe("verified");
        expect(doc.transactionReference.status).toBe(
          scenario.id === "missing-reference" && i === 1
            ? "missing"
            : "verified",
        );
        for (const item of doc.items) {
          expect(item.description.status).toBe("verified");
          expect(item.quantity.status).toBe("verified");
          expect(item.unit.status).toBe("verified");
        }
      }
      const checks = compareQuantities(docs);
      if (scenario.id === "reference-conflict")
        expect(checks[0].id).toBe("conflicting-identifiers");
      else {
        expect(checks).toHaveLength(2);
        expect(checks[0].status).toBe(scenario.outcome);
      }
      if (scenario.id === "missing-reference")
        expect(checks.every((c) => c.confidence === "candidate")).toBe(true);
      expect(
        fixtures[0].pdf.pages[0].blocks!.every(
          (b) => Number.isFinite(b.x) && Number.isFinite(b.y) && b.height > 0,
        ),
      ).toBe(true);
    },
  );
  it("rejects nonexistent quotes, block IDs and fabricated assembled quotes", async () => {
    const f = await layoutFixture("party-tables", "invoice");
    for (const mutation of ["quote", "id", "assembled"]) {
      const data = structuredClone(f.data);
      if (mutation === "quote")
        data.seller.evidence!.segments![1].quote = "Invented company";
      if (mutation === "id")
        data.seller.evidence!.segments![1].blockId = "p1-b999999";
      if (mutation === "assembled")
        data.seller.evidence!.quote += " fabricated";
      expect(groundDocument(data, f.pdf).seller.status).toBe("unverified");
    }
  });
  it("rejects swapped seller/buyer values despite both companies appearing on the page", async () => {
    const f = await layoutFixture("party-tables", "invoice");
    const data = structuredClone(f.data);
    [data.seller, data.buyer] = [data.buyer, data.seller];
    expect(groundDocument(data, f.pdf).seller.status).toBe("unverified");
    expect(groundDocument(data, f.pdf).buyer.status).toBe("unverified");
  });
  it("rejects quantity from the CTNS column even if the AI labels it product quantity", async () => {
    const f = await layoutFixture("mixed-packaging", "invoice");
    const data = structuredClone(f.data);
    const block = f.pdf.pages[0].blocks!.find((b) => b.text === "20")!;
    data.items[0].quantity = {
      value: 20,
      evidence: {
        page: 1,
        quote: block.text,
        segments: [{ blockId: block.id, quote: block.text }],
      },
    };
    expect(groundDocument(data, f.pdf).items[0].quantity.status).toBe(
      "unverified",
    );
  });
  it("rejects another product row or unit cell mixed into the first item", async () => {
    const f = await layoutFixture("party-tables", "invoice");
    for (const key of ["quantity", "unit", "description"] as const) {
      const data = structuredClone(f.data);
      data.items[0][key] = data.items[1][key] as never;
      expect(groundDocument(data, f.pdf).items[0].quantity.status).toBe(
        "unverified",
      );
    }
  });
  it("does not select an ambiguous repeated cell without block IDs", async () => {
    const f = await layoutFixture("mixed-packaging", "invoice");
    const value = verifyField(
      { value: 20, evidence: { page: 1, quote: "20" } },
      f.pdf,
      "quantity",
    );
    expect(value.status).toBe("unverified");
  });
  it("blocks a conflicting Invoice reference even with matching purchase orders", async () => {
    const a = await layoutFixture("party-tables", "invoice"),
      b = await layoutFixture("party-tables", "packing_list");
    const docs = [groundDocument(a.data, a.pdf), groundDocument(b.data, b.pdf)];
    docs[1].invoiceReference = {
      ...docs[1].invoiceReference!,
      value: "INV-OTHER",
    };
    expect(compareQuantities(docs)[0].id).toBe("conflicting-identifiers");
  });
  it("supports legacy requests without slots but validates metadata independently", () => {
    expect(parseUploadSlots(null, 2)).toBeUndefined();
    expect(parseUploadSlots('["packing_list","invoice"]', 2)).toEqual([
      "packing_list",
      "invoice",
    ]);
    for (const raw of ['["invoice"]', '["other","invoice"]', "{}", "bad"])
      expect(() => parseUploadSlots(raw, 2)).toThrow();
  });
});
describe("legacy literal quotes across adjacent native blocks", () => {
  it("grounds a split Purchase Order label/value without requiring model block IDs", async () => {
    const f = await layoutFixture("portrait-landscape", "invoice");
    const data = structuredClone(f.data);
    delete data.transactionReference.evidence!.segments;
    expect(groundDocument(data, f.pdf).transactionReference.status).toBe(
      "verified",
    );
  });
  it("does not invent a quote across noncontiguous party blocks", async () => {
    const f = await layoutFixture("party-tables", "invoice");
    const data = structuredClone(f.data);
    delete data.seller.evidence!.segments;
    expect(groundDocument(data, f.pdf).seller.status).toBe("unverified");
  });
});

describe("typed references identify the same transaction without mixing namespaces", () => {
  it("does not treat a verified PO and Invoice number as conflicting when typed shared references match", async () => {
    const a = await layoutFixture("party-tables", "invoice"),
      b = await layoutFixture("party-tables", "packing_list");
    const data = structuredClone(b.data);
    data.transactionReference = data.invoiceReference!;
    const docs = [groundDocument(a.data, a.pdf), groundDocument(data, b.pdf)];
    expect(
      compareQuantities(docs).every(
        (c) => c.status === "match" && c.confidence === "confirmed",
      ),
    ).toBe(true);
    docs[1].invoiceReference!.value = "INV-CONFLICT";
    expect(compareQuantities(docs)[0].id).toBe("conflicting-identifiers");
  });
});

describe("additional conservative identity and header provenance", () => {
  it("never re-verifies full shipment with a fabricated block ID", async () => {
    const f = await layoutFixture("party-tables", "invoice");
    const data = structuredClone(f.data);
    data.partialShipment.evidence!.segments = [
      { blockId: "p1-b999999", quote: data.partialShipment.evidence!.quote },
    ];
    expect(groundDocument(data, f.pdf).partialShipment.status).toBe(
      "unverified",
    );
  });
  it("does not reinterpret an invoice label as a purchase order", async () => {
    const f = await layoutFixture("party-tables", "invoice");
    const data = structuredClone(f.data);
    data.purchaseOrder = data.documentNumber;
    expect(groundDocument(data, f.pdf).purchaseOrder!.status).toBe(
      "unverified",
    );
  });
  it("does not confirm using user-edited supplementary identifiers", async () => {
    const a = await layoutFixture("party-tables", "invoice"),
      b = await layoutFixture("party-tables", "packing_list");
    const docs = [groundDocument(a.data, a.pdf), groundDocument(b.data, b.pdf)];
    docs[0].purchaseOrder!.status = "user_edited";
    expect(compareQuantities(docs)[0].id).toBe("edited-identifiers");
  });
});
