import { describe, expect, it } from "vitest";
import { phase15Scenario } from "../fixtures/phase15";
import { syntheticDocument } from "../fixtures/synthetic";
import { analyzeFile } from "@/modules/analysis/pipeline";
import { groundDocument, verifyField } from "@/modules/evidence/verify";
import { compareQuantities } from "@/modules/rules/quantity";
import { extractPdfText } from "@/modules/pdf/extract";
import { summarizeAnalysis } from "@/modules/analysis/summary";

describe("PHASE 1.5 actual generated PDFs with MOCKED AI (not live Gemini)", () => {
  it.each(["A", "B", "C", "D"] as const)(
    "case %s: source grounding and rule outcome",
    async (id) => {
      const scenario = phase15Scenario(id);
      const results = await Promise.all(
        scenario.documents.map(async (doc) =>
          analyzeFile(await doc.makeFile(), { ai: async () => doc.data }),
        ),
      );
      expect(results.every((result) => result.error === null)).toBe(true);
      const documents = results.map((result) => result.document!);
      expect(documents.map((doc) => doc.type)).toEqual([
        "invoice",
        "packing_list",
      ]);
      for (const doc of documents) {
        expect(doc.items[0].quantity.status).toBe("verified");
        expect(doc.items[0].quantity.source?.page).toBe(2);
        expect(doc.items[0].quantity.value).toBe(
          id === "B" || id === "D" ? (doc.type === "invoice" ? 500 : 480) : 500,
        );
      }
      const check = compareQuantities(documents)[0];
      expect(check.status).toBe(scenario.expectedStatus);
      if (id === "D") expect(check.confidence).toBe("candidate");
    },
  );
  it("separates product 500 PCS and package 20 CTNS on the same evidence block", () => {
    const { data, pdf } = phase15Scenario("C").documents[1];
    const doc = groundDocument(data, pdf);
    expect(doc.items[0].quantity.status).toBe("verified");
    expect(
      verifyField(
        { value: 20, evidence: data.items[0].quantity.evidence },
        pdf,
        "quantity",
      ).status,
    ).toBe("unverified");
  });
  it("supports PCS / EA synonyms with each unit verified in its own quantity source", () => {
    const a = syntheticDocument("invoice", 500),
      b = syntheticDocument("packing_list", 500);
    b.pdf.pages[0].text = b.pdf.pages[0].text.replace(
      "Quantity: 500 PCS",
      "Quantity: 500 EA",
    );
    b.data.items[0].quantity.evidence!.quote = "Quantity: 500 EA";
    b.data.items[0].unit = {
      value: "EA",
      evidence: { page: 1, quote: "Quantity: 500 EA" },
    };
    expect(
      compareQuantities([a.document, groundDocument(b.data, b.pdf)])[0].status,
    ).toBe("match");
  });
  it("supports explicit adjacent 500PCS and quantity unit headers", () => {
    const pdf = {
      ...syntheticDocument().pdf,
      pages: [{ page: 1, text: "Qty: 500PCS\nQuantity (PCS): 500" }],
    };
    for (const quote of ["Qty: 500PCS", "Quantity (PCS): 500"])
      expect(
        verifyField(
          { value: 500, evidence: { page: 1, quote } },
          pdf,
          "quantity",
        ).status,
      ).toBe("verified");
  });
  it("keeps unknown shipment scope as a candidate, never a confirmed mismatch", () => {
    const docs = [
      syntheticDocument("invoice", 500).document,
      syntheticDocument("packing_list", 480).document,
    ];
    docs[1].partialShipment = {
      value: "unknown",
      status: "missing",
      reason: "missing",
      source: null,
    };
    const check = compareQuantities(docs)[0];
    expect(check.status).toBe("unverifiable");
    expect(check.confidence).toBe("candidate");
    expect(check.invoiceQuantity).toBe(500);
    expect(check.packingQuantity).toBe(480);
  });
  it("never makes a candidate from known partial shipment or edited context", () => {
    for (const mode of ["partial", "edited"] as const) {
      const docs = [
        syntheticDocument("invoice", 500).document,
        syntheticDocument("packing_list", 480).document,
      ];
      if (mode === "partial") docs[1].partialShipment.value = "yes";
      else docs[1].transactionReference.status = "user_edited";
      expect(compareQuantities(docs)[0].confidence).toBe("unavailable");
    }
  });
  it("does not pair different orders even when one reference is unverified", () => {
    const docs = [
      syntheticDocument("invoice", 500).document,
      syntheticDocument("packing_list", 480).document,
    ];
    docs[1].transactionReference.value = "PO-OTHER";
    docs[1].transactionReference.status = "unverified";
    expect(compareQuantities(docs)[0].confidence).toBe("unavailable");
  });
  it("accepts a full party name followed by a separate address line, not a shortened name", () => {
    const pdf = {
      ...syntheticDocument().pdf,
      pages: [
        { page: 1, text: "Seller: Ocean Export Ltd\nAddress: Test Road" },
      ],
    };
    const evidence = { page: 1, quote: pdf.pages[0].text };
    expect(
      verifyField({ value: "Ocean Export Ltd", evidence }, pdf, "seller")
        .status,
    ).toBe("verified");
    expect(
      verifyField({ value: "Ocean", evidence }, pdf, "seller").status,
    ).toBe("unverified");
  });
  it("cancels PDF work before parsing", async () => {
    await expect(
      extractPdfText(new Uint8Array(), AbortSignal.abort()),
    ).rejects.toMatchObject({ code: "REQUEST_CANCELLED" });
  });
  it("does not call AI after request cancellation", async () => {
    const doc = phase15Scenario("A").documents[0];
    const result = await analyzeFile(await doc.makeFile(), {
      signal: AbortSignal.abort(),
    });
    expect(result.error?.code).toBe("REQUEST_CANCELLED");
  });
  it("distinguishes successful, partial and unreadable batches", () => {
    const fixture = syntheticDocument();
    const complete = {
      pdf: fixture.pdf,
      document: fixture.document,
      error: null,
    };
    const aiFailed = {
      pdf: fixture.pdf,
      document: null,
      error: { code: "API_ERROR", message: "failed" },
    };
    const unreadable = {
      pdf: { ...fixture.pdf, pages: [] },
      document: null,
      error: { code: "NO_READABLE_TEXT", message: "failed" },
    };
    expect(summarizeAnalysis([complete]).status).toBe("success");
    expect(summarizeAnalysis([complete, unreadable]).status).toBe("partial");
    expect(summarizeAnalysis([aiFailed]).status).toBe("partial");
    expect(summarizeAnalysis([unreadable]).status).toBe("failed");
  });
  it("does not treat a negated full-shipment sentence as full shipment", () => {
    const { data, pdf } = syntheticDocument();
    pdf.pages[0].text += "\nNot full shipment";
    data.partialShipment = {
      value: "no",
      evidence: { page: 1, quote: "Not full shipment" },
    };
    expect(groundDocument(data, pdf).partialShipment.status).toBe("unverified");
  });
  it("does not confirm contradictory shipment declarations", () => {
    const { data, pdf } = syntheticDocument();
    pdf.pages[0].text += "\nPartial Shipment: Yes";
    expect(groundDocument(data, pdf).partialShipment.status).toBe("unverified");
  });
  it("does not read weight or packaging labels as product quantities even with a product unit", () => {
    const pdf = {
      ...syntheticDocument().pdf,
      pages: [
        { page: 1, text: "Package quantity: 20 PCS\nWeight quantity: 20 KG" },
      ],
    };
    for (const quote of pdf.pages[0].text.split("\n"))
      expect(
        verifyField(
          { value: 20, evidence: { page: 1, quote } },
          pdf,
          "quantity",
        ).status,
      ).toBe("unverified");
  });
  it("rejects a quote that crops the package qualifier from the actual page", () => {
    const pdf = { ...syntheticDocument().pdf, pages: [{ page: 1, text: "Package quantity: 20 PCS" }] };
    expect(verifyField({value:20,evidence:{page:1,quote:"quantity: 20 PCS"}},pdf,"quantity").status).toBe("unverified");
  });
  it("rejects a quote that crops the negation from full-shipment text", () => {
    const { data, pdf } = syntheticDocument();
    pdf.pages[0].text = pdf.pages[0].text.replace("Full shipment", "Not full shipment");
    data.partialShipment = { value:"no", evidence:{page:1,quote:"full shipment"} };
    expect(groundDocument(data,pdf).partialShipment.status).toBe("unverified");
  });
});
