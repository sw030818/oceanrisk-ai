// Independent public fixtures: vector form cells + fully enumerated table rows.
import { unicodePdf } from "./shipping31";
import { extractPdfText } from "../../src/modules/pdf/extract";
import {
  emptyShippingWire,
  groundShipping,
  itemFieldKeys,
  cargoFieldKeys,
} from "../../src/modules/shipping/ground";
import {
  shippingWireSchema,
  type Candidate,
} from "../../src/modules/shipping/ai-schema";
import type { ShippingType } from "../../src/modules/shipping/catalog";
export interface Row35 {
  name: string;
  hs?: string;
  qty?: number;
  unit?: string;
  packages?: number;
  gross?: number;
  cn?: string;
  seal?: string;
  hbl?: string;
}
export async function fixture35(
  type: ShippingType,
  options: {
    id?: string;
    hbl?: string;
    declaration?: string;
    declarationRefs?: string[];
    scope?: string;
    notice?: string;
    rows?: Row35[];
    containers?: Row35[];
    cargos?: Row35[];
    totals?: { quantity?: number; packageCount?: number; grossWeight?: number };
    omitRows?: number[];
  } = {},
) {
  const hbl = options.hbl ?? "HB-SYN-35-A",
    id = options.id ?? "syn35-" + type,
    rows = options.rows ?? [
      {
        name: "SYNTHETIC METAL BOTTLE 600ML",
        hs: "7323.93-0000",
        qty: 720,
        packages: 60,
        gross: 640,
      },
    ],
    cells: { text: string; x: number; y: number; size?: number }[] = [],
    borders: { x: number; y: number; width: number; height: number }[] = [],
    wire = emptyShippingWire(type);
  const targets: {
    candidate: Candidate;
    tokens: { text: string; x: number; y: number }[];
  }[] = [];
  const put = (text: string, x: number, y: number, size = 8) => {
    const t = { text, x, y, size };
    cells.push(t);
    return t;
  };
  const box = (x: number, y: number, width: number, height: number) =>
    borders.push({ x, y, width, height });
  put(
    {
      house_bl: "HOUSE BILL OF LADING",
      export_declaration: "EXPORT DECLARATION CERTIFICATE",
      house_manifest: "HOUSE MANIFEST",
    }[type],
    190,
    28,
    16,
  );
  let ri = 0;
  const root = (key: string, label: string, value: string | number) => {
    const x = 20 + (ri % 3) * 260,
      y = 65 + Math.floor(ri++ / 3) * 45;
    box(x, y, 250, 42);
    const l = put(label, x + 5, y + 11, 7),
      v = put(String(value), x + 5, y + 30);
    const c = { value, evidence: null };
    if (wire.fields[key]) wire.fields[key] = c as (typeof wire.fields)[string];
    targets.push({ candidate: c, tokens: [l, v] });
    return c;
  };
  root("houseBlNumber", "House B/L No", hbl);
  root("shipper", "Shipper", "SYNTHETIC EXPORTER LTD.");
  root("consignee", "Consignee", "SYNTHETIC RECEIVER LTD.");
  root("portOfLoading", "Port of Loading", "BUSAN, KOREA");
  root("portOfDischarge", "Port of Discharge", "LOS ANGELES, USA");
  if (type === "export_declaration") {
    root(
      "declarationNumber",
      "수출신고번호",
      options.declaration ?? "DECL-SYN-35-A",
    );
    root("exporter", "Exporter", "SYNTHETIC EXPORTER LTD.");
  }
  if (options.scope) root("shipmentScope", "Shipment Scope", options.scope);
  for (const n of options.declarationRefs ?? []) {
    const candidate = root("referenceNumber", "수출신고번호", n);
    wire.references.push({
      kind: "export_declaration",
      number: candidate as {
        value: string | null;
        evidence: Candidate["evidence"];
      },
    });
  }
  for (const [k, n] of Object.entries(options.totals ?? {})) {
    const unit =
        k === "quantity" ? "PCS" : k === "packageCount" ? "CTNS" : "KG",
      u =
        k === "quantity"
          ? "quantityUnit"
          : k === "packageCount"
            ? "packageUnit"
            : "grossWeightUnit";
    const label =
      k === "quantity"
        ? "Total Quantity"
        : k === "packageCount"
          ? "Total Packages"
          : "Total Gross Weight";
    const c = root(k, label, n);
    wire.fields[u] = { value: unit, evidence: null };
    const t = targets.at(-1)!;
    const p = t.tokens[1];
    const v = put(unit, p.x + 65, p.y);
    targets.push({ candidate: wire.fields[u], tokens: [v] });
    t.tokens.push(v);
    c.value = n;
  }
  const table = (
    data: Row35[],
    kind: "item" | "container" | "cargo",
    y: number,
  ) => {
    const columns =
      kind === "item"
        ? ([
            ["goodsDescription", "Description of Goods", 205],
            ["hsCode", "HS Code", 100],
            ["quantity", "QTY", 75],
            ["quantityUnit", "Unit", 55],
            ["packageCount", "Packages", 85],
            ["packageUnit", "Package Unit", 65],
            ["grossWeight", "Gross Weight", 105],
            ["grossWeightUnit", "Weight Unit", 85],
          ] as const)
        : kind === "container"
          ? ([
              ["containerNumber", "Container No", 190],
              ["sealNumber", "Seal No", 190],
              ["packageCount", "Packages", 100],
              ["packageUnit", "Package Unit", 90],
              ["grossWeight", "Gross Weight", 130],
              ["weightUnit", "Weight Unit", 80],
            ] as const)
          : ([
              ["houseBlNumber", "House B/L No", 125],
              ["containerNumber", "Container No", 115],
              ["sealNumber", "Seal No", 105],
              ["goodsDescription", "Description of Goods", 170],
              ["packageCount", "Packages", 55],
              ["packageUnit", "Package Unit", 60],
              ["grossWeight", "Gross Weight", 60],
              ["grossWeightUnit", "Weight Unit", 55],
              ["quantity", "QTY", 50],
              ["quantityUnit", "Unit", 40],
            ] as const);
    let x = 20;
    for (const [key, label, width] of columns) {
      box(x, y, width, 25);
      put(label, x + 4, y + 15, 6);
      data.forEach((r, i) => {
        const yy = y + 25 + i * 34;
        box(x, yy, width, 34);
        const values: Record<string, string | number | undefined> = {
          goodsDescription: r.name,
          hsCode: r.hs,
          quantity: r.qty,
          quantityUnit: r.qty !== undefined ? (r.unit ?? "PCS") : undefined,
          packageCount: r.packages,
          packageUnit: r.packages !== undefined ? "CTNS" : undefined,
          grossWeight: r.gross,
          grossWeightUnit: r.gross !== undefined ? "KG" : undefined,
          weightUnit: r.gross !== undefined ? "KG" : undefined,
          containerNumber: r.cn,
          sealNumber: r.seal,
          houseBlNumber: r.hbl ?? hbl,
        };
        const value = values[key];
        if (value !== undefined) put(String(value), x + 4, yy + 18, 7);
      });
      x += width;
    }
    data.forEach((r, i) => {
      const vals: Record<string, string | number | undefined> = {
        goodsDescription: r.name,
        hsCode: r.hs,
        quantity: r.qty,
        quantityUnit: r.qty !== undefined ? (r.unit ?? "PCS") : undefined,
        packageCount: r.packages,
        packageUnit: r.packages !== undefined ? "CTNS" : undefined,
        grossWeight: r.gross,
        grossWeightUnit: r.gross !== undefined ? "KG" : undefined,
        weightUnit: r.gross !== undefined ? "KG" : undefined,
        containerNumber: r.cn,
        sealNumber: r.seal,
        houseBlNumber: r.hbl ?? hbl,
      };
      const fs = Object.fromEntries(
        (kind === "item"
          ? itemFieldKeys
          : kind === "cargo"
            ? cargoFieldKeys
            : [
                "containerNumber",
                "sealNumber",
                "packageCount",
                "packageUnit",
                "grossWeight",
                "weightUnit",
              ]
        ).map((k) => [k, { value: vals[k] ?? null, evidence: null }]),
      ) as Record<string, Candidate>;
      let xx = 20;
      for (const [key, , width] of columns) {
        if (fs[key]?.value != null)
          targets.push({
            candidate: fs[key],
            tokens: [
              {
                text: String(fs[key].value),
                x: xx + 4,
                y: y + 25 + i * 34 + 18,
              },
            ],
          });
        xx += width;
      }
      if (kind === "item" && !options.omitRows?.includes(i))
        wire.items.push({ fields: fs } as (typeof wire.items)[number]);
      if (kind === "cargo")
        wire.cargoRecords.push({
          fields: fs,
        } as (typeof wire.cargoRecords)[number]);
      if (kind === "container")
        wire.containers.push({
          ...fs,
          sealNumbers: fs.sealNumber.value !== null ? [fs.sealNumber] : [],
        } as (typeof wire.containers)[number]);
    });
  };
  table(rows, "item", 320);
  if (options.containers) table(options.containers, "container", 570);
  if (options.cargos) table(options.cargos, "cargo", 660);
  if (options.notice) put(options.notice, 30, 810);
  const bytes = unicodePdf([cells], {
      borders: [borders],
      sizes: [[Math.max(842, ...borders.map((b) => b.x + b.width + 20)), 842]],
    }),
    pdf = {
      id,
      fileName: id + ".pdf",
      pages: await extractPdfText(bytes, undefined, false, true),
    };
  const block = (t: { text: string; x: number; y: number }) =>
    pdf.pages[0]
      .blocks!.filter((b) => b.text === t.text)
      .sort(
        (a, b) =>
          Math.abs(a.x - t.x) +
          Math.abs(a.y - t.y) -
          (Math.abs(b.x - t.x) + Math.abs(b.y - t.y)),
      )[0];
  wire.typeEvidence = { page: 1, blockIds: [block(cells[0]).id] };
  for (const t of targets)
    t.candidate.evidence = {
      page: 1,
      blockIds: [...new Set(t.tokens.map((v) => block(v).id))],
    };
  const parsed = shippingWireSchema.parse(wire);
  return {
    id,
    pdf,
    bytes,
    wire: parsed,
    document: groundShipping(parsed, pdf, type),
  };
}
