import { extractPdfText } from "@/modules/pdf/extract";
import { requestUpperCost } from "../../scripts/lib/openai-budget";
import { describe, it, expect, vi, afterEach } from "vitest";
import { shipping31Fixture, unicodePdf } from "../fixtures/shipping31";
import { shippingTypes } from "@/modules/shipping/catalog";
import { groundShipping } from "@/modules/shipping/ground";
import { verifyShippingField } from "@/modules/shipping/verify";
import { shippingWireSchema } from "@/modules/shipping/ai-schema";
import {
  extractShippingWithOpenAI,
  shippingOpenAIRequest,
} from "@/modules/shipping/openai";
import { analyzeShippingFile } from "@/modules/shipping/analysis";
import {
  editShippingField,
  restoreShippingField,
} from "@/modules/shipping/edit";
import { POST } from "@/app/api/analyze/route";
import { shippingDocumentSchema } from "@/modules/shipping/schema";
const complete = (wire: unknown) =>
  new Response(
    JSON.stringify({
      status: "completed",
      output: [
        {
          type: "message",
          phase: "commentary",
          content: [{ type: "output_text", text: "NOT JSON INTERMEDIATE" }],
        },
        {
          type: "message",
          phase: "final_answer",
          status: "completed",
          content: [{ type: "output_text", text: JSON.stringify(wire) }],
        },
      ],
    }),
  );
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe("PHASE 3.1 real synthetic PDF + MOCKED AI, independent evidence", () => {
  it.each(shippingTypes)(
    "grounds normal %s title, identifiers, document totals and each container row",
    async (type) => {
      const f = await shipping31Fixture(type),
        d = f.document;
      expect(f.pdf.pages).toHaveLength(2);
      expect(d.classificationStatus).toBe("classified");
      expect(d.detectedType).toBe(type);
      for (const [key, g] of Object.entries(d.fields))
        if (g.original.value !== null)
          expect(g.original.status, `${type}:${key}:${g.original.reason}`).toBe(
            "verified",
          );
      for (const [i, c] of d.containers.entries())
        for (const key of [
          "containerNumber",
          "sealNumber",
          "packageCount",
          "packageUnit",
          "grossWeight",
          "weightUnit",
        ] as const)
          expect(
            c[key].original.status,
            `${type}:container${i}:${key}:${c[key].original.reason}`,
          ).toBe("verified");
      expect(d.containers.map((c) => c.grossWeight.original.value)).toEqual([
        320, 340,
      ]);
      expect(d.references.map((r) => r.number.original.status)).toEqual([
        "verified",
        "verified",
      ]);
    },
  );
  it("reads real Korean/English searchable text and preserves multiple HS Code strings/leading zeroes", async () => {
    const f = await shipping31Fixture("export_declaration");
    expect(f.pdf.pages[0].text).toContain("수출신고필증");
    expect(f.document.items.map((i) => i.fields.hsCode.original.value)).toEqual(
      ["0303890000", "0070000000"],
    );
    for (const i of f.document.items)
      for (const key of [
        "goodsDescription",
        "hsCode",
        "quantity",
        "quantityUnit",
        "packageCount",
        "packageUnit",
        "netWeight",
        "grossWeight",
        "netWeightUnit",
        "grossWeightUnit",
      ])
        expect(
          i.fields[key].original.status,
          `${key}:${i.fields[key].original.reason}`,
        ).toBe("verified");
  });
  it("grounds separate Manifest cargo records and does not flatten BL or container references", async () => {
    const f = await shipping31Fixture("house_manifest");
    expect(f.document.cargoRecords).toHaveLength(2);
    expect(
      f.document.cargoRecords.map((r) => r.fields.houseBlNumber.original.value),
    ).toEqual(["HB-2026-001", "HB-2026-002"]);
    for (const r of f.document.cargoRecords)
      for (const f of Object.values(r.fields))
        if (f.original.value !== null)
          expect(f.original.status, f.original.reason).toBe("verified");
  });
  it("keeps classification and requested type separate and projects fields from actual type", async () => {
    const f = await shipping31Fixture("house_bl");
    const d = groundShipping(f.wire, f.pdf, "house_manifest");
    expect(d.uploadType).toBe("house_manifest");
    expect(d.fieldType).toBe("house_bl");
    expect(d.detectedType).toBe("house_bl");
    expect(d.fields.notifyParty.original.value).toBe("Notify Logistics Ltd.");
    expect(shippingDocumentSchema.safeParse(d).success).toBe(true);
  });
  it("missing important information creates partial analysis without inferred values", async () => {
    const f = await shipping31Fixture("house_bl", { missing: true });
    expect(f.document.fields.houseBlNumber.original.value).toBeNull();
    expect(f.document.extractionStatus).toBe("partial");
    expect(f.document.informationWarnings.length).toBeGreaterThan(0);
  });
  it("uncertain or invented type evidence never verifies classification", async () => {
    const f = await shipping31Fixture("house_bl"),
      w = structuredClone(f.wire);
    w.typeEvidence = { page: 1, blockIds: ["invented"] };
    expect(groundShipping(w, f.pdf, "house_bl").classificationStatus).toBe(
      "needs_review",
    );
    w.type = "unknown";
    w.typeEvidence = null;
    expect(groundShipping(w, f.pdf, "house_bl").detectedType).toBeNull();
  });
  it("distinguishes PCS goods quantities from CTNS packages despite repeated 500 values", async () => {
    const f = await shipping31Fixture("export_declaration"),
      w = structuredClone(f.wire);
    w.items[0].fields.quantity = w.containers[0].packageCount;
    const d = groundShipping(w, f.pdf, "export_declaration");
    expect(d.items[0].fields.quantity.original.status).toBe("unverified");
    expect(d.containers[0].packageCount.original.status).toBe("verified");
  });
  it("rejects another container row even if the correct number occurs repeatedly", async () => {
    const f = await shipping31Fixture("house_bl", { badEvidence: true });
    expect(f.document.containers[0].grossWeight.original.status).toBe(
      "unverified",
    );
    expect(f.document.containers[1].grossWeight.original.status).toBe(
      "verified",
    );
  });
  it("rejects another item row and a net-weight cell cited as gross weight", async () => {
    const f = await shipping31Fixture("export_declaration"),
      w = structuredClone(f.wire);
    w.items[0].fields.quantity = w.items[1].fields.quantity;
    w.items[0].fields.grossWeight = w.items[0].fields.netWeight;
    const d = groundShipping(w, f.pdf, "export_declaration");
    expect(d.items[0].fields.quantity.original.status).toBe("unverified");
    expect(d.items[0].fields.grossWeight.original.status).toBe("unverified");
    expect(d.items[0].fields.hsCode.original.status).toBe("verified");
  });
  it("never promotes an item/container weight into a document total", async () => {
    const f = await shipping31Fixture("house_bl"),
      w = structuredClone(f.wire);
    w.fields.grossWeight = w.containers[0].grossWeight;
    expect(
      groundShipping(w, f.pdf, "house_bl").fields.grossWeight.original.status,
    ).toBe("unverified");
  });
  it.each(["page", "block", "number", "duplicate"] as const)(
    "rejects forged %s evidence while retaining the candidate value",
    async (kind) => {
      const f = await shipping31Fixture("house_bl"),
        c = structuredClone(f.wire.fields.grossWeight);
      if (kind === "page") c.evidence!.page = 99;
      if (kind === "block") c.evidence!.blockIds = ["not-real"];
      if (kind === "number") c.value = 999999;
      if (kind === "duplicate")
        c.evidence!.blockIds.push(c.evidence!.blockIds[0]);
      const g = verifyShippingField(c, f.pdf, "grossWeight");
      expect(g.original.value).toBe(c.value);
      expect(g.original.status).toBe("unverified");
    },
  );
  it("rejects a party role switch even when both names exist in the PDF", async () => {
    const f = await shipping31Fixture("house_bl"),
      w = structuredClone(f.wire);
    w.fields.consignee = w.fields.shipper;
    expect(
      groundShipping(w, f.pdf, "house_bl").fields.consignee.original.status,
    ).toBe("unverified");
  });
  it("does not duplicate a single physical goods row as multiple independently verified items", async () => {
    const f = await shipping31Fixture("export_declaration"),
      w = structuredClone(f.wire);
    w.items.push(structuredClone(w.items[0]));
    expect(
      groundShipping(w, f.pdf, "export_declaration").items[0].fields.quantity
        .original.status,
    ).toBe("unverified");
  });
  it("retains original candidate and evidence when editing/restoring", async () => {
    const f = await shipping31Fixture("house_bl"),
      g = f.document.fields.grossWeight;
    const changed = editShippingField(g, 12500);
    expect(changed.original.value).toBe(12340);
    expect(changed.current.status).toBe("user_edited");
    expect(changed.current.source).toEqual(g.original.source);
    expect(restoreShippingField(changed).current).toEqual(g.original);
  });
  it("strict schema rejects numeric identifiers and invented extra keys", async () => {
    const f = await shipping31Fixture("export_declaration");
    expect(
      shippingWireSchema.safeParse({
        ...f.wire,
        items: [
          {
            fields: {
              ...f.wire.items[0].fields,
              hsCode: { value: 303890000, evidence: null },
            },
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      shippingWireSchema.safeParse({ ...f.wire, legalRisk: "unsafe" }).success,
    ).toBe(false);
  });
  it("uses the shared Responses protocol, final_answer only, no filenames/slot or raw instructions as system text", async () => {
    const f = await shipping31Fixture("house_bl");
    const fetcher = vi.fn<typeof fetch>(async () => complete(f.wire));
    const w = await extractShippingWithOpenAI(f.pdf, {
      apiKey: "synthetic-test-key",
      fetcher,
    });
    expect(w.type).toBe("house_bl");
    expect(fetcher).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string);
    expect(body.store).toBe(false);
    expect(body.text.format.strict).toBe(true);
    expect(body.max_output_tokens).toBe(8192);
    expect(JSON.stringify(body)).not.toContain(f.pdf.fileName);
    expect(body.input[0].content).toContain("UNTRUSTED DATA");
    expect(shippingOpenAIRequest(f.pdf, "gpt-6-luna").text.format.name).toBe(
      "shipping_document_v31",
    );
  });
  it.each([401, 429, 500])(
    "handles provider %s safely without retries",
    async (status) => {
      const f = await shipping31Fixture("house_bl"),
        fetcher = vi.fn(
          async () =>
            new Response(
              JSON.stringify({
                error: {
                  code:
                    status === 401 ? "invalid_api_key" : "rate_limit_exceeded",
                  message: "SECRET DOCUMENT MUST NOT LEAK",
                },
              }),
              { status },
            ),
        );
      await expect(
        extractShippingWithOpenAI(f.pdf, {
          apiKey: "synthetic-test-key",
          fetcher,
        }),
      ).rejects.toMatchObject({
        code:
          status === 401
            ? "API_AUTH_OR_CONFIG"
            : status === 429
              ? "API_RATE_LIMIT"
              : "API_ERROR",
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it.each(["timeout", "tokens", "json"] as const)(
    "distinguishes %s failure, without repair or retry",
    async (kind) => {
      const f = await shipping31Fixture("house_bl");
      const fetcher = vi.fn(async () => {
        if (kind === "timeout")
          throw new DOMException("timed out", "TimeoutError");
        return new Response(
          JSON.stringify(
            kind === "tokens"
              ? {
                  status: "incomplete",
                  incomplete_details: { reason: "max_output_tokens" },
                  output: [],
                }
              : {
                  status: "completed",
                  output: [
                    {
                      type: "message",
                      content: [{ type: "output_text", text: "NOT JSON" }],
                    },
                  ],
                },
          ),
        );
      });
      await expect(
        extractShippingWithOpenAI(f.pdf, {
          apiKey: "synthetic-test-key",
          fetcher,
        }),
      ).rejects.toMatchObject(
        kind === "timeout"
          ? { code: "API_UNAVAILABLE" }
          : {
              diagnostics: {
                outputIssue: kind === "tokens" ? "MAX_TOKENS" : "INVALID_JSON",
              },
            },
      );
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it("keeps readable PDF on missing key or failed AI and supports real mismatch flags", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const f = await shipping31Fixture("house_bl"),
      file = new File([new Uint8Array(f.bytes)], "synthetic.pdf", {
        type: "application/pdf",
      });
    const failed = await analyzeShippingFile(file, "house_bl");
    expect(failed.error?.code).toBe("API_NOT_CONFIGURED");
    expect(failed.pdf.pages).toHaveLength(2);
    const result = await analyzeShippingFile(file, "house_manifest", {
      ai: async () => f.wire,
    });
    expect(result.typeMismatch).toBe(true);
    expect(result.document?.fieldType).toBe("house_bl");
  });
  it("public analyze operation preserves PDFs and leaves triangle unperformed when no key exists", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const f = await shipping31Fixture("house_bl"),
      form = new FormData();
    for (let i = 0; i < 2; i++)
      form.append(
        "files",
        new File([new Uint8Array(f.bytes)], `synthetic${i}.pdf`, {
          type: "application/pdf",
        }),
      );
    form.append("slots", '["house_bl","house_manifest"]');
    form.append("operation", "analyze");
    const r = await POST(
      new Request("https://test/api/analyze", { method: "POST", body: form }),
    );
    const data = await r.json();
    expect(data.mode).toBe("shipping-analysis");
    expect(data.results[0].error.code).toBe("API_NOT_CONFIGURED");
    expect(data.results[1].error.code).toBe("BATCH_STOPPED");
    expect(
      data.results.every(
        (r: { pdf: { pages: unknown[] } }) => r.pdf.pages.length === 2,
      ),
    ).toBe(true);
    expect(data.review.status).toBe("not_performed");
  });
});

describe("PHASE 3.1 extra semantic safeguards (MOCKED AI)", () => {
  it.each(shippingTypes)(
    "keeps missing %s required data partial",
    async (type) => {
      const f = await shipping31Fixture(type, { missing: true });
      expect(f.document.extractionStatus).toBe("partial");
      expect(f.document.informationWarnings.length).toBeGreaterThan(0);
    },
  );
  it("does not use an item weight-unit header for a document total unit", async () => {
    const f = await shipping31Fixture("house_bl"),
      w = structuredClone(f.wire);
    w.fields.grossWeightUnit = w.items[0].fields.grossWeightUnit;
    expect(
      groundShipping(w, f.pdf, "house_bl").fields.grossWeightUnit.original
        .status,
    ).toBe("unverified");
  });
  it("does not use another table header to ground an item unit", async () => {
    const f = await shipping31Fixture("export_declaration"),
      w = structuredClone(f.wire);
    w.items[0].fields.quantityUnit = w.containers[0].packageUnit;
    expect(
      groundShipping(w, f.pdf, "export_declaration").items[0].fields
        .quantityUnit.original.status,
    ).toBe("unverified");
  });
  it("does not promote a partial party substring into the full name", async () => {
    const f = await shipping31Fixture("house_bl"),
      w = structuredClone(f.wire);
    w.fields.shipper.value = "Pacific";
    expect(
      groundShipping(w, f.pdf, "house_bl").fields.shipper.original.status,
    ).toBe("unverified");
  });
  it("retains separate Seal provenance and refuses an ungrounded container anchor", async () => {
    const f = await shipping31Fixture("house_bl"),
      w = structuredClone(f.wire);
    w.containers[0].containerNumber.evidence = null;
    const d = groundShipping(w, f.pdf, "house_bl");
    expect(d.containers[0].sealNumbers![0].original.status).toBe("unverified");
  });
});

it("grounds multiple actual Seal blocks separately on one container row", async () => {
  const f = await shipping31Fixture("house_bl", { extraSeals: true });
  expect(
    f.document.containers[0].sealNumbers!.map((s) => [
      s.original.value,
      s.original.status,
    ]),
  ).toEqual([
    ["SEAL-001", "verified"],
    ["SEAL-003", "verified"],
  ]);
});
it("rejects a Seal from another container row without discarding the valid container", async () => {
  const f = await shipping31Fixture("house_bl"),
    w = structuredClone(f.wire);
  w.containers[0].sealNumbers = [w.containers[1].sealNumbers[0]];
  const d = groundShipping(w, f.pdf, "house_bl");
  expect(d.containers[0].sealNumbers![0].original.status).toBe("unverified");
  expect(d.containers[0].containerNumber.original.status).toBe("verified");
});
it("invalidates Seal provenance when a physical container row is duplicated", async () => {
  const f = await shipping31Fixture("house_bl"),
    w = structuredClone(f.wire);
  w.containers.push(structuredClone(w.containers[0]));
  expect(
    groundShipping(w, f.pdf, "house_bl").containers[0].sealNumbers![0].original
      .status,
  ).toBe("unverified");
});

it("rejects a merged numeric block containing goods and package counts even with a quantity label", async () => {
  const pages = await extractPdfText(
    unicodePdf([[{ text: "Quantity: 500 PCS 20 CTNS", x: 35, y: 40 }]]),
  );
  const pdf = {
    id: "synthetic-merged",
    fileName: "synthetic-merged.pdf",
    pages,
  };
  const g = verifyShippingField(
    { value: 500, evidence: { page: 1, blockIds: [pages[0].blocks![0].id] } },
    pdf,
    "quantity",
  );
  expect(g.original.status).toBe("unverified");
  expect(g.original.verificationCode).toBe("ambiguous_cell");
});
it("reserves the larger shipping output cap without changing the legacy default", () => {
  expect(requestUpperCost(10000, 8192)).toBeGreaterThan(
    requestUpperCost(10000),
  );
  expect(() => requestUpperCost(10000, Infinity)).toThrow(
    "INVALID_OUTPUT_RESERVATION",
  );
});
