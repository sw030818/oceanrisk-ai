// Synthetic test data only. Never shown as live Gemini analysis.
import { PDFDocument, StandardFonts } from "pdf-lib";
import type {
  ExtractedDocument,
  PdfDocument,
} from "../../src/modules/documents/schema";
import { groundDocument } from "../../src/modules/evidence/verify";
export async function makePdf(lines: string[][]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const content of lines) {
    const page = pdf.addPage([595, 842]);
    content.forEach((line, i) =>
      page.drawText(line, { x: 45, y: 790 - i * 24, size: 12, font }),
    );
  }
  return pdf.save();
}
export function syntheticDocument(
  type: "invoice" | "packing_list" = "invoice",
  quantity = 100,
) {
  const lines = [
    type === "invoice" ? "COMMERCIAL INVOICE" : "PACKING LIST",
    "Seller: Ocean Export Ltd",
    "Buyer: Harbor Imports Ltd",
    "Document: TR-001",
    "Description: Steel Bolts",
    `Quantity: ${quantity} PCS`,
    "Net Weight: 50 KG",
    "Gross Weight: 55 KG",
    "Amount: 1000 USD",
    "Partial Shipment: No",
    "Order reference: PO-2026-001",
  ];
  const pdf: PdfDocument = {
    id: type,
    fileName: `${type}-synthetic.pdf`,
    pages: [{ page: 1, text: lines.join("\n") }],
  };
  function field<T extends string | number>(value: T, quote: string) {
    return { value, evidence: { page: 1, quote } };
  }
  const data: ExtractedDocument = {
    type,
    seller: field("Ocean Export Ltd", lines[1]),
    buyer: field("Harbor Imports Ltd", lines[2]),
    documentNumber: field("TR-001", lines[3]),
    transactionReference: field("PO-2026-001", lines[10]),
    currency: field("USD", lines[8]),
    totalAmount: field(1000, lines[8]),
    partialShipment: field("no" as const, lines[9]),
    items: [
      {
        description: field("Steel Bolts", lines[4]),
        quantity: field(quantity, lines[5]),
        unit: field("PCS", lines[5]),
        netWeight: field(50, lines[6]),
        grossWeight: field(55, lines[7]),
        weightUnit: field("KG", lines[6]),
        amount: field(1000, lines[8]),
      },
    ],
  };
  return { pdf, data, document: groundDocument(data, pdf), lines };
}
