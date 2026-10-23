// AI-mistake injection (free, no provider call). A correct, citation-grounded
// AI answer is mutated the way extraction models actually go wrong; whatever
// the mistake, no value may end up verified unless it equals the verified
// value of the untouched answer at the same place. Wrong values may stay
// visible as unverified, never as "원문 확인".
import { beforeAll, describe, expect, it } from "vitest";
import { shipping34Fixture } from "../fixtures/shipping34";
import { groundShipping } from "../../src/modules/shipping/ground";
import { recoverNative } from "../../src/modules/shipping/recovery";
import type { ShippingDocument, ShippingField } from "../../src/modules/shipping/schema";
import type { Candidate } from "../../src/modules/shipping/ai-schema";
import { itemFieldKeys } from "../../src/modules/shipping/ai-schema";

type Fixture = Awaited<ReturnType<typeof shipping34Fixture>>;
type Wire = Fixture["wire"];

function facts(doc: ShippingDocument) {
  const out = new Map<string, ShippingField>();
  for (const [k, f] of Object.entries(doc.fields)) out.set(`doc.${k}`, f);
  for (const a of doc.additionalFields) out.set(`extra.${a.meaning}`, a.field);
  for (const i of doc.items) for (const [k, f] of Object.entries(i.fields)) out.set(`${i.id}.${k}`, f);
  for (const c of doc.cargoRecords) for (const [k, f] of Object.entries(c.fields)) out.set(`${c.id}.${k}`, f);
  for (const c of doc.containers)
    for (const k of ["containerNumber", "sealNumber", "packageCount", "packageUnit", "grossWeight", "weightUnit"] as const)
      out.set(`${c.id}.${k}`, c[k]);
  return out;
}
const run = (wire: Wire, f: Fixture) =>
  recoverNative(groundShipping(wire, f.pdf, f.document.uploadType), f.pdf);
/** Verified values that the untouched answer does not verify at the same place. */
function falseVerified(mutated: ShippingDocument, oracle: ShippingDocument) {
  const truth = facts(oracle);
  return [...facts(mutated)].flatMap(([path, f]) => {
    if (f.current.status !== "verified") return [];
    const t = truth.get(path);
    const ok = t?.current.status === "verified" && String(t.current.value) === String(f.current.value);
    return ok ? [] : [`${path}=${JSON.stringify(f.current.value)}`];
  });
}
const blockIds = (f: Fixture, text: string) => {
  const b = f.pdf.pages[0].blocks!.find((x) => x.text === text);
  if (!b) throw Error("fixture block missing: " + text);
  return { page: 1, blockIds: [b.id] };
};
// Cast: the wire types each field by role; injected mistakes deliberately do not.
const cite = (f: Fixture, value: string | number, text: string) => ({ value, evidence: blockIds(f, text) }) as Candidate as never;
const emptyItem = () =>
  ({ fields: Object.fromEntries(itemFieldKeys.map((k) => [k, { value: null, evidence: null }])) }) as Wire["items"][number];

let bl: Fixture, model: Fixture;
beforeAll(async () => {
  // Footer statements printed under the goods column, as on real B/Ls.
  bl = await shipping34Fixture("house_bl", {
    footer: [
      { text: "TOTAL PACKAGES: ONE (1) CONTAINER / SIXTY", x: 96, y: 520 },
      { text: "(60) CARTONS", x: 286, y: 520 },
      { text: "SHIPPING MARK: SYN-26 / MADE IN", x: 140, y: 540 },
      { text: "KOREA", x: 286, y: 540 },
    ],
  });
  model = await shipping34Fixture("house_bl", { goods: "CERAMIC SENSOR SLEEVE MODEL 10000" });
}, 30000);

describe("an untouched grounded answer is the oracle", () => {
  it("verifies the core facts and reports nothing false", () => {
    const oracle = run(bl.wire, bl);
    expect(oracle.items[0].fields.goodsDescription.current.status).toBe("verified");
    expect(falseVerified(oracle, oracle)).toEqual([]);
  });
});

