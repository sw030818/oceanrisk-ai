import { unicodePdf } from "./shipping31";
import { extractPdfText } from "../../src/modules/pdf/extract";
import {
  emptyShippingWire,
  groundShipping,
  itemFieldKeys,
  cargoFieldKeys,
} from "../../src/modules/shipping/ground";
import type { ShippingType } from "../../src/modules/shipping/catalog";
import type {
  ShippingWire,
  Candidate,
} from "../../src/modules/shipping/ai-schema";
import type { PdfDocument } from "../../src/modules/documents/schema";
export type Scenario32 = "normal" | "mismatch" | "uncertain";
export async function shipping32Fixture(
  type: ShippingType,
  scenario: Scenario32 = "normal",
  options: {
    hbl?: string;
    declaration?: string;
    shipment?: string;
    roots?: Record<string, string | number>;
    id?: string;
  } = {},
) {
  const hbl = options.hbl ?? "HB-32-001",
    declaration = options.declaration ?? "03000-26-0032001",
    shipment = options.shipment ?? "SHIP-32-001";
  const title = {
    house_bl: "HOUSE BILL OF LADING",
    export_declaration: "수출신고필증",
    house_manifest: "HOUSE MANIFEST",
  }[type];
  const mismatch = scenario === "mismatch" && type === "house_manifest",
    uncertain = scenario === "uncertain";
  const roots: Record<string, [string, string | number]> = {
    houseBlNumber: ["House B/L No", hbl],
    declarationNumber: ["수출신고번호", declaration],
    shipper: ["Shipper", "Synthetic Pacific Export Ltd."],
    consignee: ["Consignee", "Synthetic Harbor Import Ltd."],
    exporter: ["수출자", "Synthetic Pacific Export Ltd."],
    goodsDescription: ["Goods Description", "Metal Fasteners"],
    packageCount: ["Total Packages", mismatch ? 28 : 30],
    packageUnit: ["Package Unit", "CTNS"],
    grossWeight: ["Total Gross Weight", mismatch ? 310 : 300],
    grossWeightUnit: ["Gross Weight Unit", "KG"],
    netWeight: ["Total Net Weight", 280],
    netWeightUnit: ["Net Weight Unit", "KG"],
    quantity: ["Total Quantity", 500],
    quantityUnit: ["Quantity Unit", "PCS"],
    portOfLoading: ["POL", "BUSAN"],
    portOfDischarge: ["POD", "LONG BEACH"],
    shipmentScope: [
      "Shipment Scope",
      uncertain ? "partial shipment" : "full shipment",
    ],
  };
  for (const [key, value] of Object.entries(options.roots ?? {}))
    if (roots[key]) roots[key][1] = value;
  const rootKeys =
    type === "export_declaration"
      ? [
          "declarationNumber",
          "exporter",
          "goodsDescription",
          "quantity",
          "quantityUnit",
          "netWeight",
          "netWeightUnit",
          "grossWeight",
          "grossWeightUnit",
          "packageCount",
          "packageUnit",
          "shipmentScope",
        ]
      : [
          "houseBlNumber",
          "shipper",
          "consignee",
          "goodsDescription",
          "packageCount",
          "packageUnit",
          "grossWeight",
          "grossWeightUnit",
          "portOfLoading",
          "portOfDischarge",
          "shipmentScope",
        ];
  const first = [
    { text: title, x: 35, y: 30, size: 14 },
    { text: "SYNTHETIC TEST ONLY / 합성 테스트 자료", x: 35, y: 50 },
  ];
  const rootTexts: Record<string, string> = {};
  let y = 85;
  for (const key of rootKeys) {
    if (uncertain && ["houseBlNumber", "declarationNumber"].includes(key))
      continue;
    const [label, v] = roots[key];
    const text = label + ": " + v;
    first.push({ text, x: 35, y });
    rootTexts[key] = text;
    y += 22;
  }
  const refs: {
    kind: "house_bl" | "export_declaration" | "shipment";
    value: string;
    text: string;
  }[] = [];
  if (!uncertain)
    for (const [kind, label, value] of [
      ["house_bl", "House B/L No", hbl],
      ["export_declaration", "수출신고번호", declaration],
      ["shipment", "Shipment Reference", shipment],
    ] as const) {
      const text = label + ": " + value;
      first.push({ text, x: 35, y });
      refs.push({ kind, value, text });
      y += 22;
    }
  const second = [
    { text: "SYNTHETIC CARGO DETAILS / 합성 화물 내역", x: 35, y: 30 },
  ];
  const itemHeaders = [
    ["Goods Description", 35],
    ["HS Code", 220],
    ["Quantity (PCS)", 330],
    ["Unit", 440],
    ["Packages", 490],
    ["Package Unit", 575],
    ["Gross Weight (KG)", 675],
  ] as const;
  itemHeaders.forEach(([text, x]) => second.push({ text, x, y: 60 }));
  ["Steel Bolts", "Brass Nuts"].forEach((text, i) =>
    second.push(
      { text, x: 35, y: 95 + i * 40 },
      { text: i ? "0070000000" : "0303890000", x: 220, y: 95 + i * 40 },
      { text: i ? "200" : "300", x: 330, y: 95 + i * 40 },
      { text: "PCS", x: 440, y: 95 + i * 40 },
      { text: i ? "20" : "10", x: 490, y: 95 + i * 40 },
      { text: "CTNS", x: 575, y: 95 + i * 40 },
      { text: i ? "200" : "100", x: 675, y: 95 + i * 40 },
    ),
  );
  const containerHeaders = [
    ["Container No", 35],
    ["Seal No", 200],
    ["Packages", 330],
    ["Package Unit", 445],
    ["Gross Weight (KG)", 550],
    ["Weight Unit", 730],
  ] as const;
  containerHeaders.forEach(([text, x]) => second.push({ text, x, y: 200 }));
  for (let i = 0; i < 2; i++)
    second.push(
      { text: i ? "EFGH7654321" : "ABCD1234567", x: 35, y: 235 + i * 40 },
      {
        text: i ? "SEAL-002" : mismatch ? "SEAL-009" : "SEAL-001",
        x: 200,
        y: 235 + i * 40,
      },
      { text: i ? "20" : "10", x: 330, y: 235 + i * 40 },
      { text: "CTNS", x: 445, y: 235 + i * 40 },
      { text: i ? "200" : "100", x: 550, y: 235 + i * 40 },
      { text: "KG", x: 730, y: 235 + i * 40 },
    );
  if (type === "house_manifest") {
    const heads = [
      ["House B/L No", 35],
      ["Container No", 180],
      ["Goods Description", 335],
      ["Packages", 535],
      ["Package Unit", 610],
      ["Gross Weight (KG)", 700],
    ] as const;
    heads.forEach(([text, x]) => second.push({ text, x, y: 340 }));
    for (let i = 0; i < 2; i++)
      second.push(
        {
          text: uncertain ? "HB-UNKNOWN" : hbl,
          x: 35,
          y: 375 + i * 40,
        },
        { text: i ? "EFGH7654321" : "ABCD1234567", x: 180, y: 375 + i * 40 },
        { text: i ? "Brass Nuts" : "Steel Bolts", x: 335, y: 375 + i * 40 },
        { text: i ? "20" : "10", x: 535, y: 375 + i * 40 },
        { text: "CTNS", x: 610, y: 375 + i * 40 },
        { text: i ? "200" : "100", x: 700, y: 375 + i * 40 },
      );
  }
  const bytes = unicodePdf([first, second]),
    pdf: PdfDocument = {
      id: options.id ?? `synthetic32-${scenario}-${type}`,
      fileName: `synthetic32-${scenario}-${type}.pdf`,
      pages: await extractPdfText(bytes),
    };
  function f<T extends string | number>(
    value: T,
    page: number,
    text: string,
    y?: number,
    x?: number,
  ): { value: T; evidence: Candidate["evidence"] } {
    const bs = pdf.pages[page - 1].blocks!.filter(
      (b) => b.text === text && (x === undefined || Math.abs(b.x - x) < 1),
    );
    const b =
      y === undefined
        ? bs[0]
        : bs.find((b) => Math.abs(b.y - (y - 9 * 0.8)) < 10);
    if (!b) throw new Error("Synthetic block missing");
    return { value, evidence: { page, blockIds: [b.id] } };
  }
  const wire = emptyShippingWire(type);
  wire.typeEvidence = f(title, 1, title).evidence;
  for (const [key, text] of Object.entries(rootTexts)) {
    const v = roots[key][1];
    wire.fields[key] = typeof v === "number" ? f(v, 1, text) : f(v, 1, text);
  }
  wire.references = refs.map((r) => ({
    kind: r.kind,
    number: f(r.value, 1, r.text),
  }));
  wire.items = [0, 1].map((i) => {
    const fields: ShippingWire["items"][number]["fields"] = Object.fromEntries(
      itemFieldKeys.map((k) => [k, { value: null, evidence: null }]),
    );
    const y = 95 + i * 40;
    fields.goodsDescription = f(
      i ? "Brass Nuts" : "Steel Bolts",
      2,
      i ? "Brass Nuts" : "Steel Bolts",
      y,
    );
    fields.hsCode = f(
      i ? "0070000000" : "0303890000",
      2,
      i ? "0070000000" : "0303890000",
      y,
    );
    fields.quantity = f(i ? 200 : 300, 2, i ? "200" : "300", y);
    fields.quantityUnit = f("PCS", 2, "PCS", y);
    fields.packageCount = f(i ? 20 : 10, 2, i ? "20" : "10", y);
    fields.packageUnit = f("CTNS", 2, "CTNS", y);
    fields.grossWeight = f(i ? 200 : 100, 2, i ? "200" : "100", y, 675);
    fields.grossWeightUnit = f("KG", 2, "Gross Weight (KG)", 60);
    return { fields };
  });
  wire.containers = [0, 1].map((i) => ({
    containerNumber: f(
      i ? "EFGH7654321" : "ABCD1234567",
      2,
      i ? "EFGH7654321" : "ABCD1234567",
      235 + i * 40,
    ),
    sealNumber: f(
      i ? "SEAL-002" : mismatch ? "SEAL-009" : "SEAL-001",
      2,
      i ? "SEAL-002" : mismatch ? "SEAL-009" : "SEAL-001",
      235 + i * 40,
    ),
    sealNumbers: [
      f(
        i ? "SEAL-002" : mismatch ? "SEAL-009" : "SEAL-001",
        2,
        i ? "SEAL-002" : mismatch ? "SEAL-009" : "SEAL-001",
        235 + i * 40,
      ),
    ],
    packageCount: f(i ? 20 : 10, 2, i ? "20" : "10", 235 + i * 40),
    packageUnit: f("CTNS", 2, "CTNS", 235 + i * 40),
    grossWeight: f(i ? 200 : 100, 2, i ? "200" : "100", 235 + i * 40),
    weightUnit: f("KG", 2, "KG", 235 + i * 40),
  }));
  if (type === "house_manifest")
    wire.cargoRecords = [0, 1].map((i) => {
      const fields: ShippingWire["cargoRecords"][number]["fields"] =
        Object.fromEntries(
          cargoFieldKeys.map((k) => [k, { value: null, evidence: null }]),
        );
      const y = 375 + i * 40;
      fields.houseBlNumber = f(
        uncertain ? "HB-UNKNOWN" : hbl,
        2,
        uncertain ? "HB-UNKNOWN" : hbl,
        y,
      );
      fields.containerNumber = f(
        i ? "EFGH7654321" : "ABCD1234567",
        2,
        i ? "EFGH7654321" : "ABCD1234567",
        y,
      );
      fields.goodsDescription = f(
        i ? "Brass Nuts" : "Steel Bolts",
        2,
        i ? "Brass Nuts" : "Steel Bolts",
        y,
      );
      fields.packageCount = f(i ? 20 : 10, 2, i ? "20" : "10", y);
      fields.packageUnit = f("CTNS", 2, "CTNS", y);
      fields.grossWeight = f(i ? 200 : 100, 2, i ? "200" : "100", y, 700);
      fields.grossWeightUnit = f("KG", 2, "Gross Weight (KG)", 340);
      return { fields };
    });
  return { bytes, pdf, wire, document: groundShipping(wire, pdf, type) };
}
