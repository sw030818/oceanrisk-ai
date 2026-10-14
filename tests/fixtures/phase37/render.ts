// New generators, not copies/coordinate edits of the three private regressions.
// This module renders only a document spec. It has no verdict/holdout access.
import { unicodePdf } from "../shipping31";
import { extractPdfText } from "../../../src/modules/pdf/extract";
import {
  emptyShippingWire,
  groundShipping,
  itemFieldKeys,
} from "../../../src/modules/shipping/ground";
import {
  shippingWireSchema,
  type Candidate,
} from "../../../src/modules/shipping/ai-schema";
import type { ShippingType } from "../../../src/modules/shipping/catalog";
import type { Layout37 } from "./development";
export interface Document37 {
  id: string;
  type: ShippingType;
  layout: Layout37;
  language: "en" | "ko" | "mixed";
  hbl?: string;
  declaration: string;
  declarations?: string[];
  loading: string;
  discharge: string;
  rows: { name: string; hs: string; quantity: number; unit: string }[];
  shipper?: string;
  consignee?: string;
  containerRows?: {
    number: string;
    seal: string;
    packages: number;
    gross: number;
  }[];
  packages: number;
  gross: number;
  container: string;
  seal: string;
  scope?: string;
  unsupported?: boolean;
  omitRows?: number[];
}
type Text = { text: string; x: number; y: number; size?: number };
type Box = { x: number; y: number; width: number; height: number };
const labels: Record<string, [string, string]> = {
  exporter: ["Exporter", "수출자"],
  houseBlNumber: ["House B/L No", "하우스 B/L 번호"],
  declarationNumber: ["Export Declaration No", "수출신고번호"],
  shipper: ["Shipper", "송하인"],
  consignee: ["Consignee", "수하인"],
  portOfLoading: ["Port of Loading", "선적항"],
  portOfDischarge: ["Port of Discharge", "양하항"],
  shipmentScope: ["Shipment Scope", "선적 범위"],
  quantity: ["Total Quantity", "총 수량"],
  quantityUnit: ["Quantity Unit", "수량 단위"],
  packageCount: ["Total Packages", "총 포장개수"],
  packageUnit: ["Package Unit", "포장 단위"],
  grossWeight: ["Total Gross Weight", "총중량"],
  grossWeightUnit: ["Gross Weight Unit", "총중량 단위"],
};
export async function render37(s: Document37) {
  const pages: Text[][] = [[]],
    borders: Box[][] = [[]],
    wire = emptyShippingWire(s.type);
  const goldItems: typeof wire.items = [];
  const targets: { c: Candidate; page: number; tokens: Text[] }[] = [];
  const put = (text: string, x: number, y: number, size = 8, page = 0) => {
    const t = { text, x, y, size };
    pages[page].push(t);
    return t;
  };
  const box = (x: number, y: number, width: number, height: number, page = 0) =>
    borders[page].push({ x, y, width, height });
  const title = s.unsupported
    ? "MASTER BILL OF LADING"
    : s.language === "ko"
      ? {
          house_bl: "HOUSE 선하증권",
          export_declaration: "수출신고필증",
          house_manifest: "HOUSE 적하목록",
        }[s.type]
      : {
          house_bl: "HOUSE BILL OF LADING",
          export_declaration: "EXPORT DECLARATION CERTIFICATE",
          house_manifest: "HOUSE MANIFEST",
        }[s.type];
  const heading = put(title, 48, 34, 16);
  wire.typeEvidence = { page: 1, blockIds: [] };
  const localized = (k: string) =>
    s.language === "en"
      ? labels[k][0]
      : s.language === "ko"
        ? labels[k][1]
        : labels[k].join(" / ");
  let index = 0;
  const root = (key: string, value: string | number, override?: string) => {
    const label = override ?? localized(key);
    const i = index++,
      card = s.layout !== "ledger";
    const x =
        s.layout === "bilingual"
          ? 35 + (i % 2) * 365
          : s.layout === "reversed"
            ? 480 - (i % 3) * 225
            : 35 + (i % 3) * 225,
      y =
        s.layout === "bilingual"
          ? 68 + Math.floor(i / 2) * 37
          : 68 + Math.floor(i / 3) * 47;
    if (card)
      box(
        x,
        y,
        s.layout === "bilingual" ? 345 : 215,
        s.layout === "bilingual" ? 35 : 43,
      );
    const ts = card
      ? [put(label, x + 7, y + 11, 7), put(String(value), x + 7, y + 31)]
      : [put(label + ": " + value, x, y + 20, 7)];
    const c = { value, evidence: null };
    if (key in wire.fields) wire.fields[key] = c as never;
    targets.push({ c, page: 0, tokens: ts });
    return c;
  };
  if (s.hbl) root("houseBlNumber", s.hbl);
  if (s.type === "export_declaration") root("declarationNumber", s.declaration);
  root("shipper", s.shipper ?? "SYNTHETIC HORIZON EXPORT CO");
  if (s.type === "export_declaration")
    root("exporter", s.shipper ?? "SYNTHETIC HORIZON EXPORT CO");
  root("consignee", s.consignee ?? "SYNTHETIC NORTHLAND IMPORT CO");
  root("portOfLoading", s.loading);
  root("portOfDischarge", s.discharge);
  if (s.scope) root("shipmentScope", s.scope);
  for (const ref of s.declarations ?? []) {
    const c = root("declarationNumber", ref);
    wire.references.push({ kind: "export_declaration", number: c as never });
  }
  for (const [k, v, u, uk] of [
    [
      "quantity",
      s.rows.reduce((n, r) => n + r.quantity, 0),
      "PCS",
      "quantityUnit",
    ],
    ["packageCount", s.packages, "CTNS", "packageUnit"],
    ["grossWeight", s.gross, "KG", "grossWeightUnit"],
  ] as const) {
    root(k, v);
    root(uk, u);
  }
  // New table order/widths, with a free-text ledger variant and native cells.
  const definitions = [
    ["goodsDescription", "Description of Goods", "품명 및 규격", 235],
    ["hsCode", "HS Code", "세번부호 (HS)", 105],
    ["quantity", "QTY", "수량", 70],
    ["quantityUnit", "Unit", "수량 단위", 60],
  ] as const;
  const definitionsForLayout =
    s.layout === "header-units"
      ? definitions.filter((d) => d[0] !== "quantityUnit")
      : definitions;
  const unitHeaders: Text[] = [];
  const cols =
    s.layout === "reversed"
      ? [definitions[2], definitions[3], definitions[1], definitions[0]]
      : [...definitionsForLayout];
  let y = 425,
    page = 0;
  const header = (p: number, top: number) => {
    let x = 35;
    for (const [key, en, ko, w] of cols) {
      if (s.layout !== "ledger") box(x, top, w, 27, p);
      const label =
        s.language === "en" ? en : s.language === "ko" ? ko : en + " / " + ko;
      const t = put(
        label +
          (s.layout === "header-units" && key === "quantity" ? " (PCS)" : ""),
        x + 5,
        top + 16,
        7,
        p,
      );
      if (key === "quantity") unitHeaders[p] = t;
      x += w;
    }
  };
  header(0, y);
  y += 27;
  for (const [i, row] of s.rows.entries()) {
    if (s.layout === "continued" && i === 1) {
      pages.push([]);
      borders.push([]);
      page = 1;
      y = 90;
      put("CONTINUED / 계속", 35, 35, 12, page);
      header(page, y);
      y += 27;
    }
    const fs = Object.fromEntries(
      itemFieldKeys.map((k) => [k, { value: null, evidence: null }]),
    ) as Record<string, Candidate>;
    const values: Record<string, string | number> = {
      goodsDescription: row.name,
      hsCode: row.hs,
      quantity: row.quantity,
      quantityUnit: row.unit,
    };
    let x = 35;
    for (const [k, , , w] of cols) {
      if (s.layout !== "ledger") box(x, y, w, 36, page);
      const t = put(String(values[k]), x + 5, y + 22, 7, page);
      fs[k] = { value: values[k], evidence: null };
      targets.push({ c: fs[k], page, tokens: [t] });
      x += w;
    }
    if (s.layout === "header-units") {
      fs.quantityUnit = { value: row.unit, evidence: null };
      targets.push({ c: fs.quantityUnit, page, tokens: [unitHeaders[page]] });
    }
    goldItems.push({ fields: fs } as never);
    if (!s.omitRows?.includes(i)) wire.items.push({ fields: fs } as never);
    y += 36;
  }
  // Container and seal in a separate closed table; data ownership is explicit.
  const cp = page;
  let cy = Math.max(y + 35, 570);
  for (const container of s.containerRows ?? [
    { number: s.container, seal: s.seal, packages: s.packages, gross: s.gross },
  ]) {
    const ct = [
      ["containerNumber", "Container No", 200, container.number],
      ["sealNumber", "Seal No", 180, container.seal],
      ["packageCount", "Packages", 100, container.packages],
      ["packageUnit", "Package Unit", 80, "CTNS"],
      ["grossWeight", "Gross Weight", 100, container.gross],
      ["weightUnit", "Weight Unit", 75, "KG"],
    ] as const;
    const cf: Record<string, Candidate> = {};
    let cx = 35;
    for (const [k, label, w, val] of ct) {
      box(cx, cy, w, 25, cp);
      box(cx, cy + 25, w, 35, cp);
      put(label, cx + 4, cy + 15, 7, cp);
      const t = put(String(val), cx + 4, cy + 47, 7, cp);
      cf[k] = { value: val, evidence: null };
      targets.push({ c: cf[k], page: cp, tokens: [t] });
      cx += w;
    }
    wire.containers.push({ ...cf, sealNumbers: [cf.sealNumber] } as never);
    cy += 70;
  }
  if (s.hbl && s.type === "export_declaration") {
    const c = wire.fields.houseBlNumber;
    wire.references.push({ kind: "house_bl", number: c as never });
  }
  const bytes = unicodePdf(pages, {
    borders,
    sizes: pages.map(() => [900, 842]),
  });
  const pdf = {
    id: s.id,
    fileName: s.id + ".pdf",
    pages: await extractPdfText(bytes, undefined, false, true),
  };
  const find = (t: Text, p: number) => {
    const b = pdf.pages[p]
      .blocks!.filter((b) => b.text === t.text)
      .sort(
        (a, b) =>
          Math.abs(a.x - t.x) +
          Math.abs(a.y + a.height - t.y) -
          Math.abs(b.x - t.x) -
          Math.abs(b.y + b.height - t.y),
      )[0];
    if (!b) throw Error("Synthetic text not rendered");
    return b.id;
  };
  wire.typeEvidence = { page: 1, blockIds: [find(heading, 0)] };
  for (const t of targets)
    t.c.evidence = {
      page: t.page + 1,
      blockIds: [...new Set(t.tokens.map((v) => find(v, t.page)))],
    };
  if (s.unsupported) {
    wire.type = "unknown";
    wire.typeEvidence = null;
  }
  const parsed = shippingWireSchema.parse(wire);
  return {
    bytes,
    pdf,
    wire: parsed,
    document: groundShipping(parsed, pdf, s.type),
    goldDocument: groundShipping(
      shippingWireSchema.parse({ ...parsed, items: goldItems }),
      pdf,
      s.type,
    ),
  };
}
