import { describe, it, expect } from "vitest";
import { shipping34Fixture } from "../fixtures/shipping34";
import { shipping38Fixture } from "../fixtures/shipping38";
import { groundShipping } from "../../src/modules/shipping/ground";
import { recoverNative } from "../../src/modules/shipping/recovery";
import { verifyShippingField } from "../../src/modules/shipping/verify";
import { compareGoods, goodsMeaning } from "../../src/modules/shipping/goods-semantics";
import { goodsComparisonValue } from "../../src/modules/shipping/goods-context";
import { reviewShipping } from "../../src/modules/shipping/review";
import { shippingDocumentSchema } from "../../src/modules/shipping/schema";

describe("PHASE381 native borders and conservative package recovery", () => {
  it.each([false, true])("rejects a volume in a neighbouring closed column; fragmented=%s", async (fragmented) => {
    const f = await (fragmented ? shipping38Fixture : shipping34Fixture)("house_bl", { volume: 12.375 });
    const b = f.pdf.pages[0].blocks!.find((b) => b.text === "12.375")!;
    expect(verifyShippingField({ value: 12.375, evidence: { page: 1, blockIds: [b.id] } }, f.pdf, "packageCount").current.status).not.toBe("verified");
    const w = structuredClone(f.wire);
    w.fields.packageCount.value = 61;
    const d = recoverNative(groundShipping(w, f.pdf, "house_bl"), f.pdf);
    expect(d.fields.packageCount.original.value).toBe(61);
    expect(d.fields.packageCount.original.status).not.toBe("verified");
    expect(d.fields.packageCount.current.value).toBe(60);
    expect(d.fields.packageCount.current.status).toBe("verified");
    expect(d.fields.packageCount.recovery?.method).toBe("native");
    expect(d.fields.packageCount.current.source?.scopeBasis).toBe("document_field");
  }, 15000);
  it("retains a genuinely changed PDF count and detects the inter-document error", async () => {
    const a = await shipping34Fixture("house_bl", { volume: 12.375 }),
      b = await shipping34Fixture("house_manifest", { packages: 61 });
    const d = recoverNative(b.document, b.pdf);
    expect(d.fields.packageCount.current.value).toBe(61);
    expect(d.fields.packageCount.recovery).toBeUndefined();
    expect(reviewShipping([recoverNative(a.document, a.pdf), d]).primaryChecks!.some((c) => c.comparison?.meaning === "packageCount" && c.assessment === "confirmed_mismatch")).toBe(true);
  }, 15000);
  it("does not overwrite a user correction or approve OCR", async () => {
    const f = await shipping34Fixture("house_bl", { volume: 12.375 });
    const d = structuredClone(f.document);
    d.fields.packageCount.current = { ...d.fields.packageCount.current, value: 61, status: "user_edited", verificationCode: "user_edited" };
    expect(recoverNative(d, f.pdf).fields.packageCount.current.status).toBe("user_edited");
    const p = structuredClone(f.pdf); p.pages[0].textSource = "ocr";
    const w = structuredClone(f.wire); w.fields.packageCount.value = 61;
    expect(recoverNative(groundShipping(w, p, "house_bl"), p).fields.packageCount.current.status).not.toBe("verified");
  }, 15000);
});

