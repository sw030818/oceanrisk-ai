// Independent PHASE3.3 truth is specified before rendering or AI calls.
// PDF content contains no answers, relationships, verdicts or expected evidence.
import { unicodePdf } from "./shipping31";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
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
export type Layout33 =
  | "portrait"
  | "landscape"
  | "reordered"
  | "multipage"
  | "wrapped"
  | "holdout"
  | "bilingual";
export interface Truth33 {
  id: string;
  fileName?: string;
  type: ShippingType;
  partition: "tuning" | "holdout";
  layout: Layout33;
  roots: Record<string, string | number>;
  declarations: string[];
  items: { name: string; hs: string; quantity: number }[];
  containers: {
    number: string;
    seal: string;
    packages: number;
    weight: number;
  }[];
  cargo?: {
    hbl: string;
    container: string;
    name: string;
    packages: number;
    weight: number;
  }[];
}
const labels: Record<string, string> = {
  houseBlNumber: "House B/L No",
  declarationNumber: "Declaration No",
  shipper: "Shipper",
  consignee: "Consignee",
  exporter: "Exporter",
  goodsDescription: "Goods Description",
  quantity: "Total Quantity",
  quantityUnit: "Quantity Unit",
  packageCount: "Total Packages",
  packageUnit: "Package Unit",
  grossWeight: "Total Gross Weight",
  grossWeightUnit: "Gross Weight Unit",
  netWeight: "Total Net Weight",
  netWeightUnit: "Net Weight Unit",
  portOfLoading: "Port of Loading",
  portOfDischarge: "Port of Discharge",
  shipmentScope: "Shipment Scope",
};
export function truth33(
  type: ShippingType,
  id: string,
  layout: Layout33 = "portrait",
  overrides: Partial<Truth33> = {},
): Truth33 {
  const roots: Truth33["roots"] = {
    houseBlNumber: "HB-33-A",
    shipper: "Synthetic Meridian Export Ltd",
    consignee: "Synthetic Bay Import Ltd",
    goodsDescription: "Machined Parts",
    packageCount: 30,
    packageUnit: "CTNS",
    grossWeight: 325.5,
    grossWeightUnit: "KGS",
    portOfLoading: "BUSAN",
    portOfDischarge: "ROTTERDAM",
    shipmentScope: "full shipment",
  };
  if (type === "export_declaration")
    Object.assign(roots, {
      declarationNumber: "03000-26-0033001",
      exporter: "Synthetic Meridian Export Ltd",
      quantity: 1000,
      quantityUnit: "PCS",
      netWeight: 300.25,
      netWeightUnit: "KG",
    });
  return {
    id,
    type,
    partition: layout === "holdout" ? "holdout" : "tuning",
    layout,
    roots,
    declarations: ["03000-26-0033001"],
    items: [
      {
        name: "Stainless Steel Precision Fastener",
        hs: "0070000000",
        quantity: 600,
      },
      {
        name: "Reusable Silicone Storage Bag",
        hs: "0303890000",
        quantity: 400,
      },
    ],
    containers: [
      {
        number: "ABCD1234567",
        seal: "SYN-SEAL-01",
        packages: 30,
        weight: 325.5,
      },
    ],
    ...(type === "house_manifest"
      ? {
          cargo: [
            {
              hbl: "HB-33-A",
              container: "ABCD1234567",
              name: "Machined Parts",
              packages: 30,
              weight: 325.5,
            },
          ],
        }
      : {}),
    ...overrides,
  };
}
export async function fixture33(truth: Truth33) {
  const p = await PDFDocument.create(),
    font = await p.embedFont(StandardFonts.Helvetica),
    bold = await p.embedFont(StandardFonts.HelveticaBold);
  p.setCreationDate(new Date("2026-10-13T00:00:00Z"));
  p.setModificationDate(new Date("2026-10-13T00:00:00Z"));
  const landscape =
      truth.layout === "landscape" || truth.layout === "reordered",
    w = landscape ? 842 : 595,
    h = 842;
  const drawn: { text: string; x: number; y: number; size?: number }[][] = [[]];
  const cells: {
    page: number;
    key: string;
    text: string;
    x: number;
    y: number;
  }[] = [];
  let page = p.addPage([w, h]),
    pageNo = 1,
    y = 36;
  const draw = (
    text: string,
    x: number,
    yy: number,
    key = "",
    strong = false,
  ) => {
    drawn[pageNo - 1].push({ text, x, y: yy, size: strong ? 12 : 9 });
    page.drawText(text, {
      x,
      y: h - yy,
      size: strong ? 12 : 9,
      font: strong ? bold : font,
      color: rgb(0.1, 0.15, 0.2),
    });
    if (key) cells.push({ page: pageNo, key, text, x, y: yy });
  };
  const title = {
    house_bl: "HOUSE BILL OF LADING",
    export_declaration: "EXPORT DECLARATION CERTIFICATE",
    house_manifest: "HOUSE MANIFEST",
  }[truth.type];
  draw(title, 30, y, "title", true);
  draw("SYNTHETIC EVALUATION ONLY - NOT AN ISSUED DOCUMENT", 30, 56);
  y = 85;
  const keys = Object.keys(truth.roots);
  for (const [i, key] of keys.entries()) {
    const col = truth.layout === "holdout" ? i % 2 : 0,
      yy = truth.layout === "holdout" ? 85 + Math.floor(i / 2) * 36 : y;
    const x = 30 + col * 280;
    draw(labels[key] ?? key, x, yy);
    draw(
      String(truth.roots[key]),
      x + (truth.layout === "holdout" ? 0 : 155),
      yy + (truth.layout === "holdout" ? 14 : 0),
      `root.${key}`,
    );
    if (truth.layout !== "holdout") y += 23;
  }
  if (truth.layout === "holdout") y = 85 + Math.ceil(keys.length / 2) * 36;
  for (const [i, n] of truth.declarations.entries()) {
    draw("Declaration No", 30, y);
    draw(n, 185, y, `ref.${i}`);
    y += 23;
  }
  const newPage = () => {
    page = p.addPage([w, h]);
    pageNo++;
    drawn.push([]);
    y = 52;
    draw("SYNTHETIC DETAILS - CONTINUED", 30, 30);
  };
  if (y > 440 || truth.layout === "multipage") newPage();
  const table = (
    headers: { key: string; label: string; width: number }[],
    rows: Record<string, string>[],
    kind: string,
    split = false,
  ) => {
    let x = 30;
    const xs: Record<string, number> = {};
    const head = () => {
      x = 30;
      for (const c of headers) {
        xs[c.key] = x;
        draw(c.label, x, y, `header.${kind}.${c.key}`);
        x += c.width;
      }
      page.drawLine({
        start: { x: 30, y: h - y - 5 },
        end: { x: Math.min(x, w - 20), y: h - y - 5 },
        thickness: 0.5,
      });
      y += 27;
    };
    head();
    for (const [i, row] of rows.entries()) {
      if (y > h - 85 || (split && i === 1)) {
        newPage();
        head();
      }
      const yy = y;
      for (const c of headers) {
        let value = row[c.key] ?? "";
        if (
          c.key === "goodsDescription" &&
          truth.layout === "wrapped" &&
          value.length > 25
        ) {
          const words = value.split(" "),
            half = Math.ceil(words.length / 2);
          draw(
            words.slice(0, half).join(" "),
            xs[c.key],
            yy - 12,
            `${kind}.${i}.${c.key}.wrap`,
          );
          value = words.slice(half).join(" ");
        }
        draw(value, xs[c.key], yy, `${kind}.${i}.${c.key}`);
      }
      y += 42;
    }
    y += 26;
  };
  const itemHeads =
    truth.layout === "reordered"
      ? [
          { key: "quantity", label: "Quantity (PCS)", width: 110 },
          { key: "hsCode", label: "HS Code", width: 125 },
          { key: "goodsDescription", label: "Goods Description", width: 320 },
        ]
      : [
          { key: "goodsDescription", label: "Goods Description", width: 240 },
          { key: "hsCode", label: "HS Code", width: 125 },
          { key: "quantity", label: "Quantity (PCS)", width: 120 },
        ];
  table(
    itemHeads,
    truth.items.map((i) => ({
      goodsDescription: i.name,
      hsCode: i.hs,
      quantity: i.quantity.toLocaleString("en-US"),
    })),
    "item",
    truth.layout === "multipage",
  );
  if (y > h - 180) newPage();
  table(
    [
      { key: "containerNumber", label: "Container No", width: 130 },
      { key: "sealNumber", label: "Seal No", width: 125 },
      { key: "packageCount", label: "Packages (CTNS)", width: 105 },
      { key: "grossWeight", label: "Gross Weight (KGS)", width: 130 },
    ],
    truth.containers.map((c) => ({
      containerNumber: c.number,
      sealNumber: c.seal,
      packageCount: String(c.packages),
      grossWeight: String(c.weight),
    })),
    "container",
  );
  if (truth.cargo) {
    if (y > h - 180) newPage();
    table(
      [
        { key: "houseBlNumber", label: "House B/L No", width: 95 },
        { key: "containerNumber", label: "Container No", width: 125 },
        { key: "goodsDescription", label: "Goods Description", width: 140 },
        { key: "packageCount", label: "Packages (CTNS)", width: 80 },
        { key: "grossWeight", label: "Gross Weight (KGS)", width: 100 },
      ],
      truth.cargo.map((c) => ({
        houseBlNumber: c.hbl,
        containerNumber: c.container,
        goodsDescription: c.name,
        packageCount: String(c.packages),
        grossWeight: String(c.weight),
      })),
      "cargo",
    );
  }
  let bytes = await p.save();
  if (truth.layout === "bilingual") {
    const korean: Record<string, string> = {
      "EXPORT DECLARATION CERTIFICATE": "수출신고필증",
      "Declaration No": "수출신고번호",
      Shipper: "송하인",
      Consignee: "수하인",
      Exporter: "수출자",
      "Total Quantity": "수량 합계",
      "Total Packages": "포장 합계",
      "Goods Description": "품명",
      "Quantity Unit": "수량 단위",
    };
    for (const list of drawn)
      for (const c of list) c.text = korean[c.text] ?? c.text;
    for (const c of cells) c.text = korean[c.text] ?? c.text;
    bytes = unicodePdf(drawn);
  }
  const pdf: PdfDocument = {
    id: truth.id,
    fileName: truth.fileName ?? truth.id + ".pdf",
    pages: await extractPdfText(bytes),
  };
  const field = <T extends string | number>(
    key: string,
    value: T,
    preferredPage?: number,
  ): { value: T; evidence: Candidate["evidence"] } => {
    const source = cells.find(
      (c) =>
        c.key === key &&
        (preferredPage === undefined || c.page === preferredPage),
    );
    if (!source) throw new Error("Missing independent truth cell: " + key);
    const page = pdf.pages.find((p) => p.page === source.page)!;
    const block = page.blocks!.find(
      (b) =>
        b.text === source.text &&
        Math.abs(b.x - source.x) < 1 &&
        Math.abs(b.y - (source.y - 9)) < 4,
    );
    if (!block) throw new Error("Missing rendered evaluation cell: " + key);
    return { value, evidence: { page: source.page, blockIds: [block.id] } };
  };
  const wire = emptyShippingWire(truth.type);
  wire.typeEvidence = field(
    "title",
    truth.layout === "bilingual" && truth.type === "export_declaration"
      ? "수출신고필증"
      : title,
  ).evidence;
  for (const [k, v] of Object.entries(truth.roots))
    wire.fields[k] =
      typeof v === "number" ? field("root." + k, v) : field("root." + k, v);
  wire.references = truth.declarations.map((n, i) => ({
    kind: "export_declaration",
    number: field(`ref.${i}`, n),
  }));
  wire.items = truth.items.map((i, index) => {
    const fields = Object.fromEntries(
      itemFieldKeys.map((k) => [k, { value: null, evidence: null }]),
    ) as ShippingWire["items"][number]["fields"];
    fields.goodsDescription = field(`item.${index}.goodsDescription`, i.name);
    if (truth.layout === "wrapped") {
      const a = field(`item.${index}.goodsDescription.wrap`, i.name),
        b = fields.goodsDescription;
      fields.goodsDescription = {
        value: i.name,
        evidence: {
          page: b.evidence!.page,
          blockIds: [...a.evidence!.blockIds, ...b.evidence!.blockIds],
        },
      };
    }
    fields.hsCode = field(`item.${index}.hsCode`, i.hs);
    fields.quantity = field(`item.${index}.quantity`, i.quantity);
    fields.quantityUnit = field(
      "header.item.quantity",
      "PCS",
      fields.quantity.evidence!.page,
    );
    return { fields };
  });
  wire.containers = truth.containers.map((c, i) => ({
    containerNumber: field(`container.${i}.containerNumber`, c.number),
    sealNumber: field(`container.${i}.sealNumber`, c.seal),
    sealNumbers: [field(`container.${i}.sealNumber`, c.seal)],
    packageCount: field(`container.${i}.packageCount`, c.packages),
    packageUnit: field("header.container.packageCount", "CTNS"),
    grossWeight: field(`container.${i}.grossWeight`, c.weight),
    weightUnit: field("header.container.grossWeight", "KGS"),
  }));
  wire.cargoRecords = (truth.cargo ?? []).map((c, i) => {
    const fields = Object.fromEntries(
      cargoFieldKeys.map((k) => [k, { value: null, evidence: null }]),
    ) as ShippingWire["cargoRecords"][number]["fields"];
    for (const [k, v] of Object.entries({
      houseBlNumber: c.hbl,
      containerNumber: c.container,
      goodsDescription: c.name,
      packageCount: c.packages,
      grossWeight: c.weight,
    }))
      fields[k] =
        typeof v === "number"
          ? field(`cargo.${i}.${k}`, v)
          : field(`cargo.${i}.${k}`, v);
    fields.packageUnit = field("header.cargo.packageCount", "CTNS");
    fields.grossWeightUnit = field("header.cargo.grossWeight", "KGS");
    return { fields };
  });
  return {
    truth,
    bytes,
    pdf,
    wire,
    document: groundShipping(wire, pdf, truth.type),
  };
}
export function evaluation33(stage: string): Truth33[] {
  if (stage === "normal")
    return [
      truth33("house_bl", "new-normal-bl", "portrait"),
      truth33("export_declaration", "new-normal-declaration", "multipage"),
      truth33("house_manifest", "new-normal-manifest", "reordered"),
    ];
  if (stage === "mismatch") {
    const bl = truth33("house_bl", "new-mismatch-bl", "wrapped"),
      mf = truth33("house_manifest", "new-mismatch-manifest", "landscape");
    mf.roots.packageCount = 28;
    mf.roots.grossWeight = 330.5;
    mf.containers[0].seal = "SYN-SEAL-WRONG";
    return [bl, mf];
  }
  if (stage === "uncertain") {
    return ["house_bl", "house_manifest"].map((type, i) => {
      const t = truth33(type as ShippingType, `new-uncertain-${i}`, "portrait");
      delete t.roots.houseBlNumber;
      t.declarations = [];
      t.roots.shipmentScope = "partial shipment";
      if (t.cargo) t.cargo[0].hbl = "HB-MISSING";
      return t;
    });
  }
  if (stage === "holdout")
    return ["house_bl", "export_declaration", "house_manifest"].map((type, i) =>
      truth33(type as ShippingType, `holdout-${i}`, "holdout"),
    );
  if (stage === "complex") {
    const a = truth33("house_bl", "complex-bl-a", "portrait", {
      declarations: ["03000-26-0033001", "03000-26-0033002"],
    });
    const b = truth33("house_bl", "complex-bl-b", "landscape");
    a.fileName = "same-name.pdf";
    b.fileName = "same-name.pdf";
    b.roots.houseBlNumber = "HB-33-B";
    b.declarations = ["03000-26-0033003"];
    b.items = [{ name: "Polymer Clip", hs: "0001000000", quantity: 100 }];
    b.containers = [
      { number: "EFGH7654321", seal: "SYN-SEAL-02", packages: 5, weight: 50 },
    ];
    Object.assign(b.roots, { packageCount: 5, grossWeight: 50 });
    const ds = [a.items[0], a.items[1], b.items[0]].map((item, i) => {
      const t = truth33(
        "export_declaration",
        `complex-declaration-${i}`,
        i === 1 ? "reordered" : "portrait",
      );
      t.roots.declarationNumber = `03000-26-003300${i + 1}`;
      t.declarations = [String(t.roots.declarationNumber)];
      t.roots.houseBlNumber = i === 2 ? "HB-33-B" : "HB-33-A";
      t.items = [item];
      t.roots.quantity = item.quantity;
      t.containers = i === 2 ? b.containers : a.containers;
      return t;
    });
    const mf = truth33("house_manifest", "complex-manifest", "landscape");
    delete mf.roots.houseBlNumber;
    mf.declarations = [...a.declarations, ...b.declarations];
    mf.items = [...a.items, ...b.items];
    mf.containers = [...a.containers, ...b.containers];
    mf.roots.packageCount = 35;
    mf.roots.grossWeight = 375.5;
    mf.cargo = [
      {
        hbl: "HB-33-A",
        container: a.containers[0].number,
        name: "Machined Parts",
        packages: 30,
        weight: 325.5,
      },
      {
        hbl: "HB-33-B",
        container: b.containers[0].number,
        name: "Polymer Clip",
        packages: 5,
        weight: 50,
      },
    ];
    return [a, b, ...ds, mf];
  }
  throw new Error("Unknown independent evaluation stage");
}
