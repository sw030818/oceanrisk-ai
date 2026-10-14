import { describe, it, expect } from "vitest";
import { shippingOpenAIRequest } from "../../src/modules/shipping/openai";
import type { PdfDocument } from "../../src/modules/documents/schema";
const pdf: PdfDocument = {
  id: "private-id",
  fileName: "private-name.pdf",
  pages: [
    {
      page: 1,
      width: 500,
      height: 700,
      text: "QTY\n600 PCS",
      blocks: [
        {
          id: "p1-b0",
          text: "QTY",
          x: 10,
          y: 20,
          width: 20,
          height: 10,
          row: 0,
        },
        {
          id: "p1-b1",
          text: "600 PCS",
          x: 10,
          y: 40,
          width: 40,
          height: 10,
          row: 1,
        },
      ],
      cells: [{ x: 0, y: 30, width: 80, height: 25 }],
    },
  ],
};
const pages = (p: PdfDocument) => {
  const request = shippingOpenAIRequest(p, "gpt-6-luna");
  const content = request.input[1].content as { type: string; text: string }[];
  return JSON.parse(content[0].text).untrustedDocument.pages;
};
describe("shipping compact model input preserves independent grounding data", () => {
  it("removes only duplicate full text, retaining every block and native cell", () => {
    const projected = pages(pdf)[0];
    expect(projected.text).toBeUndefined();
    expect(projected.blocks).toEqual(pdf.pages[0].blocks);
    expect(projected.cells).toEqual(pdf.pages[0].cells);
    expect(projected.page).toBe(1);
    expect(projected.width).toBe(500);
    expect(projected.height).toBe(700);
    expect(JSON.stringify(projected).length).toBeLessThan(
      JSON.stringify(pdf.pages[0]).length,
    );
    expect(pdf.pages[0].text).toBe("QTY\n600 PCS");
    expect(
      JSON.stringify(shippingOpenAIRequest(pdf, "gpt-6-luna")),
    ).not.toContain("private-");
  });
  it("keeps text with any content missing from positioned blocks", () => {
    const page = { ...pdf.pages[0], text: "QTY\n600 PCS\nPartial shipment" };
    expect(pages({ ...pdf, pages: [page] })[0]).toEqual(page);
  });
  it("keeps plain text and OCR provenance without inventing positioned evidence", () => {
    const page = {
      page: 2,
      text: "Scanned declaration",
      textSource: "ocr" as const,
      ocrStatus: "recognized" as const,
    };
    expect(pages({ ...pdf, pages: [page] })[0]).toEqual(page);
    expect(shippingOpenAIRequest(pdf, "gpt-6-luna").text.format.strict).toBe(
      true,
    );
    expect(shippingOpenAIRequest(pdf, "gpt-6-luna").max_output_tokens).toBe(
      8192,
    );
  });
});
