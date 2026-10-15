import { it, expect } from "vitest";
import { shipping34Fixture } from "../fixtures/shipping34";
import { reviewShipping } from "../../src/modules/shipping/review";
import { recoverNative } from "../../src/modules/shipping/recovery";
it.each([
  ["grossWeight", { weight: 699 }],
  ["quantity", { quantity: 719 }],
  ["sealNumber", { seal: "SEAL-OTHER-389" }],
  ["hsCode", { hsCode: "3924.10-0000" }],
  ["goodsDescription", { goods: "COTTON T SHIRTS" }],
] as const)(
  "detects %s errors from changed actual synthetic PDF contents, not mutated candidates",
  async (role, change) => {
    const a = await shipping34Fixture("house_bl"),
      b = await shipping34Fixture("house_manifest", change);
    const changed = String(Object.values(change)[0]);
    expect(b.pdf.pages.some((p) => p.text.includes(changed))).toBe(true);
    const r = reviewShipping([
      recoverNative(a.document, a.pdf),
      recoverNative(b.document, b.pdf),
    ]);
    const tests = r.primaryChecks!.filter(
      (c) => c.comparison?.meaning === role,
    );
    expect(
      tests.some((c) => c.assessment === "confirmed_mismatch"),
      JSON.stringify(
        tests.map((c) => [c.assessment, c.comparison?.reasonCodes]),
      ),
    ).toBe(true);
    expect(r.issues!.some((i) => i.assessment === "confirmed_mismatch")).toBe(
      true,
    );
  },
  15000,
);
it("keeps a physically changed HBL as an independent reference warning, not the same shipment", async () => {
  const a = await shipping34Fixture("house_bl"),
    b = await shipping34Fixture("house_manifest", {
      hbl: "HB-OTHER-SHIPMENT-389",
    });
  expect(b.pdf.pages[0].text).toContain("HB-OTHER-SHIPMENT-389");
  const r = reviewShipping([
    recoverNative(a.document, a.pdf),
    recoverNative(b.document, b.pdf),
  ]);
  expect(r.relationships!.every((r) => r.status !== "evidence_confirmed")).toBe(
    true,
  );
  expect(
    r.issues!.some(
      (i) => i.cause === "reference_conflict" || i.cause === "scope",
    ),
  ).toBe(true);
  expect(
    r.primaryChecks!.some(
      (c) => c.assessment === "confirmed_match" && c.documentIds?.length === 2,
    ),
  ).toBe(false);
}, 15000);

it("a partial third description does not hide an independently proven product conflict", async () => {
  const fs = await Promise.all([
    shipping34Fixture("house_bl"),
    shipping34Fixture("export_declaration"),
    shipping34Fixture("house_manifest", { goods: "COTTON T SHIRTS" }),
  ]);
  const ds = fs.map((f) => recoverNative(f.document, f.pdf));
  const r = reviewShipping(ds);
  expect(
    r.primaryChecks!.some(
      (c) =>
        c.assessment === "confirmed_mismatch" &&
        c.title === "입증된 품목 속성 충돌",
    ),
  ).toBe(true);
  for (const invalid of ["partial", "unverified", "different-hbl"]) {
    const d = structuredClone(ds);
    if (invalid === "partial") d[2].nativeScopeLimitation = "partial";
    if (invalid === "unverified")
      d[2].cargoRecords[0].fields.goodsDescription.current.status =
        "unverified";
    if (invalid === "different-hbl")
      d[2].fields.houseBlNumber.current.status = "user_edited";
    const held = reviewShipping(d);
    expect(
      held.primaryChecks!.some(
        (c) =>
          c.id.startsWith("direct-goods/") &&
          c.assessment === "confirmed_mismatch",
      ),
      invalid,
    ).toBe(false);
  }
}, 15000);