describe("PHASE381 cargo annotations preserve product identity", () => {
  it("separates both explicit count suffixes without changing the raw extraction", async () => {
    const goods = "GLASS STORAGE JARS / 720 PCS / 60 CTN";
    const f = await shipping34Fixture("house_manifest", { goods, goodsSize: 6 });
    const w = structuredClone(f.wire); w.cargoRecords[0].fields.goodsDescription.value = null;
    const d = recoverNative(groundShipping(w, f.pdf, "house_manifest"), f.pdf);
    const field = d.cargoRecords[0].fields.goodsDescription;
    expect(field.original.value).toBeNull();
    expect(field.current.value).toBe(goods);
    expect(field.current.status).toBe("verified");
    expect(compareGoods(goods, "GLASS STORAGE JARS").status).toBe("semantic");
    expect(goodsMeaning(goods).residual).toBe("");
  }, 15000);
  it("keeps model/capacity numbers, including explicit conflicts", () => {
    const a = "STAINLESS STEEL VACUUM FLASKS MODEL V7 750ML / 5000 PCS / 250 CARTONS";
    expect(goodsMeaning(a).attributes).toContain("model:v7");
    expect(goodsMeaning(a).attributes).toContain("volume:750");
    expect(compareGoods(a, "STAINLESS STEEL VACUUM FLASKS MODEL V8 750ML").status).toBe("different");
    expect(compareGoods(a, "STAINLESS STEEL VACUUM FLASKS MODEL V7 900ML").status).toBe("different");
    expect(compareGoods(a, "STAINLESS STEEL VACUUM FLASKS MODEL V7").status).toBe("partial");
  });
  it.each(["GLASS JARS MODEL / 720 PCS", "GLASS JARS / 720 PCS / MODEL 60", "GLASS JARS / 720 PCS / 60 PCS"])("does not blanket-remove ambiguous numeric descriptions: %s", (v) => {
    expect(goodsMeaning(v).residual).not.toBe("");
  });
});

describe("PHASE381 native same-item bilingual context", () => {
  it("links printed bilingual descriptions but preserves initial value and missing-capacity uncertainty", async () => {
    const f = await shipping34Fixture("export_declaration", { goods: "STAINLESS STEEL VACUUM FLASKS", localGoods: "스테인리스 보온병 (750mL)" });
    const w = structuredClone(f.wire), ko = f.pdf.pages[0].blocks!.find((b) => b.text.includes("보온병"))!;
    w.items[0].fields.goodsDescription = { value: ko.text, evidence: { page: 1, blockIds: [ko.id] } };
    const d = shippingDocumentSchema.parse(groundShipping(w, f.pdf, "export_declaration")), field = d.items[0].fields.goodsDescription;
    expect(field.current.status).toBe("verified");
    expect(field.original.value).toBe(ko.text);
    expect(field.current.source?.goodsContext).toHaveLength(2);
    for (const c of field.current.source!.goodsContext!)
      expect(c.blockIds.every((id) => f.pdf.pages[0].blocks!.some((b) => b.id === id))).toBe(true);
    const value = goodsComparisonValue(field);
    expect(value).toContain("VACUUM FLASKS");
    expect(compareGoods(value, "STAINLESS STEEL VACUUM FLASKS").status).toBe("partial");
    expect(compareGoods(value, "STAINLESS STEEL VACUUM FLASKS 900ML").status).toBe("different");
    field.current.status = "user_edited"; field.current.value = "MANUAL MODEL Z";
    expect(goodsComparisonValue(field)).toBe("MANUAL MODEL Z");
  });
  it("does not invent an English alias absent from the native product cell", async () => {
    const f = await shipping34Fixture("export_declaration", { goods: "유리 저장 용기", localGoods: "유리 저장 용기 750mL" });
    expect(f.document.items[0].fields.goodsDescription.current.source?.goodsContext).toBeUndefined();
  });
});

it("does not borrow English from a separate note/cell", async () => {
  const { unicodePdf } = await import("../fixtures/shipping31");
  const { extractPdfText } = await import("../../src/modules/pdf/extract");
  const f = await shipping34Fixture("export_declaration", { goods: "유리 저장 용기", localGoods: "유리 저장 용기 750mL" });
  const p = f.pdf.pages[0];
  const bytes = unicodePdf([[...p.blocks!.map((b) => ({ text: b.text, x: b.x, y: b.y + b.height, size: b.height })), { text: "GLASS STORAGE JARS", x: 40, y: 610, size: 9 }]], { borders: [p.cells!], sizes: [[p.width!, p.height!]] });
  const pdf = { ...f.pdf, pages: await extractPdfText(bytes, undefined, false, true) };
  const ko = pdf.pages[0].blocks!.find((b) => b.text === "유리 저장 용기 750mL")!;
  const field = verifyShippingField({ value: ko.text, evidence: { page: 1, blockIds: [ko.id] } }, pdf, "goodsDescription", "item");
  expect(field.current.status).toBe("verified");
  expect(field.current.source?.goodsContext).toBeUndefined();
});

