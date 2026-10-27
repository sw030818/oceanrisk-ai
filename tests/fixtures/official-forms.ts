/* eslint-disable @typescript-eslint/no-explicit-any -- evaluation-only truth JSON with optional fault keys */
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
// Read as data so both Vitest and the Playwright loader can use this fixture.
const truth = JSON.parse(readFileSync(new URL("./official-forms/truth.json", import.meta.url), "utf8")) as typeof import("./official-forms/truth.json");
import { extractPdfText } from "../../src/modules/pdf/extract";
import type { ShippingType } from "../../src/modules/shipping/catalog";
import type { Candidate, ShippingWire } from "../../src/modules/shipping/ai-schema";
import type { ShippingField } from "../../src/modules/shipping/schema";

// Synthetic transactions on the official Korean forms (B/L ①–㉘ boxes,
// 수출신고필증 갑지, 별지 제4호 혼재화물적하목록). The same PDFs back the
// site's sample button. The truth here is evaluation-only and is never sent to
// any model: the oracle only cites PDF blocks that the native verifier accepts.
export type OfficialKind = keyof typeof truth;
const names: Record<ShippingType, string> = {
  house_bl: "house-bl",
  export_declaration: "export-declaration",
  house_manifest: "house-manifest",
};
const PKG: Record<string, [string, string, string]> = {
  CT: ["CARTONS", "CTNS", "CT"],
  PL: ["PALLETS", "PLTS", "PL"],
};
type Layout = NonNullable<NonNullable<ShippingField["current"]["source"]>["layout"]>;
type Scope = "document" | "item" | "container" | "cargo";

export async function officialFormPdf(kind: OfficialKind, type: ShippingType) {
  const bytes = new Uint8Array(
    await readFile(new URL(`../../public/samples/${kind}/${names[type]}.pdf`, import.meta.url)),
  );
  if (createHash("sha256").update(bytes).digest("hex") !== truth[kind].sha256[type])
    throw Error("Sample PDF changed; regenerate the official-form truth");
  return {
    id: `official-${kind}-${type}`,
    fileName: `${names[type]}.pdf`,
    pages: await extractPdfText(bytes, undefined, false, true),
  };
}

