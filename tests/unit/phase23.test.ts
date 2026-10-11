import { describe, it, expect } from "vitest";
import { phase23Fixture } from "../fixtures/phase23";
import { reviewDocuments } from "@/modules/rules/review";
import { compareQuantities } from "@/modules/rules/quantity";
import {
  groundDocument,
  editField,
  verifyField,
} from "@/modules/evidence/verify";
import { syntheticDocument } from "../fixtures/synthetic";
const pair = async (options: Parameters<typeof phase23Fixture>[1] = {}) => [
  await phase23Fixture("invoice"),
  await phase23Fixture("packing_list", options),
];
describe("PHASE 2.3 reported structure: actual synthetic PDFs, MOCKED extraction", () => {
  it("never validates a document total or cropped total qualifier as an individual product quantity", () => {
    const f = syntheticDocument();
    f.pdf.pages[0].text += "\nTotal product quantity: 1000 PCS";
    for (const quote of [
      "Total product quantity: 1000 PCS",
      "quantity: 1000 PCS",
    ])
      expect(
        verifyField(
          { value: 1000, evidence: { page: 1, quote } },
          f.pdf,
          "quantity",
        ).status,
      ).toBe("unverified");
  });
  it("never validates a literal unit from a wrong semantic label", () => {
    const f = syntheticDocument();
    f.pdf.pages[0].text += "\nPackage Unit: KG\nSeller: PCS Trading";
    expect(
      verifyField(
        { value: "KG", evidence: { page: 1, quote: "Package Unit: KG" } },
        f.pdf,
        "weightUnit",
      ).status,
    ).toBe("unverified");
    expect(
      verifyField(
        { value: "PCS", evidence: { page: 1, quote: "Seller: PCS Trading" } },
        f.pdf,
        "unit",
      ).status,
    ).toBe("unverified");
    expect(
      verifyField(f.data.items[0].weightUnit, f.pdf, "weightUnit").status,
    ).toBe("verified");
  });
  it("does not use a product QTY cell as a document total amount or subtotal", async () => {
    const f = await phase23Fixture("invoice"),
      d = structuredClone(f.data);
    d.totalAmount = d.items[0].quantity;
    d.subtotalAmount = d.items[0].quantity;
    const g = groundDocument(d, f.pdf);
    expect(g.totalAmount.status).toBe("unverified");
    expect(g.subtotalAmount?.status).toBe("unverified");
  });
  it("rejects unit citations assembled from different rows even when both spell PCS", async () => {
    const f = await phase23Fixture("invoice"),
      d = structuredClone(f.data);
    const a = d.items[0].unit.evidence!,
      b = d.items[1].unit.evidence!;
    d.items[0].unit.evidence = {
      page: 1,
      quote: a.quote + "\n" + b.quote,
      segments: [...a.segments!, ...b.segments!],
    };
    expect(groundDocument(d, f.pdf).items[0].unit.status).toBe("unverified");
  });
  it("retains backorder/allowed delivery qualifications instead of confirming a full-shipment difference", () => {
    const f = syntheticDocument("invoice");
    f.pdf.pages[0].text += "\nBackorder: 40 PCS";
    expect(groundDocument(f.data, f.pdf).partialShipment.status).toBe(
      "unverified",
    );
    f.pdf.pages[0].text = f.pdf.pages[0].text.replace(
      "Backorder: 40 PCS",
      "No backorder",
    );
    expect(groundDocument(f.data, f.pdf).partialShipment.status).toBe(
      "verified",
    );
  });
  it("grounds split QTY/PCS, adjacent 400PCS, wrapped descriptions, labelled PO/Invoice and weight cells", async () => {
    const fixtures = await pair();
    for (const f of fixtures) {
      expect(f.document.seller.status).toBe("verified");
      expect(f.document.documentNumber.status).toBe("verified");
      expect(f.document.purchaseOrder?.status).toBe("verified");
      for (const item of f.document.items) {
        for (const key of [
          "description",
          "quantity",
          "unit",
          "netWeight",
          "grossWeight",
          "weightUnit",
          "sku",
          "packageQuantity",
          "packageUnit",
        ] as const)
          expect(item[key]?.status, `${f.data.type}:${key}`).toBe("verified");
      }
    }
    const review = reviewDocuments(fixtures.map((f) => f.document));
    expect(review.summary.comparedItems).toBe(2);
    expect(review.summary.confirmedQuantityMatches).toBe(2);
    expect(review.summary.referenceWarning).toBe(false);
    expect(
      review.checks.find((c) => c.id === "reference-invoiceReference")
        ?.assessment,
    ).toBe("confirmed_match");
    expect(
      review.checks.find((c) => c.id === "reference-purchaseOrder")?.assessment,
    ).toBe("confirmed_match");
  });
  it("finds verified 600/580 mismatch, not a 20 CTNS product quantity", async () => {
    const f = await pair({ mismatch: true });
    const q = compareQuantities(f.map((f) => f.document));
    expect(q[0].assessment).toBe("confirmed_mismatch");
    expect(q[0].invoiceQuantity).toBe(600);
    expect(q[0].packingQuantity).toBe(580);
    expect(q[1].assessment).toBe("confirmed_match");
    const d = structuredClone(f[1].data);
    d.items[0].quantity = d.items[0].packageQuantity!;
    expect(groundDocument(d, f[1].pdf).items[0].quantity.status).toBe(
      "unverified",
    );
  });
  it("keeps comparing two items with missing references and separates insufficient references", async () => {
    const f = await pair({ missingReference: true });
    const r = reviewDocuments(f.map((f) => f.document));
    expect(r.summary.comparedItems).toBe(2);
    expect(
      r.quantityChecks.every((c) => c.assessment === "provisional_match"),
    ).toBe(true);
    expect(
      r.checks.some(
        (c) =>
          c.category === "reference" &&
          c.assessment === "insufficient_information",
      ),
    ).toBe(true);
    expect(r.summary.confirmedQuantityMismatches).toBe(0);
  });
  it("never compares PO directly to Invoice namespace and never compares own PL number", async () => {
    const f = await pair();
    expect(f[0].data.transactionReference.value).not.toBe(
      f[1].data.transactionReference.value,
    );
    const r = reviewDocuments(f.map((f) => f.document));
    expect(r.summary.referenceWarning).toBe(false);
    expect(
      r.quantityChecks.every((c) => c.assessment === "confirmed_match"),
    ).toBe(true);
    f[1].document.documentNumber.value = "PL-ANOTHER-OWN-NUMBER";
    expect(
      reviewDocuments(f.map((f) => f.document)).summary.referenceWarning,
    ).toBe(false);
  });
  it("warns for actual PO collision while preserving provisional quantities and independent party matches", async () => {
    const f = await pair({ conflictingPO: true, mismatch: true });
    const r = reviewDocuments(f.map((f) => f.document));
    expect(r.summary.referenceWarning).toBe(true);
    expect(r.quantityChecks[0].assessment).toBe("provisional_mismatch");
    expect(r.summary.comparedItems).toBe(2);
    expect(r.summary.confirmedQuantityMismatches).toBe(0);
    expect(r.checks.find((c) => c.id === "party-seller")?.assessment).toBe(
      "confirmed_match",
    );
  });
  it("matches reordered rows by names / explicit SKU, never array order", async () => {
    const f = await pair({ reorder: true });
    expect(
      compareQuantities(f.map((f) => f.document)).map((c) => c.assessment),
    ).toEqual(["confirmed_match", "confirmed_match"]);
  });
  it("does not arbitrarily pair duplicate descriptions without unique SKU", async () => {
    const f = await pair();
    for (const item of f[0].document.items) {
      item.description = f[0].document.items[0].description;
      item.sku = undefined;
    }
    for (const item of f[1].document.items) {
      item.description = f[0].document.items[0].description;
      item.sku = undefined;
    }
    expect(
      compareQuantities(f.map((f) => f.document)).every(
        (c) => c.assessment === "needs_review",
      ),
    ).toBe(true);
  });
  it("uses different explicit SKUs to resolve duplicate names, rejects duplicate SKUs", async () => {
    const f = await pair();
    for (const doc of f.map((f) => f.document))
      for (const row of doc.items)
        row.description = { ...row.description, value: "Same product" };
    expect(
      compareQuantities(f.map((f) => f.document)).every(
        (c) => c.assessment === "confirmed_match",
      ),
    ).toBe(true);
    f[1].document.items[1].sku = f[1].document.items[0].sku;
    expect(
      compareQuantities(f.map((f) => f.document)).every(
        (c) => c.confidence !== "confirmed",
      ),
    ).toBe(true);
  });
  it("rejects evidence from another product row and does not search for a same number elsewhere", async () => {
    const f = await phase23Fixture("invoice");
    for (const key of [
      "quantity",
      "unit",
      "netWeight",
      "grossWeight",
      "sku",
    ] as const) {
      const d = structuredClone(f.data);
      d.items[0][key] = d.items[1][key] as never;
      const g = groundDocument(d, f.pdf);
      expect(
        key === "unit" ? g.items[0].quantity.status : g.items[0][key]?.status,
      ).toBe("unverified");
    }
    const d = structuredClone(f.data);
    d.items[0].quantity.evidence = null;
    expect(groundDocument(d, f.pdf).items[0].quantity.status).toBe(
      "unverified",
    );
  });
  it("retains numerical provisional outcomes when quantity evidence is wrong/missing", async () => {
    const f = await pair({ mismatch: true });
    f[1].document.items[0].quantity.status = "unverified";
    f[1].document.items[0].quantity.source = null;
    const r = reviewDocuments(f.map((f) => f.document));
    expect(r.quantityChecks[0].assessment).toBe("provisional_mismatch");
    expect(r.summary.confirmedQuantityMismatches).toBe(0);
    expect(r.quantityChecks[1].assessment).toBe("confirmed_match");
  });
  it("accepts user-selected documents but warns for different verified parties and protects certainty", async () => {
    const f = await pair({ mismatch: true });
    f[1].document.buyer.value = "Other Buyer";
    const docs = f.map((f) => f.document);
    const r = reviewDocuments(docs, {
      invoiceId: docs[0].id,
      packingId: docs[1].id,
    });
    expect(r.selection).toBe("user_selected");
    expect(r.summary.comparedItems).toBe(2);
    expect(r.quantityChecks[0].assessment).toBe("provisional_mismatch");
    expect(r.checks.find((c) => c.id === "party-buyer")?.assessment).toBe(
      "needs_review",
    );
  });
  it("performs provisional quantity comparison for partial shipment", async () => {
    const f = await pair({ mismatch: true, partial: true });
    const r = reviewDocuments(f.map((f) => f.document));
    expect(r.summary.comparedItems).toBe(2);
    expect(r.quantityChecks[0].assessment).toBe("provisional_mismatch");
    expect(r.summary.confirmedQuantityMismatches).toBe(0);
  });
  it("treats missing Packing List prices as normal document difference, runs Invoice arithmetic separately", async () => {
    const f = await pair();
    const r = reviewDocuments(f.map((f) => f.document));
    expect(
      r.checks.find((c) => c.id === `${f[0].document.id}-amount-total`)
        ?.assessment,
    ).toBe("confirmed_match");
    expect(
      r.checks
        .filter((c) => c.category === "arithmetic")
        .every((c) => c.id.startsWith(f[0].document.id)),
    ).toBe(true);
    expect(r.summary.confirmedQuantityMatches).toBe(2);
  });
  it("recalculates user edits as provisional values and restores original provenance", async () => {
    const f = await pair({ mismatch: true }),
      docs = f.map((f) => f.document);
    docs[1].items[0].quantity = editField(docs[1].items[0].quantity, 600);
    expect(docs[1].items[0].quantity.status).toBe("user_edited");
    expect(reviewDocuments(docs).quantityChecks[0].assessment).toBe(
      "provisional_match",
    );
    expect(reviewDocuments(docs).summary.confirmedQuantityMismatches).toBe(0);
  });
  it("checks gross >= net conservatively with verified rows and equal units", async () => {
    const f = await pair();
    f[1].document.items[0].grossWeight.value = 290;
    const r = reviewDocuments(f.map((f) => f.document));
    expect(
      r.checks.find((c) => c.id === `${f[1].document.id}-weight-0`)?.assessment,
    ).toBe("confirmed_mismatch");
    f[1].document.items[0].weightUnit.status = "unverified";
    expect(
      reviewDocuments(f.map((f) => f.document)).checks.find(
        (c) => c.id === `${f[1].document.id}-weight-0`,
      )?.assessment,
    ).toBe("provisional_mismatch");
  });
  it("never declares a grand-total arithmetic difference an error without adjustment definitions", () => {
    const doc = syntheticDocument().document;
    doc.totalAmount = { ...doc.items[0].amount, value: 1200 };
    const r = reviewDocuments([doc]);
    expect(
      r.checks.find(
        (c) => c.category === "arithmetic" && c.id.endsWith("amount-total"),
      )?.assessment,
    ).toBe("provisional_mismatch");
    expect(r.status).toBe("insufficient_documents");
  });
});
