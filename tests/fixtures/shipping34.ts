// Independently authored, public synthetic geometry regression. No attachment
// bytes, company data or attachment identifiers are copied into this fixture.
import { unicodePdf } from "./shipping31";
import { extractPdfText } from "../../src/modules/pdf/extract";
import {
  emptyShippingWire,
  groundShipping,
  itemFieldKeys,
  cargoFieldKeys,
} from "../../src/modules/shipping/ground";
import type { ShippingType } from "../../src/modules/shipping/catalog";
import type { PdfDocument } from "../../src/modules/documents/schema";
import {
  shippingWireSchema,
  type ShippingWire,
  type Candidate,
} from "../../src/modules/shipping/ai-schema";
export async function shipping34Fixture(
  type: ShippingType,
  change: {
    wrappedGoods?: boolean;
    volume?: number;
    localGoods?: string;
    goodsSize?: number;
    hbl?: string;
    quantity?: number;
    goods?: string;
    hsCode?: string;
    packages?: number;
    weight?: number;
    seal?: string;
    title?: string;
    house?: boolean;
    partial?: boolean;
  } = {},
) {
  const hbl = change.hbl ?? "HB-SYN-R34-401",
    packages = change.packages ?? 60,
    weight = change.weight ?? 640,
    seal = change.seal ?? "SEAL-SYN-401",
    quantity = change.quantity ?? 720,
    goods = change.goods ?? "GLASS STORAGE JARS",
    hsCode = change.hsCode ?? "7010.90-1000";
  const cells: { text: string; x: number; y: number; size?: number }[] = [],
    borders: { x: number; y: number; width: number; height: number }[] = [];
  const text = (t: string, x: number, y: number, size = 9) => {
    cells.push({ text: t, x, y, size });
    return t;
  };
  const box = (x: number, y: number, width: number, height: number) =>
    borders.push({ x, y, width, height });
  const wire = emptyShippingWire(type) as Omit<
      ShippingWire,
      "fields" | "items" | "cargoRecords"
    > & {
      fields: Record<string, Candidate>;
      items: { fields: Record<string, Candidate> }[];
      cargoRecords: { fields: Record<string, Candidate> }[];
    },
    targets: Record<string, string[]> = {};
  const root = (
    key: string,
    label: string,
    value: string | number,
    x: number,
    y: number,
    w = 230,
  ) => {
    box(x, y, w, 48);
    text(label, x + 6, y + 12, 8);
    const v = text(String(value), x + 7, y + 32);
    targets[key] = [label, v];
  };
  const title =
    change.title ??
    {
      house_bl: "Bill of Lading",
      export_declaration: "수 출 신 고 필 증",
      house_manifest: "(HOUSE MANIFEST)",
    }[type];
  text(title, 210, 32, 16);
  if (type === "house_bl" && change.house !== false) {
    text("Carrier / Forwarder", 400, 49);
    text("House B/L / Ocean Freight", 400, 65);
  }
  root(
    "houseBlNumber",
    type === "house_bl" ? "(11) B/L No." : "2. House B/L 번호",
    hbl,
    30,
    90,
  );
  root("shipper", "Shipper", "Synthetic Supplier Ltd", 290, 90);
  root("consignee", "Consignee", "Synthetic Buyer Ltd", 30, 145);
  root(
    "portOfLoading",
    "7. 선적항",
    type === "export_declaration" ? "KR PUS / BUSAN" : "BUSAN, KOREA",
    290,
    145,
  );
  root("portOfDischarge", "8. 양륙항", "LOS ANGELES, USA", 30, 200);
  root(
    "shipmentScope",
    "Shipment Scope",
    change.partial ? "partial shipment" : "full shipment",
    290,
    200,
  );
  if (type !== "house_bl")
    root("declarationNumber", "수출신고번호", "SYN-DECL-34-401", 30, 255);
  const unit = {
    house_bl: "CARTONS",
    export_declaration: "CT",
    house_manifest: "CTN",
  }[type];
  if (type !== "house_bl") {
    root("packageCount", "총 포장개수", `${packages} ${unit}`, 30, 310, 130);
    root("grossWeight", "총중량", `${weight}.000 KG`, 170, 310, 130);
    root("quantity", "총 수량", `${quantity} EA`, 310, 310, 130);
  }
  const fields: Record<string, string[]> = {};
  if (type === "house_bl") {
    const xs = [30, 160, 280, 435, 550],
      ws = [130, 120, 155, 115, 100];
    xs.forEach((x, i) => box(x, 370, ws[i], 125));
    text("(13) Container No.", 36, 382, 8);
    text("& Seal No.", 36, 394, 8);
    text("(14) No. / Kind", 166, 382, 8);
    text("of Packages", 166, 394, 8);
    text("(16) Description of Goods", 286, 382, 8);
    text("(17) Gross", 441, 382, 8);
    text("Weight", 441, 394, 8);
    if (change.volume !== undefined) {
      text("Measurement", 556, 382, 8);
      text(String(change.volume), 556, 427);
      text("CBM", 600, 427);
    }
    const cn = text("SYN-U3401401", 36, 427);
    const sn = text("SEAL: " + seal, 36, 451);
    const pn = text(String(packages), 166, 427);
    const pu = text(unit, 192, 427);
    const q = text(`(${quantity}`, 166, 452);
    const qu = text("PCS)", 198, 452);
    const g = text(goods, 286, 427);
    text("HS:", 286, 451);
    const hs = text(hsCode, 307, 451);
    const gw = text(`${weight} KGS`, 441, 427);
    fields.goodsDescription = [g];
    fields.hsCode = [hs];
    fields.quantity = [q, qu];
    fields.quantityUnit = [q, qu];
    fields.packageCount = [pn, pu];
    fields.packageUnit = [pu];
    fields.grossWeight = [gw];
    fields.grossWeightUnit = [gw];
    targets.goodsDescription = [g];
    targets.packageCount = [pn, pu];
    targets.packageUnit = [pu];
    targets.grossWeight = [gw];
    targets.grossWeightUnit = [gw];
    targets.quantity = [q, qu];
    targets.quantityUnit = [q, qu];
    wire.containers = [
      {
        containerNumber: { value: "SYN-U3401401", evidence: null },
        sealNumber: { value: seal, evidence: null },
        sealNumbers: [{ value: seal, evidence: null }],
        packageCount: { value: null, evidence: null },
        packageUnit: { value: null, evidence: null },
        grossWeight: { value: null, evidence: null },
        weightUnit: { value: null, evidence: null },
      },
    ];
    targets.cn = [cn];
    targets.sn = [sn];
  } else {
    const xs =
      type === "house_manifest"
        ? [30, 170, 290, 395, 590, 700]
        : [30, 275, 390, 520];
    const ws =
      type === "house_manifest"
        ? [140, 120, 105, 195, 110, 110]
        : [245, 115, 130, 90];
    xs.forEach((x, i) => {
      box(x, 390, ws[i], 30);
      box(x, 420, ws[i], 85);
    });
    const hs = type === "house_manifest";
    const headers = hs
      ? [
          "House B/L 번호",
          "컨테이너 번호",
          "SEAL 번호",
          "품명(영문)",
          "포장수량",
          "총중량(KG)",
        ]
      : ["품명 및 규격", "세번부호 (HS)", "수량/단위", "단가 (USD)"];
    headers.forEach((h, i) => text(h, xs[i] + 25, 407, 8));
    if (hs) {
      const hb = text(hbl, 36, 440),
        cn = text("SYN-U3401401", 176, 440),
        sn = text(seal, 296, 440),
        g = text(change.wrappedGoods ? goods.split(" ").slice(0, 2).join(" ") : goods, 401, 440, change.goodsSize ?? 9),
        pack = text(`${packages} CTN`, 596, 440),
        gw = text(`${weight}.000`, 706, 440);
      const continuation = change.wrappedGoods
        ? text(goods.split(" ").slice(2).join(" "), 401, 453, change.goodsSize ?? 9) : null;
      text(`(HS ${hsCode})`, 401, change.wrappedGoods ? 469 : 456);
      fields.goodsDescription = continuation ? [g, continuation] : [g];
      fields.houseBlNumber = [hb];
      fields.containerNumber = [cn];
      fields.sealNumber = [sn];
      fields.packageCount = [pack];
      fields.packageUnit = [pack];
      fields.grossWeight = [gw];
      fields.grossWeightUnit = ["총중량(KG)"];
      targets.cn = [cn];
      targets.sn = [sn];
      wire.containers = [
        {
          containerNumber: { value: "SYN-U3401401", evidence: null },
          sealNumber: { value: seal, evidence: null },
          sealNumbers: [{ value: seal, evidence: null }],
          packageCount: { value: packages, evidence: null },
          packageUnit: { value: "CTN", evidence: null },
          grossWeight: { value: weight, evidence: null },
          weightUnit: { value: "KG", evidence: null },
        },
      ];
    } else {
      const g = text(change.localGoods ?? "유리 보관 용기", 36, 440),
        eng = text(goods, 36, 454),
        hs = text(hsCode, 281, 440),
        qty = text(`${quantity} EA`, 396, 440);
      fields.goodsDescription = [g, eng];
      fields.hsCode = [hs];
      fields.quantity = [qty];
      fields.quantityUnit = [qty];
    }
  }
  const bytes = unicodePdf([cells], {
    borders: [borders],
    sizes: [[type === "house_manifest" ? 842 : 700, 842]],
  });
  const pdf: PdfDocument = {
    id: "synthetic34-" + type,
    fileName: type + "-independent.pdf",
    pages: await extractPdfText(bytes, undefined, false, true),
  };
  const cite = (ts: string[], last = false): Candidate["evidence"] => ({
    page: 1,
    blockIds: ts.map((t) => {
      const bs = pdf.pages[0].blocks!.filter((b) => b.text === t);
      const b = last ? bs.at(-1) : bs[0];
      if (!b) throw Error("Synthetic citation missing");
      return b.id;
    }),
  });
  wire.typeEvidence = cite([
    title,
    ...(type === "house_bl" && change.house !== false
      ? ["House B/L / Ocean Freight"]
      : []),
  ]);
  const val: Record<string, string | number> = {
    houseBlNumber: hbl,
    shipper: "Synthetic Supplier Ltd",
    consignee: "Synthetic Buyer Ltd",
    portOfLoading:
      type === "export_declaration" ? "KR PUS / BUSAN" : "BUSAN, KOREA",
    portOfDischarge: "LOS ANGELES, USA",
    shipmentScope: change.partial ? "partial shipment" : "full shipment",
    declarationNumber: "SYN-DECL-34-401",
    packageCount: packages,
    packageUnit: unit,
    grossWeight: weight,
    grossWeightUnit: type === "house_bl" ? "KGS" : "KG",
    quantity,
    quantityUnit: type === "house_bl" ? "PCS" : "EA",
    goodsDescription: goods,
    hsCode,
  };
  for (const [k, ts] of Object.entries(targets))
    if (wire.fields[k]) wire.fields[k] = { value: val[k], evidence: cite(ts) };
  for (const [number, unitKey] of [
    ["packageCount", "packageUnit"],
    ["grossWeight", "grossWeightUnit"],
    ["quantity", "quantityUnit"],
  ] as const)
    if (targets[number])
      wire.fields[unitKey] = {
        value: val[unitKey],
        evidence: cite(targets[unitKey] ?? targets[number]),
      };
  const row = Object.fromEntries(
    (type === "house_manifest" ? cargoFieldKeys : itemFieldKeys).map((k) => [
      k,
      { value: null, evidence: null },
    ]),
  ) as Record<string, Candidate>;
  for (const [k, ts] of Object.entries(fields)) {
    let value = val[k];
    if (k === "goodsDescription" && type === "export_declaration")
      value = (change.localGoods ?? "유리 보관 용기") + " " + goods;
    if (k === "containerNumber") value = "SYN-U3401401";
    if (k === "sealNumber") value = seal;
    if (k === "packageUnit") value = unit;
    if (k === "grossWeightUnit") value = type === "house_bl" ? "KGS" : "KG";
    row[k] = { value, evidence: cite(ts, true) };
  }
  if (type === "house_manifest") wire.cargoRecords = [{ fields: row }];
  else wire.items = [{ fields: row }];
  for (const c of wire.containers) {
    c.containerNumber.evidence = cite(targets.cn, true);
    c.sealNumber.evidence = cite(targets.sn, true);
    c.sealNumbers[0].evidence = cite(targets.sn, true);
    if (type === "house_manifest") {
      c.packageCount.evidence = cite(fields.packageCount, true);
      c.packageUnit.evidence = cite(fields.packageUnit, true);
      c.grossWeight.evidence = cite(fields.grossWeight, true);
      c.weightUnit.evidence = cite(fields.grossWeightUnit, true);
    }
  }
  return {
    pdf,
    wire: shippingWireSchema.parse(wire),
    bytes,
    document: groundShipping(wire, pdf, type),
  };
}
