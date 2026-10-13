// Searchable, synthetic-only PDF. Explicit Unicode CMap supports Korean labels;
// no customs seal, issuer identity, real company document or business PDF.
import { extractPdfText } from "../../src/modules/pdf/extract";
import {
  emptyShippingWire,
  itemFieldKeys,
  cargoFieldKeys,
  groundShipping,
} from "../../src/modules/shipping/ground";
import type { ShippingType } from "../../src/modules/shipping/catalog";
import type {
  Candidate,
  ShippingWire,
} from "../../src/modules/shipping/ai-schema";
import type { PdfDocument } from "../../src/modules/documents/schema";
type Cell = { text: string; x: number; y: number; size?: number };
export function unicodePdf(
  pages: Cell[][],
  options: {
    borders?: { x: number; y: number; width: number; height: number }[][];
    sizes?: [number, number][];
  } = {},
): Uint8Array {
  const objects: string[] = [];
  const obj = (text: string) => {
    objects.push(text);
    return objects.length;
  };
  const catalog = obj(""),
    tree = obj("");
  const cmap =
    "/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /SyntheticUCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n1 beginbfrange\n<0000> <FFFF> <0000>\nendbfrange\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend";
  const cmapId = obj(
    `<< /Length ${Buffer.byteLength(cmap)} >>\nstream\n${cmap}\nendstream`,
  );
  const descriptor = obj(
    "<< /Type /FontDescriptor /FontName /SyntheticUnicode /Flags 4 /FontBBox [0 -200 1000 1000] /ItalicAngle 0 /Ascent 800 /Descent -200 /CapHeight 700 /StemV 80 >>",
  );
  const descendant = obj(
    `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /SyntheticUnicode /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptor} 0 R /DW 500 /CIDToGIDMap /Identity >>`,
  );
  const font = obj(
    `<< /Type /Font /Subtype /Type0 /BaseFont /SyntheticUnicode /Encoding /Identity-H /DescendantFonts [${descendant} 0 R] /ToUnicode ${cmapId} 0 R >>`,
  );
  const ids: number[] = [];
  for (const [pageIndex, cells] of pages.entries()) {
    const [pageWidth, pageHeight] = options.sizes?.[pageIndex] ?? [842, 842];
    const commands =
      (options.borders?.[pageIndex] ?? [])
        .map(
          (c) =>
            `${c.x} ${pageHeight - c.y - c.height} ${c.width} ${c.height} re S`,
        )
        .join("\n") +
      "\n" +
      cells
        .map((c) => {
          const hex = [...c.text]
            .map((char) => char.charCodeAt(0).toString(16).padStart(4, "0"))
            .join("");
          return `BT /F1 ${c.size ?? 9} Tf 1 0 0 1 ${c.x} ${pageHeight - c.y} Tm <${hex}> Tj ET`;
        })
        .join("\n");
    const stream = obj(
      `<< /Length ${Buffer.byteLength(commands)} >>\nstream\n${commands}\nendstream`,
    );
    ids.push(
      obj(
        `<< /Type /Page /Parent ${tree} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${stream} 0 R >>`,
      ),
    );
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${tree} 0 R >>`;
  objects[tree - 1] =
    `<< /Type /Pages /Count ${ids.length} /Kids [${ids.map((i) => `${i} 0 R`).join(" ")}] >>`;
  let body = "%PDF-1.7\n";
  const offsets = [0];
  objects.forEach((text, i) => {
    offsets.push(Buffer.byteLength(body));
    body += `${i + 1} 0 obj\n${text}\nendobj\n`;
  });
  const start = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
    .join(
      "",
    )}trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(body));
}
export async function shipping31Fixture(
  type: ShippingType,
  options: {
    missing?: boolean;
    badEvidence?: boolean;
    extraSeals?: boolean;
  } = {},
) {
  const title = {
    house_bl: "HOUSE BILL OF LADING",
    export_declaration: "수출신고필증",
    house_manifest: "HOUSE MANIFEST",
  }[type];
  const first: Cell[] = [
    { text: title, x: 35, y: 32, size: 14 },
    { text: "SYNTHETIC TEST ONLY / 합성 테스트 자료", x: 35, y: 48 },
  ];
  const roots: Record<string, [string, string | number]> = {
    houseBlNumber: ["House B/L No:", "HB-2026-001"],
    shipper: ["Shipper:", "Pacific Export Ltd."],
    consignee: ["Consignee:", "Harbor Import Ltd."],
    notifyParty: ["Notify Party:", "Notify Logistics Ltd."],
    vessel: ["Vessel:", "TEST OCEAN"],
    voyage: ["Voyage:", "V-010"],
    goodsDescription: ["Goods Description:", "Steel Bolts"],
    packageCount: ["Total Packages:", 500],
    packageUnit: ["Package Unit:", "CTNS"],
    grossWeight: ["Total Gross Weight:", 12340],
    grossWeightUnit: ["Gross Weight Unit:", "KG"],
    portOfLoading: ["Port of Loading:", "BUSAN"],
    portOfDischarge: ["Port of Discharge:", "LONG BEACH"],
    declarationNumber: ["수출신고번호:", "03000-26-0012345"],
    declarationDate: ["신고일자:", "2026-10-13"],
    exporter: ["수출자:", "합성수출 주식회사"],
    declarant: ["신고인:", "합성관세사"],
    netWeight: ["총 순중량:", 12000],
    netWeightUnit: ["순중량 단위:", "KG"],
  };
  const allowed =
    type === "export_declaration"
      ? [
          "declarationNumber",
          "declarationDate",
          "exporter",
          "declarant",
          "netWeight",
          "netWeightUnit",
          "grossWeight",
          "grossWeightUnit",
        ]
      : [
          "houseBlNumber",
          "shipper",
          "consignee",
          "notifyParty",
          "vessel",
          "voyage",
          "goodsDescription",
          "packageCount",
          "packageUnit",
          "grossWeight",
          "grossWeightUnit",
          "portOfLoading",
          "portOfDischarge",
        ];
  const rootTexts: Record<string, string> = {};
  allowed.forEach((key, i) => {
    if (
      options.missing &&
      ["houseBlNumber", "declarationNumber", "shipper", "exporter"].includes(
        key,
      )
    )
      return;
    const [label, value] = roots[key];
    const printed =
      typeof value === "number" ? value.toLocaleString("en-US") : value;
    const text = label + " " + printed;
    rootTexts[key] = text;
    first.push({ text, x: 35 + (i % 2) * 380, y: 78 + Math.floor(i / 2) * 24 });
  });
  const second: Cell[] = [
    {
      text: "SYNTHETIC DETAIL TABLES / 합성 세부 내역",
      x: 35,
      y: 30,
      size: 12,
    },
  ];
  const itemHeaders = [
    ["품명", 35],
    ["HS Code", 240],
    ["신고수량 (PCS)", 350],
    ["단위", 435],
    ["포장개수", 480],
    ["포장단위", 540],
    ["순중량 (KG)", 615],
    ["총중량 (KG)", 715],
  ] as const;
  for (const [text, x] of itemHeaders) second.push({ text, x, y: 65 });
  const names = [
    ["Steel Bolts", "Precision Grade"],
    ["Brass Nuts", "Industrial Grade"],
  ];
  names.forEach((lines, i) => {
    const y = 100 + i * 55;
    second.push(
      { text: lines[0], x: 35, y },
      { text: lines[1], x: 35, y: y + 10 },
      { text: i ? "0070000000" : "0303890000", x: 240, y },
      { text: i ? "250" : "500", x: 350, y },
      { text: "PCS", x: 435, y },
      { text: i ? "10" : "20", x: 480, y },
      { text: "CTNS", x: 540, y },
      { text: i ? "200" : "300", x: 615, y },
      { text: i ? "220" : "320", x: 715, y },
    );
  });
  const containerHeaders = [
    ["Container No", 35],
    ["Seal No", 200],
    ["Packages", 330],
    ["Package Unit", 435],
    ["Gross Weight (KG)", 540],
    ["Weight Unit", 700],
  ] as const;
  for (const [text, x] of containerHeaders) second.push({ text, x, y: 230 });
  for (let i = 0; i < 2; i++)
    second.push(
      { text: i ? "EFGH7654321" : "ABCD1234567", x: 35, y: 265 + i * 35 },
      { text: i ? "SEAL-002" : "SEAL-001", x: 200, y: 265 + i * 35 },
      { text: "500", x: 330, y: 265 + i * 35 },
      { text: "CTNS", x: 435, y: 265 + i * 35 },
      { text: i ? "340" : "320", x: 540, y: 265 + i * 35 },
      { text: "KG", x: 700, y: 265 + i * 35 },
    );
  const cargoHeaders = [
    ["House B/L No", 35],
    ["Container No", 190],
    ["Goods Description", 340],
    ["Packages", 560],
    ["Gross Weight (KG)", 660],
  ] as const;
  if (options.extraSeals) second.push({ text: "SEAL-003", x: 245, y: 265 });
  for (const [text, x] of cargoHeaders) second.push({ text, x, y: 375 });
  for (let i = 0; i < 2; i++)
    second.push(
      { text: i ? "HB-2026-002" : "HB-2026-001", x: 35, y: 410 + i * 35 },
      { text: i ? "EFGH7654321" : "ABCD1234567", x: 190, y: 410 + i * 35 },
      { text: i ? "Brass Nuts" : "Steel Bolts", x: 340, y: 410 + i * 35 },
      { text: i ? "10" : "20", x: 560, y: 410 + i * 35 },
      { text: i ? "340" : "320", x: 660, y: 410 + i * 35 },
    );
  second.push(
    { text: "수출신고번호: 03000-26-0012345", x: 35, y: 525 },
    { text: "수출신고번호: 03000-26-0012346", x: 35, y: 550 },
  );
  const bytes = unicodePdf([first, second]),
    pdf: PdfDocument = {
      id: `synthetic-${type}`,
      fileName: `synthetic31-${type}.pdf`,
      pages: await extractPdfText(bytes),
    };
  function field<T extends string | number>(
    value: T,
    page: number,
    texts: string[],
    row?: number,
  ): { value: T; evidence: Candidate["evidence"] } {
    const blocks = pdf.pages[page - 1].blocks!;
    const selected = texts.map((text) => {
      const found = blocks.filter((b) => b.text === text);
      const result =
        row === undefined
          ? found[0]
          : found.find((b) => Math.abs(b.y - (row - 9 * 0.8)) < 10);
      if (!result) throw new Error("Synthetic PDF block not found: " + text);
      return result.id;
    });
    return { value, evidence: { page, blockIds: selected } };
  }
  const wire = emptyShippingWire(type);
  wire.typeEvidence = field(title, 1, [title]).evidence;
  for (const [key, text] of Object.entries(rootTexts)) {
    const value = roots[key][1];
    wire.fields[key] =
      typeof value === "number"
        ? field(value, 1, [text])
        : field(value, 1, [text]);
  }
  if (type === "export_declaration" || type === "house_bl")
    wire.items = names.map((lines, i) => {
      const y = 100 + i * 55,
        fields: ShippingWire["items"][number]["fields"] = Object.fromEntries(
          itemFieldKeys.map((k) => [k, { value: null, evidence: null }]),
        );
      fields.goodsDescription = field(lines.join(" "), 2, lines, y);
      fields.hsCode = field(
        i ? "0070000000" : "0303890000",
        2,
        [i ? "0070000000" : "0303890000"],
        y,
      );
      fields.quantity = field(i ? 250 : 500, 2, [i ? "250" : "500"], y);
      fields.quantityUnit = field("PCS", 2, ["PCS"], y);
      fields.packageCount = field(i ? 10 : 20, 2, [i ? "10" : "20"], y);
      fields.packageUnit = field("CTNS", 2, ["CTNS"], y);
      fields.netWeight = field(i ? 200 : 300, 2, [i ? "200" : "300"], y);
      fields.netWeightUnit = field("KG", 2, ["순중량 (KG)"]);
      fields.grossWeight = field(i ? 220 : 320, 2, [i ? "220" : "320"], y);
      fields.grossWeightUnit = field("KG", 2, ["총중량 (KG)"]);
      return { fields };
    });
  wire.containers = [0, 1].map((i) => ({
    containerNumber: field(
      i ? "EFGH7654321" : "ABCD1234567",
      2,
      [i ? "EFGH7654321" : "ABCD1234567"],
      265 + i * 35,
    ),
    sealNumber: field(
      i ? "SEAL-002" : "SEAL-001",
      2,
      [i ? "SEAL-002" : "SEAL-001"],
      265 + i * 35,
    ),
    sealNumbers: [
      field(
        i ? "SEAL-002" : "SEAL-001",
        2,
        [i ? "SEAL-002" : "SEAL-001"],
        265 + i * 35,
      ),
    ],
    packageCount: field(500, 2, ["500"], 265 + i * 35),
    packageUnit: field("CTNS", 2, ["CTNS"], 265 + i * 35),
    grossWeight: field(i ? 340 : 320, 2, [i ? "340" : "320"], 265 + i * 35),
    weightUnit: field("KG", 2, ["KG"], 265 + i * 35),
  }));
  if (type === "house_manifest")
    wire.cargoRecords = [0, 1].map((i) => {
      const y = 410 + i * 35,
        fields: ShippingWire["cargoRecords"][number]["fields"] =
          Object.fromEntries(
            cargoFieldKeys.map((k) => [k, { value: null, evidence: null }]),
          );
      fields.houseBlNumber = field(
        i ? "HB-2026-002" : "HB-2026-001",
        2,
        [i ? "HB-2026-002" : "HB-2026-001"],
        y,
      );
      fields.containerNumber = field(
        i ? "EFGH7654321" : "ABCD1234567",
        2,
        [i ? "EFGH7654321" : "ABCD1234567"],
        y,
      );
      fields.goodsDescription = field(
        i ? "Brass Nuts" : "Steel Bolts",
        2,
        [i ? "Brass Nuts" : "Steel Bolts"],
        y,
      );
      fields.packageCount = field(i ? 10 : 20, 2, [i ? "10" : "20"], y);
      fields.grossWeight = field(i ? 340 : 320, 2, [i ? "340" : "320"], y);
      fields.grossWeightUnit = field("KG", 2, ["Gross Weight (KG)"], 375);
      return { fields };
    });
  if (options.extraSeals)
    wire.containers[0].sealNumbers.push(
      field("SEAL-003", 2, ["SEAL-003"], 265),
    );
  wire.references = [
    ["03000-26-0012345", "수출신고번호: 03000-26-0012345"],
    ["03000-26-0012346", "수출신고번호: 03000-26-0012346"],
  ].map(([value, text]) => ({
    kind: "export_declaration",
    number: field(value, 2, [text]),
  }));
  if (options.badEvidence)
    wire.containers[0].grossWeight = structuredClone(
      wire.containers[1].grossWeight,
    );
  return { bytes, pdf, wire, document: groundShipping(wire, pdf, type) };
}