export async function officialFormOracle(kind: OfficialKind, type: ShippingType) {
  const { emptyShippingWire, groundShipping } = await import("../../src/modules/shipping/ground");
  const { itemFieldKeys, cargoFieldKeys } = await import("../../src/modules/shipping/ai-schema");
  const { verifyShippingField } = await import("../../src/modules/shipping/verify");
  const { physicalLines } = await import("../../src/modules/layout/physical-spans");
  const pdf = await officialFormPdf(kind, type);
  const s = truth[kind].truth as Record<string, any>;
  const pk = PKG[s.pkg as string];
  const w = emptyShippingWire(type);
  const page = pdf.pages[0];
  const blocks = page.blocks!;
  const spans = [
    ...blocks.map((b) => [b]),
    ...physicalLines(page),
    // Wrapped values: up to three consecutive printed lines.
    ...blocks.flatMap((_, i) => [blocks.slice(i, i + 2), blocks.slice(i, i + 3)].filter((w) => w.length > 1)),
  ];
  const find = (values: (string | number)[], role: string, scope: Scope = "document", owner?: Layout): Candidate => {
    for (const value of values)
      for (const bs of spans) {
        if (bs.length > 12) continue;
        const candidate = { value, evidence: { page: 1, blockIds: bs.map((b) => b.id) } };
        if (verifyShippingField(candidate, pdf, role, scope, owner).current.status === "verified") return candidate;
      }
    return { value: null, evidence: null };
  };
  const layoutOf = (c: Candidate, role: string, scope: Scope) =>
    verifyShippingField(c, pdf, role, scope).current.source?.layout;
  const title = page.blocks!.find((b) =>
    type === "house_bl" ? b.text === "Bill of Lading" : type === "house_manifest" ? b.text.includes("혼재화물적하목록") : b.text.replace(/\s/g, "") === "수출신고필증",
  )!;
  w.typeEvidence = { page: 1, blockIds: [title.id] };
  const fields = w.fields as Record<string, Candidate>;
  const put = (role: string, values: (string | number)[]) => { fields[role] = find(values, role); };
  const items = (s.d_items ?? s.items) as Record<string, any>[];
  const containers = (s.bl_containers ?? s.containers) as Record<string, any>[];
  if (type === "house_bl") {
    put("houseBlNumber", [s.hbl]);
    put("shipper", [s.shipper]);
    put("consignee", [s.bl_consignee ?? s.consignee]);
    put("portOfLoading", [s.bl_pol ?? s.pol]);
    put("portOfDischarge", [s.bl_pod ?? s.pod]);
    put("packageCount", [s.bl_packages ?? s.packages, s.packages]);
    put("packageUnit", pk);
    put("grossWeight", [s.bl_gross ?? s.gross]);
    put("grossWeightUnit", ["KGS"]);
    for (const it of (s.bl_items ?? s.items) as Record<string, any>[]) {
      const f = Object.fromEntries(itemFieldKeys.map((k) => [k, { value: null, evidence: null }])) as Record<string, Candidate>;
      f.goodsDescription = find([`${it.en} ${it.model}`, it.en], "goodsDescription", "item");
      const owner = layoutOf(f.goodsDescription, "goodsDescription", "item");
      f.quantity = find([it.quantity], "quantity", "item", owner);
      f.quantityUnit = find([it.unit], "quantityUnit", "item", owner);
      w.items.push({ fields: f as ShippingWire["items"][number]["fields"] });
    }
  } else if (type === "export_declaration") {
    put("declarationNumber", [s.d_declaration ?? s.declaration]);
    put("exporter", [`${s.shipper_ko} (${s.shipper})`, s.shipper_ko]);
    put("consignee", [s.d_consignee ?? s.consignee]);
    put("portOfLoading", [`${(s.d_pol ?? [s.pol_code])[0]} ${(s.d_pol ?? [null, s.pol_ko])[1]}`]);
    put("packageCount", [s.packages]);
    put("packageUnit", [s.pkg, ...pk]);
    put("grossWeight", [s.d_gross ?? s.gross]);
    put("grossWeightUnit", ["KG"]);
    for (const it of items) {
      const f = Object.fromEntries(itemFieldKeys.map((k) => [k, { value: null, evidence: null }])) as Record<string, Candidate>;
      f.goodsDescription = find([it.ko], "goodsDescription", "item");
      const owner = layoutOf(f.goodsDescription, "goodsDescription", "item");
      f.hsCode = find([it.hs], "hsCode", "item", owner);
      f.quantity = find([it.quantity], "quantity", "item", owner);
      f.quantityUnit = find([it.unit === "PCS" ? "EA" : it.unit], "quantityUnit", "item", owner);
      w.items.push({ fields: f as ShippingWire["items"][number]["fields"] });
    }
  } else {
    const conts = (s.m_containers ?? s.containers) as Record<string, any>[];
    const goods = (s.items as Record<string, any>[]).slice(0, 4);
    // One native row lists every container and goods line; one record per
    // list member, as the model returns it.
    const n = Math.max(conts.length, goods.length);
    for (let i = 0; i < n; i++) {
      const f = Object.fromEntries(cargoFieldKeys.map((k) => [k, { value: null, evidence: null }])) as Record<string, Candidate>;
      f.houseBlNumber = find([s.m_hbl ?? s.hbl], "houseBlNumber", "cargo");
      const owner = layoutOf(f.houseBlNumber, "houseBlNumber", "cargo");
      f.declarationNumber = find([s.m_declaration ?? s.declaration], "declarationNumber", "cargo", owner);
      f.shipper = find([s.shipper], "shipper", "cargo", owner);
      f.consignee = find([s.m_consignee ?? s.consignee], "consignee", "cargo", owner);
      f.packageCount = find([s.m_packages ?? s.packages], "packageCount", "cargo", owner);
      f.packageUnit = find([s.pkg], "packageUnit", "cargo", owner);
      f.grossWeight = find([s.m_gross ?? s.gross], "grossWeight", "cargo", owner);
      f.grossWeightUnit = find(["KGS"], "grossWeightUnit", "cargo", owner);
      if (goods[i]) f.goodsDescription = find([goods[i].en], "goodsDescription", "cargo", owner);
      if (conts[i]) {
        f.containerNumber = find([conts[i].container], "containerNumber", "cargo", owner);
        f.sealNumber = find([conts[i].seal, "/" + conts[i].seal], "sealNumber", "cargo", owner);
      }
      w.cargoRecords.push({ fields: f as ShippingWire["cargoRecords"][number]["fields"] });
    }
    // Other forwarders' rows of the consolidated list: cite their own HBL cell.
    for (const b of blocks) {
      if (b.text === (s.m_hbl ?? s.hbl)) continue;
      const c = { value: b.text, evidence: { page: 1, blockIds: [b.id] } };
      if (verifyShippingField(c, pdf, "houseBlNumber", "cargo").current.status !== "verified") continue;
      const f = Object.fromEntries(cargoFieldKeys.map((k) => [k, { value: null, evidence: null }])) as Record<string, Candidate>;
      f.houseBlNumber = c;
      w.cargoRecords.push({ fields: f as ShippingWire["cargoRecords"][number]["fields"] });
    }
  }
  if (type !== "house_manifest")
    for (const c of type === "export_declaration" ? s.containers : containers) {
      const anchor = find([`${c.container} / ${c.type}`, c.container], "containerNumber", "container");
      const owner = layoutOf(anchor, "containerNumber", "container");
      const seal = type === "house_bl" ? find([c.seal], "sealNumber", "container", owner) : { value: null, evidence: null };
      const none = { value: null, evidence: null };
      w.containers.push({ containerNumber: anchor, sealNumber: seal, sealNumbers: seal.value ? [seal] : [], packageCount: none, packageUnit: none, grossWeight: none, weightUnit: none } as ShippingWire["containers"][number]);
    }
  return { pdf, wire: w, document: groundShipping(w, pdf, type) };
}
export const officialFormTruth = truth;
