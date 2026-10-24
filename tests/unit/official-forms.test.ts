import { it, expect } from "vitest";
import { officialFormOracle, officialFormTruth } from "../fixtures/official-forms";
import { shippingTypes } from "../../src/modules/shipping/catalog";
import { reviewShipping } from "../../src/modules/shipping/review";
import { shippingValues } from "../../src/modules/shipping/fields";

// Native verification on the official forms: compound headers (S)/C)/N),
// 1)/2), "컨테이너번호/봉인번호"), declaration item blocks (란), list cells,
// in-words totals in a body column and duplicate views of one manifest row.
it.each(["normal", "mismatch"] as const)("official forms: every cited truth value verifies (%s)", async (kind) => {
  const fs = await Promise.all(shippingTypes.map((t) => officialFormOracle(kind, t)));
  for (const f of fs) {
    expect(f.document.classificationStatus, f.document.uploadType).toBe("classified");
    const missing = Object.entries(f.wire.fields).filter(([k, v]) => v.value === null && ["houseBlNumber", "declarationNumber", "packageCount", "grossWeight", "portOfLoading"].includes(k) && !(f.document.uploadType === "house_manifest") && !(k === "houseBlNumber" && f.document.uploadType === "export_declaration") && !(k === "declarationNumber" && f.document.uploadType === "house_bl") && !(k === "portOfLoading" && false));
    expect(missing.map(([k]) => f.document.uploadType + ":" + k)).toEqual([]);
    const failed = shippingValues(f.document).filter((v) => v.original.value !== null && v.current.status !== "verified" && v.current.value !== null);
    expect(failed.map((v) => [f.document.uploadType, v.current.value, v.current.verificationCode])).toEqual([]);
  }
}, 60000);
it("official forms: a normal consolidated set has no confirmed mismatch and links the declaration through the manifest row", async () => {
  const docs = (await Promise.all(shippingTypes.map((t) => officialFormOracle("normal", t)))).map((f) => f.document);
  const r = reviewShipping(docs);
  expect(r.primaryChecks!.filter((c) => c.assessment === "confirmed_mismatch").map((c) => [c.title, c.comparison?.meaning])).toEqual([]);
  const bl = docs.find((d) => d.uploadType === "house_bl")!, decl = docs.find((d) => d.uploadType === "export_declaration")!;
  const link = r.relationships!.find((x) => x.documentIds.includes(bl.id) && x.documentIds.includes(decl.id))!;
  expect(link.status).toBe("evidence_confirmed");
  expect(r.primaryChecks!.some((c) => c.assessment === "confirmed_match" && c.comparison?.meaning === "grossWeight")).toBe(true);
}, 60000);
it("official forms: the manifest package-count error is confirmed", async () => {
  const docs = (await Promise.all(shippingTypes.map((t) => officialFormOracle("mismatch", t)))).map((f) => f.document);
  const r = reviewShipping(docs);
  expect(officialFormTruth.mismatch.expect.role).toBe("packageCount");
  expect(r.primaryChecks!.filter((c) => c.assessment === "confirmed_mismatch").map((c) => c.comparison?.meaning)).toContain("packageCount");
  expect(r.primaryChecks!.filter((c) => c.assessment === "confirmed_mismatch").map((c) => c.comparison?.meaning).filter((m) => m !== "packageCount")).toEqual([]);
}, 60000);