it("does not merge bilingual descriptions across multiple product rows", async () => {
  const { unicodePdf } = await import("../fixtures/shipping31");
  const { extractPdfText } = await import("../../src/modules/pdf/extract");
  const f = await shipping34Fixture("export_declaration");
  const p = f.pdf.pages[0];
  const bytes = unicodePdf([[...p.blocks!.map((b) => ({ text: b.text, x: b.x, y: b.y + b.height, size: b.height })), { text: "COTTON T SHIRTS", x: 36, y: 490, size: 9 }, { text: "300 EA", x: 396, y: 490, size: 9 }]], { borders: [p.cells!], sizes: [[p.width!, p.height!]] });
  const pdf = { ...f.pdf, pages: await extractPdfText(bytes, undefined, false, true) };
  const ko = pdf.pages[0].blocks!.find((b) => b.text === "유리 보관 용기")!;
  const field = verifyShippingField({ value: ko.text, evidence: { page: 1, blockIds: [ko.id] } }, pdf, "goodsDescription", "item");
  expect(field.current.status).not.toBe("verified");
  expect(field.current.source?.goodsContext).toBeUndefined();
});

it("never promotes a bilingual context whose block is absent from page source text", async () => {
  const f = await shipping34Fixture("export_declaration", { goods: "STAINLESS STEEL VACUUM FLASKS", localGoods: "스테인리스 보온병 (750mL)" });
  const pdf = structuredClone(f.pdf), p = pdf.pages[0];
  p.blocks!.find((b) => b.text === "STAINLESS STEEL VACUUM FLASKS")!.text = "STAINLESS STEEL VACUUM FLASKS MODEL GHOST";
  const ko = p.blocks!.find((b) => b.text.includes("보온병"))!;
  const field = verifyShippingField({ value: ko.text, evidence: { page: 1, blockIds: [ko.id] } }, pdf, "goodsDescription", "item");
  expect(field.current.status).toBe("verified");
  expect(field.current.source?.goodsContext).toBeUndefined();
});

it("recovers the whole wrapped product name instead of separate line fragments", async () => {
  const f = await shipping34Fixture("house_manifest", { goods: "STAINLESS STEEL VACUUM FLASKS", wrappedGoods: true });
  const w = structuredClone(f.wire); w.cargoRecords[0].fields.goodsDescription.value = null;
  const field = recoverNative(groundShipping(w, f.pdf, "house_manifest"), f.pdf).cargoRecords[0].fields.goodsDescription;
  expect(field.original.value).toBeNull();
  expect(field.current.status).toBe("verified");
  expect(field.current.value).toBe("STAINLESS STEEL VACUUM FLASKS");
  expect(field.current.source?.segments).toHaveLength(2);
});

it("does not fuse explicitly conflicting product descriptions in one cell", async () => {
  const { nativeGoodsSpans } = await import("../../src/modules/shipping/goods-context");
  const { unicodePdf } = await import("../fixtures/shipping31");
  const { extractPdfText } = await import("../../src/modules/pdf/extract");
  const bytes = unicodePdf([[{ text: "Description of Goods", x: 40, y: 60, size: 9 }, { text: "GLASS STORAGE JARS MODEL A1", x: 40, y: 80, size: 9 }, { text: "COTTON T SHIRTS MODEL B2", x: 40, y: 94, size: 9 }]], { borders: [[{ x: 30, y: 45, width: 260, height: 80 }]] });
  const pages = await extractPdfText(bytes, undefined, false, true);
  expect(nativeGoodsSpans(pages[0])).toHaveLength(0);
});
