import { wrapped36 } from "../fixtures/shipping36";
import { describe, it, expect, vi } from "vitest";
import { fixture35 } from "../fixtures/shipping35";
import { shipping34Fixture } from "../fixtures/shipping34";
import {
  recoverNative,
  recoveryTargets,
  mergeRecovery,
  recoveryStage,
  type RecoveryTarget,
} from "../../src/modules/shipping/recovery";
import {
  emptyShippingField,
  shippingDocumentSchema,
  shippingFieldSchema,
} from "../../src/modules/shipping/schema";
import {
  editShippingField,
  restoreShippingField,
} from "../../src/modules/shipping/edit";
import { reviewShipping } from "../../src/modules/shipping/review";
import { verified32, ref32 } from "../../src/modules/shipping/review-evidence";
import {
  recoverTargeted,
  targetedRequest,
} from "../../src/modules/shipping/targeted-recovery";
const wipe = (
  f: ReturnType<typeof fixture35> extends Promise<infer F> ? F : never,
  k = "quantity",
) => {
  f.document.items[0].fields[k] = emptyShippingField();
};
describe("PHASE36 independent native recovery and preserved first extraction", () => {
  it("restores missing item quantity and unit in their own PDF cells", async () => {
    const f = await fixture35("house_manifest");
    wipe(f);
    wipe(f, "quantityUnit");
    const before = structuredClone(f.document);
    const d = recoverNative(f.document, f.pdf);
    const q = d.items[0].fields.quantity;
    expect(q.original.value).toBeNull();
    expect(q.current.value).toBe(720);
    expect(q.recovery?.method).toBe("native");
    expect(q.current.status).toBe("verified");
    expect(d.items[0].fields.quantityUnit.current.value).toBe("PCS");
    expect(f.document).toEqual(before);
    expect(verified32(ref32(d, "quantity", q, { itemId: d.items[0].id }))).toBe(
      true,
    );
    expect(shippingDocumentSchema.safeParse(d).success).toBe(true);
  });
  it("keeps every already verified field unchanged", async () => {
    const f = await fixture35("house_manifest");
    const d = recoverNative(f.document, f.pdf);
    for (const [k, v] of Object.entries(f.document.fields))
      expect(d.fields[k]).toEqual(v);
    expect(d.items[0].fields.quantity).toEqual(
      f.document.items[0].fields.quantity,
    );
  });
  it("native recovery corrects an extraction mistake from its own PDF, not another document", async () => {
    const f = await fixture35("house_manifest", {
      rows: [{ name: "SYNTHETIC ITEM", hs: "7323.93-0000", qty: 480 }],
    });
    wipe(f);
    f.document.items[0].fields.quantity.original.value = 500;
    f.document.items[0].fields.quantity.current.value = 500;
    const d = recoverNative(f.document, f.pdf);
    expect(d.items[0].fields.quantity.current.value).toBe(480);
    expect(d.items[0].fields.quantity.original.value).toBe(500);
  });
  it("a genuine quantity mismatch remains a mismatch", async () => {
    const a = await fixture35("house_bl"),
      b = await fixture35("house_manifest", {
        rows: [
          {
            name: "SYNTHETIC METAL BOTTLE 600ML",
            hs: "7323.93-0000",
            qty: 700,
            packages: 60,
            gross: 640,
          },
        ],
      });
    wipe(b);
    const ds = [
      recoverNative(a.document, a.pdf),
      recoverNative(b.document, b.pdf),
    ];
    expect(
      reviewShipping(ds).primaryChecks?.find(
        (c) => c.comparison?.meaning === "quantity",
      )?.assessment,
    ).toBe("confirmed_mismatch");
  });
  it("cannot borrow another item row even if its quantity happens to be equal", async () => {
    const f = await fixture35("house_manifest", {
      rows: [
        { name: "SYNTHETIC A", hs: "7323.93-0000", qty: 500 },
        { name: "SYNTHETIC B", hs: "7323.94-0000", qty: 500 },
      ],
    });
    wipe(f);
    const t = recoveryTargets(f.document).find(
      (t) => t.role === "quantity" && t.entityId === f.document.items[0].id,
    )!;
    expect(
      mergeRecovery(f.pdf, t, f.wire.items[1].fields.quantity, "targeted_ai"),
    ).toBe(false);
    const d = recoverNative(f.document, f.pdf);
    expect(d.items[0].fields.quantity.current.source?.layout?.rowId).toBe(
      d.items[0].fields.goodsDescription.current.source?.layout?.rowId,
    );
  });
  it("preserves user edits and restores the independently recovered value for free", async () => {
    const f = await fixture35("house_manifest");
    wipe(f);
    let d = recoverNative(f.document, f.pdf);
    const q = d.items[0].fields.quantity;
    d.items[0].fields.quantity = editShippingField(q, 777);
    d = recoverNative(d, f.pdf);
    expect(d.items[0].fields.quantity.current.value).toBe(777);
    expect(verified32(ref32(d, "quantity", d.items[0].fields.quantity))).toBe(
      false,
    );
    const restored = restoreShippingField(d.items[0].fields.quantity);
    expect(restored.current.value).toBe(720);
    expect(restored.original.value).toBeNull();
    expect(restored.recovery).toEqual(q.recovery);
  });
  it("does not turn packages into pieces or gross into net", async () => {
    const f = await fixture35("house_manifest", {
      rows: [
        {
          name: "SYNTHETIC ITEM",
          hs: "7323.93-0000",
          packages: 20,
          gross: 320,
        },
      ],
    });
    wipe(f);
    const d = recoverNative(f.document, f.pdf);
    expect(d.items[0].fields.quantity.current.status).not.toBe("verified");
    expect(d.items[0].fields.netWeight.current.status).not.toBe("verified");
  });
  it("OCR positions cannot approve a recovery", async () => {
    const f = await fixture35("house_manifest");
    wipe(f);
    f.pdf.pages = f.pdf.pages.map((p) => ({
      ...p,
      textSource: "ocr" as const,
    }));
    const d = recoverNative(f.document, f.pdf);
    expect(d.items[0].fields.quantity.current.status).not.toBe("verified");
    expect(d.recoverySummary?.nativeApplied).toBe(0);
  });
  it("partial shipment still protects numeric confirmation after recovering a field", async () => {
    const a = await fixture35("house_bl"),
      b = await fixture35("house_manifest", {
        scope: "partial shipment",
        rows: [
          {
            name: "SYNTHETIC METAL BOTTLE 600ML",
            hs: "7323.93-0000",
            qty: 700,
            packages: 60,
            gross: 640,
          },
        ],
      });
    wipe(b);
    const d = recoverNative(b.document, b.pdf);
    expect(d.items[0].fields.quantity.current.status).toBe("verified");
    expect(
      reviewShipping([a.document, d]).primaryChecks?.find(
        (c) => c.comparison?.meaning === "quantity",
      )?.assessment,
    ).not.toBe("confirmed_mismatch");
  });
  it("the initial stage retains the actual missing first extraction", async () => {
    const f = await fixture35("house_manifest");
    wipe(f);
    const d = recoverNative(f.document, f.pdf),
      initial = recoveryStage(d, f.pdf, "initial");
    expect(initial.items[0].fields.quantity.current.value).toBeNull();
    expect(initial.items[0].fields.quantity.recovery).toBeUndefined();
  });
  it("old PHASE35 snapshots still parse", async () => {
    const f = await shipping34Fixture("house_bl");
    expect(shippingDocumentSchema.safeParse(f.document).success).toBe(true);
  });
  it("an unsupported document is not populated from native guesses", async () => {
    const f = await fixture35("house_manifest");
    wipe(f);
    f.document.classificationStatus = "needs_review";
    expect(recoverNative(f.document, f.pdf)).toEqual(f.document);
  });
  it("invented verified recovery metadata cannot bypass provenance checks", () => {
    const q = emptyShippingField();
    q.recovery = {
      method: "native",
      target: "x",
      failureCode: "MISSING_EXTRACTION",
      field: { ...q.original, status: "verified", value: 10 },
    };
    q.current = q.recovery.field;
    expect(shippingFieldSchema.safeParse(q).success).toBe(false);
  });
  it("same input yields the same recovery apart from timing metadata", async () => {
    const f = await fixture35("house_manifest");
    wipe(f);
    const a = recoverNative(f.document, f.pdf),
      b = recoverNative(f.document, f.pdf);
    a.recoverySummary!.nativeDurationMs =
      b.recoverySummary!.nativeDurationMs = 0;
    expect(a).toEqual(b);
  });
});
describe("bounded targeted recovery", () => {
  it("does not call a supplier when there are no real failed targets", async () => {
    const f = await fixture35("house_manifest");
    const d = recoverNative(f.document, f.pdf),
      extractor = vi.fn();
    await recoverTargeted(d, f.pdf, { extractor });
    expect(extractor).not.toHaveBeenCalled();
  });
  it("insufficient remaining server time preserves all initial results", async () => {
    const f = await wrapped36(),
      d = recoverNative(f.document, f.pdf),
      extractor = vi.fn();
    const before = structuredClone(d.fields.portOfLoading);
    await recoverTargeted(d, f.pdf, { extractor, deadline: Date.now() + 100 });
    expect(extractor).not.toHaveBeenCalled();
    expect(d.recoverySummary?.deferred).toBe(true);
    expect(d.fields.portOfLoading).toEqual(before);
  });
  it("an API failure preserves the successful document and never retries", async () => {
    const f = await wrapped36(),
      d = recoverNative(f.document, f.pdf),
      before = structuredClone(d.fields.portOfLoading),
      extractor = vi.fn().mockRejectedValue(new Error("synthetic failure"));
    await recoverTargeted(d, f.pdf, { extractor });
    expect(extractor).toHaveBeenCalledTimes(1);
    expect(d.fields.portOfLoading).toEqual(before);
    expect(d.recoverySummary?.failures.TARGETED_FAILED).toBe(1);
  });
  it("independently checks composed port blocks after one targeted call", async () => {
    const f = await wrapped36(),
      d = recoverNative(f.document, f.pdf),
      targets = recoveryTargets(d).filter(
        (t) => t.role === "portOfLoading" || t.role === "portOfDischarge",
      );
    const candidates = targets.map((t) => ({
      target: t.id,
      value: t.role === "portOfLoading" ? "KR PUS" : "US LAX",
      unit: null,
      page: 1,
      blockIds: f.pdf.pages[0]
        .blocks!.filter((b) =>
          (t.role === "portOfLoading" ? ["KR", "PUS"] : ["US", "LAX"]).includes(
            b.text,
          ),
        )
        .map((b) => b.id),
      entityOwner: t.entityId,
      candidateStatus: "found" as const,
    }));
    const extractor = vi.fn().mockResolvedValue({ candidates });
    await recoverTargeted(d, f.pdf, { extractor });
    expect(extractor).toHaveBeenCalledTimes(1);
    expect(d.fields.portOfLoading.current.value).toBe("KR PUS");
    expect(d.fields.portOfLoading.current.status).toBe("verified");
    expect(d.fields.portOfLoading.original.value).toBe("KRPUS");
    expect(d.recoverySummary?.aiApplied).toBe(2);
  });
  it("wrong entity ownership and fabricated blocks never approve candidates", async () => {
    const f = await fixture35("house_manifest");
    wipe(f);
    const t = recoveryTargets(f.document).find((t) => t.role === "quantity")!;
    expect(
      mergeRecovery(
        f.pdf,
        t,
        { value: 720, evidence: { page: 1, blockIds: ["invented"] } },
        "targeted_ai",
      ),
    ).toBe(false);
    expect(
      mergeRecovery(
        f.pdf,
        t,
        { value: 720, evidence: { page: 99, blockIds: ["p1-b0"] } },
        "targeted_ai",
      ),
    ).toBe(false);
  });
  it("the strict request is bounded, untrusted, and excludes filenames and unrelated verified fields", async () => {
    const f = await fixture35("house_manifest");
    wipe(f);
    const ts = recoveryTargets(f.document).filter((t) => t.role === "quantity");
    const body = targetedRequest(f.pdf, ts, "gpt-6-luna");
    expect(body.store).toBe(false);
    expect(body.max_output_tokens).toBe(1536);
    expect(body.text.format.strict).toBe(true);
    expect(body.input[0].content).toContain("UNTRUSTED DATA");
    expect(JSON.stringify(body)).not.toContain(f.pdf.fileName);
  });
});

