import { it, expect } from "vitest";
import { validateSemanticDecision } from "../../src/modules/shipping/semantic-validation";
import type { SemanticPair, SemanticProduct } from "../../src/modules/shipping/semantic-context";
import { collectionCoverage32 } from "../../src/modules/shipping/coverage";
import { officialFormOracle } from "../fixtures/official-forms";

// A printed model conflict on a multi-item shipment is confirmed only when the
// row is the proven counterpart (complete collections, equal row counts, the
// attribute-free name printed on exactly one row of each document).
function product(doc: string, value: string, blocks: [string, string][], whole = false): SemanticProduct {
  const id = `${doc}/item/item-1/goodsDescription`;
  return {
    id, hbl: "HBL1", documentType: doc === "bl" ? "house_bl" : "export_declaration", whole, collectionComplete: true, hsCode: null,
    descriptions: [{ value, blockIds: blocks.map((b) => b[0]) }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal synthetic reference
    ref: { documentId: doc, fieldName: "goodsDescription", itemId: "item-1", field: { current: { value, source: { blocks: blocks.map(([i, t]) => ({ id: i, text: t })) } } } } as any,
  };
}
const left = product("bl", "CERAMIC COFFEE MUG 350ML MODEL CM-350", [["b1", "CERAMIC COFFEE MUG 350ML MODEL CM-350"]]);
const right = product("de", "CERAMIC COFFEE MUG 350ML MODEL CM-35X", [["d1", "CERAMIC COFFEE MUG 350ML MODEL CM-35X"]]);
const decision = {
  leftId: left.id, rightId: right.id, relation: "unknown" as const, explanation: "",
  left: { fieldId: left.id, quote: left.descriptions[0].value, blockIds: ["b1"] },
  right: { fieldId: right.id, quote: right.descriptions[0].value, blockIds: ["d1"] },
  claims: [],
};
it("confirms a printed model conflict on a proven multi-item counterpart", () => {
  const pair: SemanticPair = { left, right, relationshipId: "r", relationshipConfirmed: true, uniqueCounterpart: true };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- synthetic decision
  const v = validateSemanticDecision(decision as any, pair);
  expect([v.assessment, v.code]).toEqual(["confirmed_mismatch", "VERIFIED_LITERAL_ATTRIBUTE_CONFLICT"]);
});
it("keeps the conflict provisional without a proven counterpart or a confirmed link", () => {
  for (const pair of [
    { left, right, relationshipId: "r", relationshipConfirmed: true, uniqueCounterpart: false },
    { left, right, relationshipId: "r", relationshipConfirmed: false, uniqueCounterpart: true },
  ] as SemanticPair[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- synthetic decision
    expect(validateSemanticDecision(decision as any, pair).assessment).toBe("provisional_mismatch");
  }
});
it("reads a STYLE label as a printed model attribute", () => {
  const l = product("bl", "COTTON T-SHIRT STYLE TS-21", [["b1", "COTTON T-SHIRT STYLE TS-21"]]);
  const r = product("de", "COTTON T-SHIRT STYLE TS-2X", [["d1", "COTTON T-SHIRT STYLE TS-2X"]]);
  const d = { ...decision, leftId: l.id, rightId: r.id, left: { fieldId: l.id, quote: l.descriptions[0].value, blockIds: ["b1"] }, right: { fieldId: r.id, quote: r.descriptions[0].value, blockIds: ["d1"] } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- synthetic decision
  expect(validateSemanticDecision(d as any, { left: l, right: r, relationshipId: "r", relationshipConfirmed: true, uniqueCounterpart: true }).assessment).toBe("confirmed_mismatch");
});
it("counts a container cited with or without its size code as the same listed row", async () => {
  const f = await officialFormOracle("normal", "house_bl");
  const doc = structuredClone(f.document);
  for (const c of doc.containers) {
    const bare = String(c.containerNumber.current.value).replace(/\s*\/.*$/, "");
    c.containerNumber.current = { ...c.containerNumber.current, value: bare };
  }
  expect(collectionCoverage32(doc, f.pdf).containers.complete).toBe(true);
}, 60000);

it("owns a manifest row's separately listed containers by that row's band and compares them", async () => {
  const { shippingTypes } = await import("../../src/modules/shipping/catalog");
  const { reviewShipping } = await import("../../src/modules/shipping/review");
  const { emptyShippingField } = await import("../../src/modules/shipping/schema");
  const fs = await Promise.all(shippingTypes.map((t) => officialFormOracle("normal", t)));
  const m = fs.find((f) => f.document.uploadType === "house_manifest")!.document;
  const hbl = fs.find((f) => f.document.uploadType === "house_bl")!.document.fields.houseBlNumber!.current.value;
  // The model listed this row's containers apart from its cargo record.
  for (const r of m.cargoRecords.filter((r) => r.fields.houseBlNumber.current.value === hbl)) {
    if (r.fields.containerNumber?.current.value)
      m.containers.push({ id: "container-" + (m.containers.length + 1), containerNumber: r.fields.containerNumber, sealNumber: r.fields.sealNumber ?? emptyShippingField(), packageCount: emptyShippingField(), packageUnit: emptyShippingField(), grossWeight: emptyShippingField(), weightUnit: emptyShippingField() });
    r.fields.containerNumber = emptyShippingField();
    r.fields.sealNumber = emptyShippingField();
  }
  const lists = reviewShipping(fs.map((f) => f.document)).primaryChecks!.filter((c) => c.comparison?.meaning === "containerNumber" && c.scope === "triangle");
  expect(lists.some((c) => c.assessment === "confirmed_match" && c.fields.some((f) => f.documentId === m.id && f.containerId))).toBe(true);
  expect(lists.filter((c) => c.assessment === "confirmed_mismatch")).toEqual([]);
}, 60000);

it("does not let a party value read under another label meaning block the other documents' comparison", async () => {
  const { shippingTypes } = await import("../../src/modules/shipping/catalog");
  const { reviewShipping } = await import("../../src/modules/shipping/review");
  const fs = await Promise.all(shippingTypes.map((t) => officialFormOracle("normal", t)));
  const decl = fs.find((f) => f.document.uploadType === "export_declaration")!.document;
  const other = { value: "SOMEONE ELSE TRADING LLC", status: "unverified" as const, verificationCode: "role_mismatch" as const, source: null, reason: "값은 존재하지만 해당 필드의 실제 라벨/열 의미와 다릅니다." };
  decl.fields.consignee = { original: { ...other }, current: { ...other } };
  const party = reviewShipping(fs.map((f) => f.document)).primaryChecks!.filter((c) => c.comparison?.meaning === "consignee");
  expect(party.some((c) => c.assessment === "confirmed_match")).toBe(true);
  expect(party.filter((c) => c.assessment === "confirmed_mismatch")).toEqual([]);
}, 60000);
