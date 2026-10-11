import { describe, expect, it } from "vitest";
import {
  editField,
  groundDocument,
  verifyField,
} from "@/modules/evidence/verify";
import { syntheticDocument } from "../fixtures/synthetic";
describe("evidence checks", () => {
  const { pdf } = syntheticDocument();
  it("validates source filename, page and exact numeric evidence", () => {
    const field = verifyField(
      { value: 100, evidence: { page: 1, quote: "Quantity: 100 PCS" } },
      pdf,
      "quantity",
    );
    expect(field.status).toBe("verified");
    expect(field.source?.fileName).toBe(pdf.fileName);
  });
  it("handles missing values and missing evidence", () => {
    expect(verifyField({ value: null, evidence: null }, pdf).status).toBe(
      "missing",
    );
    expect(verifyField({ value: 10, evidence: null }, pdf).status).toBe(
      "unverified",
    );
  });
  it("rejects hallucinated quotes and wrong pages", () => {
    expect(
      verifyField(
        { value: 999, evidence: { page: 1, quote: "Quantity: 999 PCS" } },
        pdf,
      ).status,
    ).toBe("unverified");
    expect(
      verifyField(
        { value: 100, evidence: { page: 2, quote: "Quantity: 100 PCS" } },
        pdf,
      ).status,
    ).toBe("unverified");
  });
  it("does not accept 10 as a substring of 100", () => {
    expect(
      verifyField(
        { value: 10, evidence: { page: 1, quote: "Quantity: 100 PCS" } },
        pdf,
      ).status,
    ).toBe("unverified");
  });
  it("does not use an unrelated number later in the quote as quantity", () => {
    const doc = {
      ...pdf,
      pages: [{ page: 1, text: "Quantity: 10 PCS; Ref: 100" }],
    };
    expect(
      verifyField(
        { value: 100, evidence: { page: 1, quote: doc.pages[0].text } },
        doc,
        "quantity",
      ).status,
    ).toBe("unverified");
  });
  it("rejects package counts and ambiguous decimal-comma numbers", () => {
    const doc = {
      ...pdf,
      pages: [{ page: 1, text: "Quantity: 10 CTNS\nQuantity: 1,5 PCS" }],
    };
    expect(
      verifyField(
        { value: 10, evidence: { page: 1, quote: "Quantity: 10 CTNS" } },
        doc,
        "quantity",
      ).status,
    ).toBe("unverified");
    expect(
      verifyField(
        { value: 1, evidence: { page: 1, quote: "Quantity: 1,5 PCS" } },
        doc,
        "quantity",
      ).status,
    ).toBe("unverified");
  });
  it("rejects swapped seller/buyer roles", () => {
    expect(
      verifyField(
        {
          value: "Harbor Imports Ltd",
          evidence: { page: 1, quote: "Buyer: Harbor Imports Ltd" },
        },
        pdf,
        "seller",
      ).status,
    ).toBe("unverified");
  });
  it("does not trust AI partial shipment classification without explicit evidence", () => {
    const { data } = syntheticDocument();
    data.partialShipment = {
      value: "no",
      evidence: { page: 1, quote: "Description: Steel Bolts" },
    };
    expect(groundDocument(data, pdf).partialShipment.status).toBe("unverified");
  });
  it("marks edits as unverified user changes even when equal to the original", () => {
    const field = verifyField(
      { value: 100, evidence: { page: 1, quote: "Quantity: 100 PCS" } },
      pdf,
    );
    expect(editField(field, 100).status).toBe("user_edited");
  });
  it("rejects shortened trading party names", () => {
    expect(
      verifyField(
        {
          value: "Ocean",
          evidence: { page: 1, quote: "Seller: Ocean Export Ltd" },
        },
        pdf,
        "seller",
      ).status,
    ).toBe("unverified");
  });
});
