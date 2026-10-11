import { describe, expect, it } from "vitest";
import { extractPdfText } from "@/modules/pdf/extract";
import { makePdf } from "../fixtures/synthetic";
describe("actual PDF text extraction (synthetic PDF files)", () => {
  it("extracts each page separately with quantities", async () => {
    const pages = await extractPdfText(
      await makePdf([
        ["COMMERCIAL INVOICE", "Quantity: 100 PCS"],
        ["PACKING LIST", "Quantity: 90 PCS"],
      ]),
    );
    expect(pages).toHaveLength(2);
    expect(pages[0]).toMatchObject({ page: 1 });
    expect(pages[0].text).toContain("Quantity: 100 PCS");
    expect(pages[1].page).toBe(2);
    expect(pages[1].text).toContain("Quantity: 90 PCS");
  });
  it("rejects a fake extension", async () => {
    await expect(
      extractPdfText(new TextEncoder().encode("not a PDF")),
    ).rejects.toMatchObject({ code: "INVALID_PDF" });
  });
  it("rejects a damaged PDF", async () => {
    await expect(
      extractPdfText(new TextEncoder().encode("%PDF-1.7\nbroken")),
    ).rejects.toMatchObject({ code: "PDF_PARSE_FAILED" });
  });
  it("identifies an image/blank document as unreadable, not analyzed", async () => {
    await expect(extractPdfText(await makePdf([[]]))).rejects.toMatchObject({
      code: "NO_READABLE_TEXT",
    });
  });
  it("enforces the page cap", async () => {
    await expect(
      extractPdfText(
        await makePdf(Array.from({ length: 31 }, () => ["Extra page"])),
      ),
    ).rejects.toMatchObject({ code: "TOO_MANY_PAGES" });
  });
});
