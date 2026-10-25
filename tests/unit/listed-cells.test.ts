import { it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { extractPdfText } from "../../src/modules/pdf/extract";
import { emptyShippingWire, groundShipping } from "../../src/modules/shipping/ground";
import { recoverNative, refreshRecoveryCoverage } from "../../src/modules/shipping/recovery";
import { verifyShippingField } from "../../src/modules/shipping/verify";
import { countAtoms } from "../../src/modules/shipping/count-atoms";
import { reviewShipping } from "../../src/modules/shipping/review";
import { shippingTypes } from "../../src/modules/shipping/catalog";
import { officialFormOracle } from "../fixtures/official-forms";

// Synthetic forms only. A B/L description cell listing three goods, each
// closed by its own quantity line ("(960 PR)" = pairs), and a 수출신고필증
// (49) box printing several container numbers on one line.
async function listedBl() {
  const bytes = new Uint8Array(await readFile("tests/fixtures/listed-cells/bl-listed-goods-pairs.pdf"));
  const pdf = { id: "synthetic-listed-bl", fileName: "bl.pdf", pages: await extractPdfText(bytes, undefined, false, true) };
  const wire = emptyShippingWire("house_bl");
  wire.typeEvidence = { page: 1, blockIds: [pdf.pages[0].blocks!.find((b) => b.text === "Bill of Lading")!.id] };
  return { pdf, doc: groundShipping(wire, pdf, "house_bl") };
}

it("reads a pairs (PR) quantity line as the close of its own goods group", () => {
  expect(countAtoms("(12,960 PR)")).toEqual([{ value: 12960, unit: "PR", role: "quantity" }]);
  expect(countAtoms("PR")).toEqual([]);
});

it("recovers every listed goods row with its own quantity and unit, never one merged item", async () => {
  const { pdf, doc } = await listedBl();
  const d = recoverNative(doc, pdf);
  expect(d.items.map((i) => i.fields.quantity.current.value)).toEqual([288, 1152, 960]);
  expect(d.items.map((i) => i.fields.quantityUnit.current.value)).toEqual(["PCS", "PCS", "PR"]);
  expect(new Set(d.items.map((i) => i.fields.goodsDescription.current.source?.layout?.rowId)).size).toBe(3);
  expect(d.items.every((i) => i.fields.goodsDescription.original.value === null)).toBe(true);
  expect(d.items[2].fields.goodsDescription.current.value).toContain("NITRILE");
  expect(d.items[2].fields.goodsDescription.current.value).not.toContain("COFFEE");
});

it("verifies each member of a listed-container box as its own row and rejects non-members and other roles", async () => {
  const f = await officialFormOracle("normal", "export_declaration");
  const page = f.pdf.pages[0];
  const list = page.blocks!.find((b) => /^BLRU3775944 OCEU5807983$/.test(b.text))!;
  const label = page.blocks!.find((b) => b.text.includes("컨테이너번호"))!;
  const cite = (value: string, role = "containerNumber") =>
    verifyShippingField({ value, evidence: { page: 1, blockIds: [label.id, list.id] } }, f.pdf, role, "container").current;
  const a = cite("BLRU3775944"), b = cite("OCEU5807983");
  expect([a.status, b.status]).toEqual(["verified", "verified"]);
  expect(a.source?.layout?.rowId).not.toBe(b.source?.layout?.rowId);
  expect(cite("BLRU3775945").status).not.toBe("verified");
  expect(cite("BLRU3775944 OCEU5807983").status).toBe("verified");
  expect(cite("OCEU5807983", "sealNumber").status).not.toBe("verified");
  // Both members extracted: no duplicate-row withholding, the list is whole.
  expect(f.document.containers.map((c) => c.containerNumber.current.status)).toEqual(["verified", "verified"]);
  expect(f.document.collectionCoverage?.containers.complete).toBe(true);
}, 60000);

it("does not confirm a container-list conflict from a list that lost one listed member", async () => {
  const fs = await Promise.all(shippingTypes.map((t) => officialFormOracle("normal", t)));
  const decl = fs.find((f) => f.document.uploadType === "export_declaration")!;
  decl.document.containers = decl.document.containers.slice(0, 1);
  refreshRecoveryCoverage(decl.document, decl.pdf);
  expect(decl.document.factCoverage?.containers.complete).toBe(false);
  const r = reviewShipping(fs.map((f) => f.document));
  const lists = r.primaryChecks!.filter((c) => c.comparison?.meaning === "containerNumber" && !/seal/i.test(c.title ?? ""));
  expect(lists.length).toBeGreaterThan(0);
  expect(lists.filter((c) => c.assessment === "confirmed_mismatch")).toEqual([]);
}, 60000);

it("compares a multi-line manifest goods list line by line, not as one merged product", async () => {
  const { compareGoodsRefs } = await import("../../src/modules/shipping/goods-context");
  const { compareGoods } = await import("../../src/modules/shipping/goods-semantics");
  const field = (value: string, quotes: string[]) => ({
    original: { value, status: "verified", verificationCode: "verified", source: null, reason: "" },
    current: { value, status: "verified", verificationCode: "verified", reason: "", source: { fileId: "x", page: 1, segments: quotes.map((quote, i) => ({ blockId: "b" + i, quote })) } },
  });
  const list = ["ALUMINIUM ALLOY WHEEL 18 INCH", "CERAMIC COFFEE MUG 350ML"];
  const manifest = { documentId: "m", fieldName: "goodsDescription", cargoId: "c1", field: field(list.join(" "), ["12. 품명(Description of", "Goods)", ...list]) };
  const wheel = { documentId: "b", fieldName: "goodsDescription", itemId: "i1", field: field("ALUMINIUM ALLOY WHEEL 18 INCH", ["ALUMINIUM ALLOY WHEEL 18 INCH"]) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal synthetic references
  expect(compareGoodsRefs(wheel as any, manifest as any).status).not.toBe("different");
  expect(compareGoods(wheel.field.current.value, manifest.field.current.value).status).toBeDefined();
  const other = { ...wheel, field: field("STEEL WHEEL 15 INCH", ["STEEL WHEEL 15 INCH"]) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal synthetic references
  expect(compareGoodsRefs(other as any, manifest as any).status).not.toBe("exact");
});