describe("recovery scope and independent error preservation", () => {
  it("recovers a POL/POD swap from its own form and keeps the genuine port difference visible", async () => {
    const a = await fixture35("house_bl");
    const b = await fixture35("house_manifest", {
      ports: { loading: "LOS ANGELES, USA", discharge: "BUSAN, KOREA" },
    });
    for (const k of ["portOfLoading", "portOfDischarge"])
      b.document.fields[k] = emptyShippingField();
    const d = recoverNative(b.document, b.pdf);
    expect(d.fields.portOfLoading.current.value).toBe("LOS ANGELES, USA");
    expect(d.fields.portOfDischarge.current.value).toBe("BUSAN, KOREA");
    const r = reviewShipping([a.document, d]);
    for (const k of ["portOfLoading", "portOfDischarge"])
      expect(
        r.primaryChecks?.find((c) => c.comparison?.meaning === k)?.assessment,
      ).toBe("confirmed_mismatch");
  });
  it("a missing HBL cannot be borrowed from another cargo sharing its container", async () => {
    const f = await fixture35("house_manifest", {
      rows: [],
      cargos: [
        {
          name: "SYNTHETIC A",
          hbl: "HB-SYN-35-A",
          cn: "SYN-CN-35-A",
          qty: 500,
        },
        {
          name: "SYNTHETIC B",
          hbl: "HB-SYN-35-B",
          cn: "SYN-CN-35-A",
          qty: 500,
        },
      ],
    });
    f.document.cargoRecords[0].fields.houseBlNumber = emptyShippingField();
    const d = recoverNative(f.document, f.pdf);
    expect(d.cargoRecords[0].fields.houseBlNumber.current.status).not.toBe(
      "verified",
    );
  });
  it("another container's Seal cannot satisfy an owner-bound recovery", async () => {
    const f = await fixture35("house_manifest", {
      containers: [
        { name: "", cn: "SYN-CN-35-A", seal: "SYN-SEAL-35-A" },
        { name: "", cn: "SYN-CN-35-B", seal: "SYN-SEAL-35-B" },
      ],
    });
    f.document.containers[0].sealNumber = emptyShippingField();
    const t = recoveryTargets(f.document).find(
      (t) =>
        t.entityId === f.document.containers[0].id && t.role === "sealNumber",
    )!;
    expect(
      mergeRecovery(f.pdf, t, f.wire.containers[1].sealNumber, "targeted_ai"),
    ).toBe(false);
    expect(
      recoverNative(f.document, f.pdf).containers[0].sealNumber.current.value,
    ).toBe("SYN-SEAL-35-A");
  });
  it("recovering a selected item does not claim complete coverage of omitted physical rows", async () => {
    const f = await fixture35("house_manifest", {
      rows: [
        { name: "SYNTHETIC A", qty: 260 },
        { name: "SYNTHETIC B", qty: 460 },
      ],
      omitRows: [1],
    });
    wipe(f);
    const d = recoverNative(f.document, f.pdf);
    expect(d.items[0].fields.quantity.current.value).toBe(260);
    expect(d.collectionCoverage!.items.complete).toBe(false);
  });
  it("multiple independently printed quantities cannot be chosen by targeted AI", async () => {
    const f = await fixture35("house_manifest", {
      rows: [
        { name: "SYNTHETIC A", qty: 260 },
        { name: "SYNTHETIC B", qty: 460 },
      ],
    });
    const t: RecoveryTarget = {
      id: "document/quantity",
      role: "quantity",
      scope: "document",
      entityId: f.document.id,
      field: emptyShippingField(),
    };
    expect(
      mergeRecovery(f.pdf, t, f.wire.items[0].fields.quantity, "targeted_ai"),
    ).toBe(false);
  });
  it("recovering item quantities cannot manufacture a sum over shared packages", async () => {
    const f = await fixture35("house_manifest", {
      rows: [
        { name: "SYNTHETIC A", qty: 260, packages: 20 },
        { name: "SYNTHETIC B", qty: 460, packages: 20 },
      ],
      notice: "Shared packages; do not sum carton counts",
    });
    wipe(f);
    f.document.items[1].fields.quantity = emptyShippingField();
    const d = recoverNative(f.document, f.pdf);
    expect(d.items.map((i) => i.fields.quantity.current.value)).toEqual([
      260, 460,
    ]);
    expect(d.fields.packageCount.current.value).toBeNull();
    expect(
      d.additionalFields.some(
        (x) => x.meaning === "packageCount" && x.field.recovery,
      ),
    ).toBe(false);
  });
});

