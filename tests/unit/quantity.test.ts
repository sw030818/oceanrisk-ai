import { describe, expect, it } from "vitest";
import { compareQuantities } from "@/modules/rules/quantity";
import { editField } from "@/modules/evidence/verify";
import { syntheticDocument } from "../fixtures/synthetic";
function pair(a = 100, b = 100) {
  return [
    syntheticDocument("invoice", a).document,
    syntheticDocument("packing_list", b).document,
  ];
}
describe("grounded product quantity rule", () => {
  it("compares a matching complete-shipment pair", () => {
    expect(compareQuantities(pair())[0].status).toBe("match");
  });
  it("finds a mismatch with original document evidence", () => {
    const check = compareQuantities(pair(100, 90))[0];
    expect(check.status).toBe("mismatch");
    expect(check.invoiceQuantity).toBe(100);
    expect(check.packingQuantity).toBe(90);
    expect(check.sources.filter(Boolean)).toHaveLength(4);
    expect(check.question).toContain("수정");
  });
  it("does not confuse zero with missing quantity", () => {
    expect(compareQuantities(pair(0, 10))[0].status).toBe("mismatch");
  });
  it("requires both document types and rejects ambiguous multiple pairs", () => {
    expect(compareQuantities([])[0].status).toBe("unverifiable");
    expect(
      compareQuantities([...pair(), syntheticDocument().document])[0].status,
    ).toBe("unverifiable");
  });
  it("excludes unsupported/different/package units", () => {
    for (const unit of ["KG", "CTNS", "BOX"]) {
      const docs = pair();
      docs[1].items[0].unit.value = unit;
      expect(compareQuantities(docs)[0].status).toBe("unverifiable");
    }
  });
  it("handles partial or unknown shipment scope", () => {
    for (const scope of ["yes", "unknown"] as const) {
      const docs = pair(100, 90);
      docs[1].partialShipment.value = scope;
      expect(compareQuantities(docs)[0].status).toBe("unverifiable");
    }
  });
  it("does not use unverified or user-edited quantity", () => {
    const docs = pair(100, 90);
    docs[1].items[0].quantity.status = "unverified";
    expect(compareQuantities(docs)[0].status).toBe("unverifiable");
    docs[1].items[0].quantity = editField(docs[1].items[0].quantity, 100);
    expect(compareQuantities(docs)[0].status).toBe("unverifiable");
  });
  it("requires unique same-name items", () => {
    const docs = pair();
    docs[1].items[0].description.value = "Different Item";
    expect(
      compareQuantities(docs).every((check) => check.status === "unverifiable"),
    ).toBe(true);
    const duplicates = pair();
    duplicates[0].items.push(duplicates[0].items[0]);
    expect(
      compareQuantities(duplicates).every(
        (check) => check.status === "unverifiable",
      ),
    ).toBe(true);
  });
  it("rejects different or unknown trading parties", () => {
    const docs = pair();
    docs[1].buyer.value = "Other Buyer";
    expect(compareQuantities(docs)[0].status).toBe("unverifiable");
    docs[1].buyer.value = null;
    expect(compareQuantities(docs)[0].status).toBe("unverifiable");
  });
  it("reports unmatched packing list items", () => {
    const docs = pair();
    docs[1].items.push({
      ...docs[1].items[0],
      description: { ...docs[1].items[0].description, value: "Extra item" },
    });
    expect(compareQuantities(docs).map((check) => check.status)).toEqual([
      "match",
      "unverifiable",
    ]);
  });
  it("does not pair unrelated orders from the same parties", () => {
    const docs = pair(100, 90);
    docs[1].transactionReference.value = "PO-OTHER";
    expect(compareQuantities(docs)[0].status).toBe("unverifiable");
  });
  it("does not attach an unrelated source unit to a quantity", () => {
    const docs = pair(100, 90);
    docs[1].items[0].quantity.source!.quote = "Quantity: 90 KG";
    expect(compareQuantities(docs)[0].status).toBe("unverifiable");
  });
});
