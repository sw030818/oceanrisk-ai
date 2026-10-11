// Reproduces the reported STRUCTURE using synthetic data, never a user PDF.
import { PDFDocument, StandardFonts } from "pdf-lib";
import { extractPdfText } from "../../src/modules/pdf/extract";
import { groundDocument } from "../../src/modules/evidence/verify";
import type {
  ExtractedDocument,
  PdfDocument,
  PdfBlock,
} from "../../src/modules/documents/schema";
export async function phase23Fixture(
  type: "invoice" | "packing_list",
  options: {
    mismatch?: boolean;
    missingReference?: boolean;
    conflictingPO?: boolean;
    reorder?: boolean;
    partial?: boolean;
  } = {},
) {
  const native = await PDFDocument.create(),
    font = await native.embedFont(StandardFonts.Helvetica),
    page = native.addPage([842, 595]);
  const draw = (text: string, x: number, y: number) =>
    page.drawText(text, { x, y: 595 - y, size: 9, font });
  draw(type === "invoice" ? "COMMERCIAL INVOICE" : "PACKING LIST", 35, 32);
  draw("EXPORTER / SELLER", 35, 62);
  draw("Pacific Gateway Trading", 35, 80);
  draw("Co., Ltd.", 35, 91);
  draw("BUYER / CONSIGNEE", 410, 62);
  draw("Harbor Horizon Imports Ltd.", 410, 80);
  draw(type === "invoice" ? "Invoice No:" : "Packing List No:", 35, 120);
  const number = type === "invoice" ? "INV-2026-1012-008" : "PL-2026-1012-015";
  draw(number, 180, 120);
  const po =
    options.conflictingPO && type === "packing_list"
      ? "PO-OTHER-261002"
      : "PO-HHG-261001";
  if (!options.missingReference) {
    draw("Purchase Order No:", 35, 150);
    draw(po, 35, 166);
  }
  if (type === "packing_list" && !options.missingReference) {
    draw("Invoice Reference:", 410, 150);
    draw("INV-2026-1012-008", 560, 150);
  }
  draw(options.partial ? "Partial Shipment: Yes" : "Full shipment", 35, 195);
  const headers = [
    ["Description", 35],
    ["Item Code", 265],
    ["QTY", 330],
    ["UOM", 385],
    ["CTNS", 425],
    ["N.W. (KG)", 480],
    ["G.W. (KG)", 555],
    ["Unit Price", 635],
    ["Amount", 710],
  ] as const;
  headers.forEach(([s, x]) => draw(s, x, 235));
  const rows = [
    {
      name: "Stainless Steel Vacuum Tumbler, 500ml",
      lines: ["Stainless Steel Vacuum Tumbler,", "500ml"],
      sku: "TUM-500",
      quantity: options.mismatch && type === "packing_list" ? 580 : 600,
      packages: 20,
      net: 300,
      gross: 320,
      price: 2,
      amount: 1200,
    },
    {
      name: "Reusable Silicone Food Storage Bag, 1000ml",
      lines: ["Reusable Silicone Food Storage Bag,", "1000ml"],
      sku: "BAG-1000",
      quantity: 400,
      packages: 12,
      net: 100,
      gross: 110,
      price: 3,
      amount: 1200,
    },
  ];
  const order = options.reorder && type === "packing_list" ? [1, 0] : [0, 1];
  for (const [position, index] of order.entries()) {
    const row = rows[index],
      y = 265 + position * 55;
    draw(row.lines[0], 35, y);
    draw(row.lines[1], 35, y + 11);
    draw(row.sku, 265, y);
    draw(index === 1 ? `${row.quantity}PCS` : String(row.quantity), 330, y);
    if (index === 0) draw("PCS", 385, y);
    draw(String(row.packages), 425, y);
    draw(`${row.net}KG`, 480, y);
    draw(`${row.gross} KG`, 555, y);
    if (type === "invoice") {
      draw(String(row.price), 635, y);
      draw(String(row.amount), 710, y);
    }
  }
  if (type === "invoice") {
    draw("Currency: USD", 35, 410);
    draw("Goods subtotal: 2400", 35, 432);
    draw("Total Amount: 2400", 410, 432);
    draw("Discount: 0", 35, 454);
    draw("Freight: 0", 230, 454);
    draw("Tax: 0", 410, 454);
  }
  const bytes = await native.save(),
    pages = await extractPdfText(bytes),
    pdf: PdfDocument = {
      id: `phase23-${type}`,
      fileName: `synthetic-phase23-${type}.pdf`,
      pages,
    };
  const blocks = pages[0].blocks!;
  const find = (text: string, occurrence = 0): PdfBlock => {
    const b = blocks
      .filter((b) => b.text === text)
      .sort((a, b) => a.row - b.row)[occurrence];
    if (!b) throw new Error("Synthetic block missing");
    return b;
  };
  const field = <T extends string | number>(
    value: T,
    selected: PdfBlock[],
  ) => ({
    value,
    evidence: {
      page: 1,
      quote: selected.map((b) => b.text).join("\n"),
      segments: selected.map((b) => ({ blockId: b.id, quote: b.text })),
    },
  });
  const empty = { value: null, evidence: null };
  const invoiceRef =
    type === "packing_list" && !options.missingReference
      ? field("INV-2026-1012-008", [
          find("Invoice Reference:"),
          find("INV-2026-1012-008"),
        ])
      : empty;
  const purchaseOrder = options.missingReference
    ? empty
    : field(po, [find("Purchase Order No:"), find(po)]);
  const data: ExtractedDocument = {
    type,
    seller: field("Pacific Gateway Trading Co., Ltd.", [
      find("EXPORTER / SELLER"),
      find("Pacific Gateway Trading"),
      find("Co., Ltd."),
    ]),
    buyer: field("Harbor Horizon Imports Ltd.", [
      find("BUYER / CONSIGNEE"),
      find("Harbor Horizon Imports Ltd."),
    ]),
    documentNumber: field(number, [
      find(type === "invoice" ? "Invoice No:" : "Packing List No:"),
      find(number),
    ]),
    purchaseOrder,
    invoiceReference: invoiceRef,
    transactionReference: type === "invoice" ? purchaseOrder : invoiceRef,
    partialShipment: field(
      options.partial ? ("yes" as const) : ("no" as const),
      [find(options.partial ? "Partial Shipment: Yes" : "Full shipment")],
    ),
    currency:
      type === "invoice" ? field("USD", [find("Currency: USD")]) : empty,
    totalAmount:
      type === "invoice" ? field(2400, [find("Total Amount: 2400")]) : empty,
    subtotalAmount:
      type === "invoice" ? field(2400, [find("Goods subtotal: 2400")]) : empty,
    discountAmount:
      type === "invoice" ? field(0, [find("Discount: 0")]) : empty,
    freightAmount: type === "invoice" ? field(0, [find("Freight: 0")]) : empty,
    taxAmount: type === "invoice" ? field(0, [find("Tax: 0")]) : empty,
    items: order.map((index) => {
      const r = rows[index],
        quantity = find(index === 1 ? `${r.quantity}PCS` : String(r.quantity));
      return {
        description: field(r.name, [
          find("Description"),
          ...r.lines.map((t) => find(t)),
        ]),
        sku: field(r.sku, [find("Item Code"), find(r.sku)]),
        quantity: field(
          r.quantity,
          index === 0
            ? [find("QTY"), quantity, find("PCS")]
            : [find("QTY"), quantity],
        ),
        unit: field(
          "PCS",
          index === 0 ? [find("UOM"), find("PCS")] : [quantity],
        ),
        netWeight: field(r.net, [find("N.W. (KG)"), find(`${r.net}KG`)]),
        grossWeight: field(r.gross, [find("G.W. (KG)"), find(`${r.gross} KG`)]),
        weightUnit: field("KG", [find("N.W. (KG)")]),
        packageQuantity: field(r.packages, [
          find("CTNS"),
          find(String(r.packages)),
        ]),
        packageUnit: field("CTNS", [find("CTNS")]),
        unitPrice:
          type === "invoice"
            ? field(r.price, [find("Unit Price"), find(String(r.price))])
            : empty,
        amount:
          type === "invoice"
            ? field(r.amount, [
                find("Amount"),
                find(String(r.amount), order.indexOf(index)),
              ])
            : empty,
      };
    }),
  };
  return {
    pdf,
    data,
    bytes,
    document: groundDocument(data, pdf),
    makeFile: () =>
      new File([new Uint8Array(bytes)], pdf.fileName, {
        type: "application/pdf",
      }),
  };
}