type Mutation = [string, (w: Wire, f: Fixture) => void];
const mutations: Mutation[] = [
  ["phantom item: bare count from a footer total line", (w, f) => {
    const i = emptyItem(); i.fields.goodsDescription = cite(f, "(60)", "(60) CARTONS"); w.items.push(i);
  }],
  ["phantom item: count with unit as goods", (w, f) => {
    const i = emptyItem(); i.fields.goodsDescription = cite(f, "(60) CARTONS", "(60) CARTONS"); w.items.push(i);
  }],
  ["phantom item: words from a labelled SHIPPING MARK line under the goods column", (w, f) => {
    const i = emptyItem(); i.fields.goodsDescription = cite(f, "KOREA", "KOREA"); w.items.push(i);
  }],
  ["phantom item: bare count with no citation", (w) => {
    const i = emptyItem(); i.fields.goodsDescription = { value: "(60)", evidence: null }; w.items.push(i);
  }],
  ["goods replaced by the package cell", (w, f) => {
    w.items[0].fields.goodsDescription = cite(f, "60 CARTONS", "60");
  }],
  ["goods replaced by the column header", (w, f) => {
    w.items[0].fields.goodsDescription = cite(f, "(16) Description of Goods", "(16) Description of Goods");
  }],
  ["shipper and consignee swapped", (w, f) => {
    w.fields.shipper = cite(f, "Synthetic Buyer Ltd", "Synthetic Buyer Ltd");
    w.fields.consignee = cite(f, "Synthetic Supplier Ltd", "Synthetic Supplier Ltd");
  }],
  ["HBL number taken from a party cell", (w, f) => {
    w.fields.houseBlNumber = cite(f, "Synthetic Buyer Ltd", "Synthetic Buyer Ltd");
  }],
  ["discharge port taken from the loading port cell", (w, f) => {
    w.fields.portOfDischarge = cite(f, "BUSAN, KOREA", "BUSAN, KOREA");
  }],
  ["gross weight taken from the package count", (w, f) => {
    w.items[0].fields.grossWeight = cite(f, 60, "60");
  }],
  ["container number taken from the package cell", (w, f) => {
    w.containers[0].containerNumber = cite(f, "60 CARTONS", "60");
  }],
  ["HS code taken from the goods text", (w, f) => {
    w.items[0].fields.hsCode = cite(f, "GLASS STORAGE JARS", "GLASS STORAGE JARS");
  }],
];

describe("injected AI mistakes never become verified facts", () => {
  it.each(mutations)("%s", (_name, mutate) => {
    const oracle = run(bl.wire, bl);
    const wire = structuredClone(bl.wire);
    mutate(wire, bl);
    expect(falseVerified(run(wire, bl), oracle)).toEqual([]);
  });

  it("a model number is never read as a quantity", () => {
    const oracle = run(model.wire, model);
    const wire = structuredClone(model.wire);
    wire.items[0].fields.quantity = cite(model, 10000, "CERAMIC SENSOR SLEEVE MODEL 10000");
    expect(falseVerified(run(wire, model), oracle)).toEqual([]);
  });
});

describe("a phantom entity is set aside, never compared, never lost", () => {
  it("keeps the real item, records the rejected candidate and says why", () => {
    const wire = structuredClone(bl.wire);
    const i = emptyItem(); i.fields.goodsDescription = cite(bl, "(60)", "(60) CARTONS"); wire.items.push(i);
    const doc = run(wire, bl);
    expect(doc.items).toHaveLength(1);
    expect(doc.items[0].fields.goodsDescription.current.status).toBe("verified");
    expect(doc.rejectedCandidates).toEqual([expect.objectContaining({ kind: "item", value: "(60)" })]);
    expect(doc.informationWarnings.some((w) => w.includes("(60)"))).toBe(true);
  });
  it("does not drop the only item: an unproven sole item stays visible as unverified", () => {
    const wire = structuredClone(bl.wire);
    wire.items[0].fields.goodsDescription = cite(bl, "(60)", "(60) CARTONS");
    const doc = groundShipping(wire, bl.pdf, "house_bl");
    expect(doc.items).toHaveLength(1);
    expect(doc.items[0].fields.goodsDescription.original.status).toBe("unverified");
    expect(doc.rejectedCandidates).toEqual([]);
  });
  it("a real but uncited extra item is kept for review, not discarded", () => {
    const wire = structuredClone(bl.wire);
    const i = emptyItem(); i.fields.goodsDescription = { value: "STAINLESS FLASK", evidence: null }; wire.items.push(i);
    const doc = groundShipping(wire, bl.pdf, "house_bl");
    expect(doc.items).toHaveLength(2);
    expect(doc.rejectedCandidates).toEqual([]);
  });
});

// The same document-level mistakes on every supported document layout.
describe.each(["house_bl", "export_declaration", "house_manifest"] as const)("document-level mistakes on %s", (type) => {
  let f: Fixture;
  beforeAll(async () => { f = await shipping34Fixture(type); }, 30000);
  const blockOf = (text: string) => f.pdf.pages[0].blocks!.find((b) => b.text === text);
  it.each([
    ["shipper from the consignee cell", "shipper", "Synthetic Buyer Ltd"],
    ["consignee from the shipper cell", "consignee", "Synthetic Supplier Ltd"],
    ["HBL number from a party cell", "houseBlNumber", "Synthetic Buyer Ltd"],
    ["discharge port from the scope cell", "portOfDischarge", "full shipment"],
    ["loading port from the HBL cell", "portOfLoading", "HB-SYN-R34-401"],
  ] as const)("%s", (_n, field, text) => {
    const b = blockOf(text);
    if (!b || !(field in f.wire.fields)) return;
    const oracle = run(f.wire, f);
    const wire = structuredClone(f.wire);
    wire.fields[field] = { value: text, evidence: { page: 1, blockIds: [b.id] } };
    expect(falseVerified(run(wire, f), oracle)).toEqual([]);
  });
});
