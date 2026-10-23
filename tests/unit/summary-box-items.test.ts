// Real Set2 run (7dcf88a): the AI returned the manifest's titled "화물명세"
// summary box ("VACUUM FLASKS / 5,000 PCS / 250 CARTONS") as a second item. The
// verifier left it unverified, but native recovery then gave it the table row
// already owned by item 1, so one row became two items. Synthetic layout only.
import { beforeAll, describe, expect, it } from "vitest";
import { fixture35 } from "../fixtures/shipping35";
import { groundShipping } from "../../src/modules/shipping/ground";
import { recoverNative } from "../../src/modules/shipping/recovery";
import { cellRole } from "../../src/modules/shipping/value-shape";
import type { PdfDocument } from "../../src/modules/documents/schema";

let base: Awaited<ReturnType<typeof fixture35>>;
beforeAll(async () => {
  base = await fixture35("house_manifest", {
    rows: [{ name: "OPTICAL WAVEGUIDE MODEL WG42", hs: "9001.90", qty: 600 }],
  });
}, 20000);

// A stroked box with a title above its value, below the item table.
function withSummaryBox(pdf: PdfDocument, title: string, value: string) {
  const out = structuredClone(pdf), page = out.pages[0];
  page.cells = [...(page.cells ?? []), { x: 20, y: 600, width: 400, height: 40 }];
  page.blocks = [
    ...(page.blocks ?? []),
    { id: "p1-box-title", text: title, x: 25, y: 604, width: 40, height: 7, row: 90 },
    { id: "p1-box-value", text: value, x: 25, y: 620, width: 180, height: 8, row: 91 },
  ];
  page.text += `\n${title}\n${value}`;
  return out;
}
function extraItem(wire: typeof base.wire, value: string, blockIds: string[]) {
  const item = structuredClone(wire.items[0]);
  for (const k of Object.keys(item.fields) as (keyof typeof item.fields)[])
    item.fields[k] = { value: null, evidence: null } as never;
  item.fields.goodsDescription = { value, evidence: { page: 1, blockIds } };
  return item;
}
const summary = "OPTICAL WAVEGUIDE MODEL WG42 / 600 PCS / 30 CTNS";
const analyse = (wire: typeof base.wire, pdf: PdfDocument) =>
  recoverNative(groundShipping(wire, pdf, "house_manifest"), pdf);

describe("one table row is one item", () => {
  it("tells a plain table cell from a titled form box using vector cells", () => {
    const pdf = withSummaryBox(base.pdf, "화물명세", summary);
    const goods = base.wire.items[0].fields.goodsDescription.evidence!.blockIds;
    expect(cellRole(pdf.pages[0], goods)).toEqual({ kind: "table" });
    expect(cellRole(pdf.pages[0], ["p1-box-value"])).toEqual({ kind: "labelled", label: "화물명세" });
    const noCells = structuredClone(pdf);
    noCells.pages[0].cells = [];
    expect(cellRole(noCells.pages[0], ["p1-box-value"])).toBeNull();
  });

  for (const cited of [["p1-box-value"], ["p1-box-title", "p1-box-value"]])
    it(`keeps a titled summary box out of the items (cited ${cited.length} block)`, () => {
      const pdf = withSummaryBox(base.pdf, "화물명세", summary);
      const wire = structuredClone(base.wire);
      wire.items.push(extraItem(wire, summary, cited));
      const doc = analyse(wire, pdf);
      expect(doc.items).toHaveLength(1);
      expect(doc.items[0].fields.goodsDescription.current.status).toBe("verified");
      expect(doc.rejectedCandidates).toHaveLength(1);
      expect(doc.rejectedCandidates?.[0].reason).toContain("화물명세");
    });

  for (const cited of [null, ["p1-b16"]])
    it(`never gives a row already owned by another item to a duplicate item (${cited ? "wrong cell" : "no citation"})`, () => {
      const wire = structuredClone(base.wire);
      const dup = extraItem(wire, "OPTICAL WAVEGUIDE MODEL WG42", cited ?? []);
      if (!cited) dup.fields.goodsDescription.evidence = null;
      wire.items.push(dup);
      const doc = analyse(wire, base.pdf);
      expect(doc.items).toHaveLength(2);
      const [first, second] = doc.items.map((i) => i.fields.goodsDescription);
      expect(first.current.status).toBe("verified");
      expect(second.current.status).not.toBe("verified");
      expect(second.recovery).toBeUndefined();
    });

  it("still recovers a lone wrong citation from its unique native row", () => {
    const wire = structuredClone(base.wire);
    wire.items[0].fields.goodsDescription.evidence = { page: 1, blockIds: ["p1-b4"] };
    const doc = analyse(wire, base.pdf);
    expect(doc.items[0].fields.goodsDescription.current.status).toBe("verified");
  });

  it("never rejects a single boxed item ('Description of Goods' box is the item)", () => {
    const pdf = withSummaryBox(base.pdf, "Description of Goods", summary);
    const wire = structuredClone(base.wire);
    wire.items = [extraItem(wire, summary, ["p1-box-value"])];
    const doc = groundShipping(wire, pdf, "house_manifest");
    expect(doc.items).toHaveLength(1);
    expect(doc.rejectedCandidates ?? []).toHaveLength(0);
  });

  it("does not apply the box rule when the table item is unverified or cells are absent", () => {
    const pdf = withSummaryBox(base.pdf, "화물명세", summary);
    const unverified = structuredClone(base.wire);
    unverified.items[0].fields.goodsDescription.evidence = { page: 1, blockIds: ["p1-b1"] };
    unverified.items.push(extraItem(unverified, summary, ["p1-box-value"]));
    expect(groundShipping(unverified, pdf, "house_manifest").items).toHaveLength(2);
    const noCells = structuredClone(pdf);
    noCells.pages[0].cells = [];
    const wire = structuredClone(base.wire);
    wire.items.push(extraItem(wire, summary, ["p1-box-value"]));
    expect(groundShipping(wire, noCells, "house_manifest").rejectedCandidates ?? []).toHaveLength(0);
  });
});
