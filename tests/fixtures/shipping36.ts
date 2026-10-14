import { unicodePdf } from "./shipping31";
import { extractPdfText } from "../../src/modules/pdf/extract";
import {
  emptyShippingWire,
  groundShipping,
} from "../../src/modules/shipping/ground";
export async function wrapped36() {
  const bytes = unicodePdf(
    [
      [
        { text: "HOUSE MANIFEST", x: 180, y: 30 },
        { text: "POL", x: 30, y: 75 },
        { text: "KR", x: 30, y: 105 },
        { text: "PUS", x: 30, y: 128 },
        { text: "POD", x: 320, y: 75 },
        { text: "US", x: 320, y: 105 },
        { text: "LAX", x: 320, y: 128 },
      ],
    ],
    {
      borders: [
        [
          { x: 20, y: 55, width: 240, height: 110 },
          { x: 300, y: 55, width: 240, height: 110 },
        ],
      ],
    },
  );
  const pdf = {
      id: "synthetic-wrap36",
      fileName: "synthetic-wrapped36.pdf",
      pages: await extractPdfText(bytes, undefined, false, true),
    },
    wire = emptyShippingWire("house_manifest");
  const blocks = pdf.pages[0].blocks!;
  wire.typeEvidence = {
    page: 1,
    blockIds: [blocks.find((b) => b.text === "HOUSE MANIFEST")!.id],
  };
  wire.fields.portOfLoading = {
    value: "KRPUS",
    evidence: {
      page: 1,
      blockIds: blocks
        .filter((b) => ["KR", "PUS"].includes(b.text))
        .map((b) => b.id),
    },
  };
  wire.fields.portOfDischarge = {
    value: "USLAX",
    evidence: {
      page: 1,
      blockIds: blocks
        .filter((b) => ["US", "LAX"].includes(b.text))
        .map((b) => b.id),
    },
  };
  return {
    bytes,
    pdf,
    wire,
    document: groundShipping(wire, pdf, "house_manifest"),
  };
}
export async function packagesOnly36() {
  const bytes = unicodePdf(
    [
      [
        { text: "HOUSE MANIFEST", x: 180, y: 30 },
        { text: "Packages", x: 30, y: 75 },
        { text: "500PCS", x: 30, y: 105 },
      ],
    ],
    { borders: [[{ x: 20, y: 55, width: 240, height: 110 }]] },
  );
  const pdf = {
    id: "synthetic-pack-only36",
    fileName: "synthetic-pack-only36.pdf",
    pages: await extractPdfText(bytes, undefined, false, true),
  };
  return { bytes, pdf };
}
// Held-out column/layout permutation with different literal quantities. The PDF
// is rendered and re-extracted; IDs/coordinates are never inherited from a model.
export async function holdout36(
  type: import("../../src/modules/shipping/catalog").ShippingType,
) {
  const { fixture35 } = await import("./shipping35");
  const f = await fixture35(type, {
    id: "synthetic-holdout36-" + type,
    hbl: "HB-SYN-HO36-A",
    declaration: "DECL-SYN-HO36-A",
    rows: [
      {
        name: "SYNTHETIC HOLDOUT PRECISION VALVES",
        hs: "8481.80-0000",
        qty: 505,
        packages: 35,
        gross: 412,
      },
    ],
    containers: [
      {
        name: "",
        cn: "SYN-CN-HO36-A",
        seal: "SYN-SEAL-HO36-A",
        packages: 35,
        gross: 412,
      },
    ],
    totals: { quantity: 505, packageCount: 35, grossWeight: 412 },
  });
  const p = f.pdf.pages[0];
  const itemWidths = [205, 100, 75, 55, 85, 65, 105, 85],
    containerWidths = [190, 190, 100, 90, 130, 80];
  const columns = (widths: number[], order: number[]) => {
    let x = 20;
    const old = widths.map((w) => {
      const a = x;
      x += w;
      return a;
    });
    x = 20;
    const next = new Map<number, number>();
    for (const i of order) {
      next.set(old[i], x);
      x += widths[i];
    }
    return { old, widths, next };
  };
  const items = columns(itemWidths, [1, 0, 3, 2, 7, 6, 5, 4]),
    containers = columns(containerWidths, [1, 0, 3, 2, 5, 4]);
  const shift = (x: number, y: number) => {
    const table =
      y >= 320 && y < 500 ? items : y >= 570 && y < 650 ? containers : null;
    if (table) {
      const i = table.old.findIndex(
        (a, i) => x >= a - 0.2 && x < a + table.widths[i] - 0.2,
      );
      return i < 0 ? x : table.next.get(table.old[i])! + x - table.old[i];
    }
    if (y >= 55 && y < 310) {
      const col = Math.floor((x - 20) / 260);
      if (col >= 0 && col < 3) return x + (2 - 2 * col) * 260;
    }
    return x;
  };
  const text = p.blocks!.map((b) => ({
    text: b.text,
    x: shift(b.x, b.y),
    y: b.y + b.height,
    size: b.height,
  }));
  const borders = p.cells!.map((c) => ({
    x: shift(c.x, c.y),
    y: c.y,
    width: c.width,
    height: c.height,
  }));
  const bytes = unicodePdf([text], { borders: [borders], sizes: [[900, 842]] });
  const pdf = {
    ...f.pdf,
    pages: await extractPdfText(bytes, undefined, false, true),
  };
  const ids = new Map(
    p.blocks!.map((b, i) => [
      b.id,
      pdf.pages[0]
        .blocks!.filter((v) => v.text === b.text)
        .sort(
          (a, z) =>
            Math.abs(a.x - text[i].x) +
            Math.abs(a.y + a.height - text[i].y) -
            Math.abs(z.x - text[i].x) -
            Math.abs(z.y + z.height - text[i].y),
        )[0].id,
    ]),
  );
  const wire = structuredClone(f.wire);
  const visit = (v: unknown): void => {
    if (!v || typeof v !== "object") return;
    for (const [k, x] of Object.entries(v))
      if (k === "blockIds" && Array.isArray(x))
        (v as Record<string, unknown>)[k] = x.map((id) => ids.get(id));
      else visit(x);
  };
  visit(wire);
  return { bytes, pdf, wire, document: groundShipping(wire, pdf, type) };
}
