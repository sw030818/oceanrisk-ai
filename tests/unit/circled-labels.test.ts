import { it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { extractPdfText } from "../../src/modules/pdf/extract";
import { shippingRole, circledAsParen } from "../../src/modules/shipping/roles";
import { verifyShippingField } from "../../src/modules/shipping/verify";

// 한국무역협회 B/L and UNI-PASS forms number boxes with circled digits
// (① Shipper/Exporter, ⑪ B/L No.). They are the same box numbers as "(1)".
it("reads circled box numbers like parenthesized ones, never in values", () => {
  for (const [label, role] of [
    ["① Shipper/Exporter", "shipper"], ["② Consignee", "consignee"], ["⑤ Port of Loading", "portOfLoading"],
    ["⑧ Port of Discharge", "portOfDischarge"], ["⑪ B/L No.", "houseBlNumber"], ["⑯ Description of Goods", "goodsDescription"],
    ["⑰ Gross Weight", "grossWeight"], ["㉟ 세번부호", "hsCode"], ["㊹ 총중량", "grossWeight"],
  ] as const) {
    expect(shippingRole(label)).toBe(role);
    expect(shippingRole(label.replace(/^\S+/, (c) => `(${c.normalize("NFKC")})`))).toBe(role);
  }
  expect(circledAsParen("⑬ Container No. ⑭ Seal No.")).toBe("(13) Container No. (14) Seal No.");
  expect(circledAsParen("BUSAN, KOREA 2 PACKAGES")).toBe("BUSAN, KOREA 2 PACKAGES");
});

it("verifies values under circled labels of a 한국무역협회-style B/L", async () => {
  const bytes = new Uint8Array(await readFile("tests/fixtures/circled/house-bl-circled.pdf"));
  const pdf = { id: "synthetic-circled-bl", fileName: "bl.pdf", pages: await extractPdfText(bytes, undefined, false, true) };
  const id = (text: string) => pdf.pages[0].blocks!.find((b) => b.text === text)!.id;
  const check = (role: string, value: string, ids: string[]) =>
    verifyShippingField({ value, evidence: { page: 1, blockIds: ids } }, pdf, role).current.status;
  expect(check("shipper", "DAON ELECTRONICS CO., LTD.", [id("① Shipper/Exporter"), id("DAON ELECTRONICS CO., LTD.")])).toBe("verified");
  expect(check("houseBlNumber", "ARFWPUS2683540", [id("⑪ B/L No. : ARFWPUS2683540")])).toBe("verified");
  expect(check("consignee", "BHARAT LINK PVT. LTD.", [id("② Consignee"), "p1-b6"])).toBe("verified");
  // A wrong value under the same circled label is still rejected.
  expect(check("houseBlNumber", "ARFWPUS2683541", [id("⑪ B/L No. : ARFWPUS2683540")])).not.toBe("verified");
  expect(check("portOfLoading", "DAON ELECTRONICS CO., LTD.", [id("① Shipper/Exporter"), id("DAON ELECTRONICS CO., LTD.")])).not.toBe("verified");
}, 60000);