describe("packaging label and literal count scope", () => {
  it("PCS printed under Packages alone cannot be promoted into a goods quantity", async () => {
    const { packagesOnly36 } = await import("../fixtures/shipping36");
    const { nativeCandidates } =
      await import("../../src/modules/shipping/recovery");
    const { verifyShippingField } =
      await import("../../src/modules/shipping/verify");
    const f = await packagesOnly36();
    const t: RecoveryTarget = {
      id: "qty",
      role: "quantity",
      scope: "document",
      entityId: f.pdf.id,
      field: emptyShippingField(),
    };
    expect(
      nativeCandidates(f.pdf, t).every(
        (c) =>
          verifyShippingField(c, f.pdf, "quantity").current.status !==
          "verified",
      ),
    ).toBe(true);
  });
});
it("independently re-extracted column permutation retains quantity/package/weight and source roles", async () => {
  const { holdout36 } = await import("../fixtures/shipping36");
  const f = await holdout36("house_manifest");
  expect(f.document.classificationStatus).toBe("classified");
  for (const [k, n] of [
    ["quantity", 505],
    ["packageCount", 35],
    ["grossWeight", 412],
  ] as const) {
    expect(f.document.items[0].fields[k].current.value).toBe(n);
    expect(f.document.items[0].fields[k].current.status).toBe("verified");
  }
});
it("a country/address in the next closed cell is not a port literal", async () => {
  const { unicodePdf } = await import("../fixtures/shipping31");
  const { extractPdfText } = await import("../../src/modules/pdf/extract");
  const { verifyShippingField } =
    await import("../../src/modules/shipping/verify");
  const bytes = unicodePdf(
    [
      [
        { text: "POL", x: 30, y: 75 },
        { text: "BUSAN", x: 30, y: 105 },
        { text: "USA", x: 30, y: 145 },
      ],
    ],
    {
      borders: [
        [
          { x: 20, y: 55, width: 240, height: 60 },
          { x: 20, y: 115, width: 240, height: 60 },
        ],
      ],
    },
  );
  const pdf = {
    id: "synthetic-neighbor36",
    fileName: "synthetic-neighbor36.pdf",
    pages: await extractPdfText(bytes, undefined, false, true),
  };
  const block = pdf.pages[0].blocks!.find((b) => b.text === "USA")!;
  expect(
    verifyShippingField(
      { value: "USA", evidence: { page: 1, blockIds: [block.id] } },
      pdf,
      "portOfLoading",
    ).current.status,
  ).toBe("unverified");
});
it("missing weight unit can use its own native column header, but not another page header", async () => {
  const f = await shipping34Fixture("house_manifest");
  f.document.cargoRecords[0].fields.grossWeightUnit = emptyShippingField();
  const d = recoverNative(f.document, f.pdf);
  expect(d.cargoRecords[0].fields.grossWeightUnit.current.value).toBe("KG");
  expect(d.cargoRecords[0].fields.grossWeightUnit.current.status).toBe(
    "verified",
  );
  const t = recoveryTargets(f.document).find(
    (t) => t.role === "grossWeightUnit" && t.scope === "cargo",
  )!;
  const candidate = f.wire.cargoRecords[0].fields.grossWeightUnit;
  const pdf = {
    ...f.pdf,
    pages: [...f.pdf.pages, f.pdf.pages[0]].map((p, i) => ({
      ...p,
      page: i + 1,
    })),
  };
  expect(
    mergeRecovery(
      pdf,
      t,
      { ...candidate, evidence: { ...candidate.evidence!, page: 2 } },
      "targeted_ai",
    ),
  ).toBe(false);
});
it("HS recovery separates the printed label from its literal code before comparison", async () => {
  const a = await shipping34Fixture("house_bl"),
    b = await shipping34Fixture("house_manifest");
  b.document.cargoRecords[0].fields.hsCode = emptyShippingField();
  const d = recoverNative(b.document, b.pdf),
    f = d.cargoRecords[0].fields.hsCode;
  expect(f.current.value).toBe("7010.90-1000");
  expect(f.current.status).toBe("verified");
  expect(
    reviewShipping([a.document, d])
      .primaryChecks?.filter((c) => c.comparison?.meaning === "hsCode")
      .some((c) => c.assessment === "confirmed_mismatch"),
  ).toBe(false);
});
it("an entire labelled HS annotation is not the HS value even though the quotation exists", async () => {
  const f = await shipping34Fixture("house_manifest");
  const { verifyShippingField } =
    await import("../../src/modules/shipping/verify");
  const b = f.pdf.pages[0].blocks!.find((b) => b.text.startsWith("(HS "))!;
  expect(
    verifyShippingField(
      { value: b.text, evidence: { page: 1, blockIds: [b.id] } },
      f.pdf,
      "hsCode",
      "cargo",
    ).current.status,
  ).toBe("unverified");
});
it("a real printed difference in HS six-digit codes remains a mismatch after recovery", async () => {
  const a = await fixture35("house_bl"),
    b = await fixture35("house_manifest", {
      rows: [
        {
          name: "SYNTHETIC METAL BOTTLE 600ML",
          hs: "7323.94-0000",
          qty: 720,
          packages: 60,
          gross: 640,
        },
      ],
    });
  b.document.items[0].fields.hsCode = emptyShippingField();
  const d = recoverNative(b.document, b.pdf);
  expect(d.items[0].fields.hsCode.current.status).toBe("verified");
  expect(
    reviewShipping([a.document, d]).primaryChecks?.find(
      (c) => c.comparison?.meaning === "hsCode",
    )?.assessment,
  ).toBe("confirmed_mismatch");
});
