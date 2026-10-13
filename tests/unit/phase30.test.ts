import { describe, it, expect, vi, afterEach } from "vitest";
import { makePdf } from "../fixtures/synthetic";
import { POST } from "@/app/api/analyze/route";
import { shippingTypes, shippingFields } from "@/modules/shipping/catalog";
import {
  createShippingDocument,
  shippingDocumentSchema,
  shippingCaseSchema,
  emptyShippingField,
  shippingFieldSchema,
} from "@/modules/shipping/schema";
import {
  editShippingField,
  restoreShippingField,
} from "@/modules/shipping/edit";
import { prepareShippingFile } from "@/modules/shipping/prepare";
import { summarizeShipping } from "@/modules/shipping/summary";
import { parseShippingSlots } from "@/modules/shipping/uploads";
const pdf = { id: "synthetic", fileName: "synthetic.pdf", pages: [] };
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
async function form(
  slots: string[] = ["house_bl", "house_manifest"],
  broken = false,
) {
  const data = new FormData();
  const bytes = await makePdf([
    [
      "SYNTHETIC HOUSE B/L",
      "HBL: HB-001",
      "Packages: 20 CTNS",
      "Gross Weight: 300 KG",
    ],
    ["Second page source"],
  ]);
  slots.forEach((_, i) =>
    data.append(
      "files",
      new File(
        [i === 0 && broken ? "fake PDF" : new Uint8Array(bytes)],
        `synthetic-${i}.pdf`,
        { type: "application/pdf" },
      ),
    ),
  );
  data.append("slots", JSON.stringify(slots));
  return data;
}
async function send(body: FormData, origin?: string) {
  return POST(
    new Request("https://test/api/analyze", {
      method: "POST",
      body,
      headers: origin ? { origin } : {},
    }),
  );
}
describe("PHASE 3.0 shipping foundation, no AI or comparison claims", () => {
  it.each(shippingTypes)(
    "creates a distinct pending %s record, not an Invoice/PL",
    (type) => {
      const d = createShippingDocument(pdf, type);
      expect(d.uploadType).toBe(type);
      expect(d.detectedType).toBeNull();
      expect(d.classificationStatus).toBe("not_performed");
      expect(d.extractionStatus).toBe("not_performed");
      expect(Object.keys(d.fields)).toEqual(shippingFields[type]);
      expect(d.fields).not.toHaveProperty("seller");
      expect(d.fields).not.toHaveProperty("totalAmount");
      expect(
        Object.values(d.fields).every(
          (f) =>
            f.original.value === null &&
            f.current.status === "missing" &&
            f.current.source === null,
        ),
      ).toBe(true);
      expect(d.items).toEqual([]);
      expect(d.containers).toEqual([]);
      expect(d.references).toEqual([]);
    },
  );
  it("keeps original state and editable current state separate without granting verified evidence", () => {
    const original = emptyShippingField(),
      edit = editShippingField(original, 500);
    expect(original.current.value).toBeNull();
    expect(edit.original.value).toBeNull();
    expect(edit.current.value).toBe(500);
    expect(edit.current.status).toBe("user_edited");
    expect(edit.current.source).toBeNull();
    expect(shippingFieldSchema.safeParse(edit).success).toBe(true);
    expect(restoreShippingField(edit)).toEqual(original);
    expect(
      shippingFieldSchema.safeParse({
        original: original.original,
        current: { ...edit.current, status: "verified" },
      }).success,
    ).toBe(false);
  });
  it("does not let a correction lose its original value or pretend to be an unverified AI extraction", () => {
    const original = emptyShippingField();
    const correction = editShippingField(original, 20);
    expect(
      shippingFieldSchema.safeParse({
        ...correction,
        current: { ...correction.current, status: "unverified" },
      }).success,
    ).toBe(false);
    expect(correction.original.value).toBeNull();
  });
  it("does not accept package counts as descriptions or a string as numeric quantity", () => {
    const d = createShippingDocument(pdf, "export_declaration");
    d.fields.quantity.current = editShippingField(
      d.fields.quantity,
      "500",
    ).current;
    expect(shippingDocumentSchema.safeParse(d).success).toBe(false);
    d.fields.quantity.current = editShippingField(
      d.fields.quantity,
      500,
    ).current;
    expect(shippingDocumentSchema.safeParse(d).success).toBe(true);
    expect(d.fields.packageCount.current.value).toBeNull();
  });
  it("supports one BL, two declarations, multiple containers and explicit many-to-many references without automatic links", () => {
    const docs = [
      "house_bl",
      "export_declaration",
      "export_declaration",
      "house_manifest",
    ].map((type, i) =>
      createShippingDocument(
        { ...pdf, id: "doc" + i },
        type as (typeof shippingTypes)[number],
      ),
    );
    const field = emptyShippingField();
    docs[0].containers = [
      {
        id: "c1",
        containerNumber: editShippingField(field, "ABCD1234567"),
        sealNumber: field,
        packageCount: editShippingField(field, 20),
        packageUnit: editShippingField(field, "CTNS"),
        grossWeight: field,
        weightUnit: field,
      },
    ];
    docs[1].references = [
      {
        id: "r1",
        kind: "export_declaration",
        number: editShippingField(field, "DEC-001"),
      },
      {
        id: "r2",
        kind: "export_declaration",
        number: editShippingField(field, "DEC-002"),
      },
    ];
    const c = {
      documents: docs,
      relationships: [
        {
          id: "link1",
          documentIds: ["doc0", "doc1", "doc2"],
          containerIds: ["c1"],
          referenceIds: ["r1", "r2"],
          itemIds: [],
          status: "proposed",
          scope: "combined_packages",
          reason: "Synthetic proposed scope, not evidence confirmation",
        },
      ],
    };
    expect(shippingCaseSchema.safeParse(c).success).toBe(true);
    c.relationships[0].documentIds.push("absent");
    expect(shippingCaseSchema.safeParse(c).success).toBe(false);
  });
  it("rejects links to a container outside the chosen document group", () => {
    const documents = shippingTypes.map((type, i) =>
      createShippingDocument({ ...pdf, id: "d" + i }, type),
    );
    const f = emptyShippingField();
    documents[2].containers = [
      {
        id: "outside-container",
        containerNumber: f,
        sealNumber: f,
        packageCount: f,
        packageUnit: f,
        grossWeight: f,
        weightUnit: f,
      },
    ];
    expect(
      shippingCaseSchema.safeParse({
        documents,
        relationships: [
          {
            id: "link",
            documentIds: ["d0", "d1"],
            itemIds: [],
            referenceIds: [],
            containerIds: ["outside-container"],
            status: "proposed",
            scope: "unknown",
            reason: "Synthetic invalid scope",
          },
        ],
      }).success,
    ).toBe(false);
  });
  it("preserves container identifiers as strings and packaging/weight as numeric fields", () => {
    const d = createShippingDocument(pdf, "house_bl"),
      f = emptyShippingField();
    d.containers = [
      {
        id: "c",
        containerNumber: editShippingField(f, 123),
        sealNumber: f,
        packageCount: f,
        packageUnit: f,
        grossWeight: f,
        weightUnit: f,
      },
    ];
    expect(shippingDocumentSchema.safeParse(d).success).toBe(false);
    d.containers[0].containerNumber = editShippingField(f, "ABCD1234567");
    expect(shippingDocumentSchema.safeParse(d).success).toBe(true);
    d.containers[0].packageCount = editShippingField(f, "20");
    expect(shippingDocumentSchema.safeParse(d).success).toBe(false);
  });
  it("rejects legacy document fields rather than interpreting them as shipping results", () => {
    const d = createShippingDocument(pdf, "house_bl");
    expect(
      shippingDocumentSchema.safeParse({
        ...d,
        fields: { ...d.fields, seller: emptyShippingField() },
      }).success,
    ).toBe(false);
  });
  it("parses multiple declarations without requiring BL-to-declaration 1:1", () => {
    expect(
      parseShippingSlots(
        '["house_bl","export_declaration","export_declaration"]',
        3,
      ),
    ).toHaveLength(3);
    expect(parseShippingSlots('["house_bl","house_bl"]', 2)).toHaveLength(2);
    expect(parseShippingSlots('["house_bl"]', 1)).toHaveLength(1);
  });
  it.each([null, "invalid", "[]", '["house_bl","other"]'])(
    "rejects absent or malformed slots %s",
    (raw) => {
      expect(() => parseShippingSlots(raw, 2)).toThrow();
    },
  );
  it("prepares actual generated PDF pages/blocks with key present without any HTTP/provider call", async () => {
    vi.stubEnv("OPENAI_API_KEY", "synthetic-key-not-real");
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("No external calls permitted"));
    const response = await send(await form());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const data = await response.json();
    expect(data.mode).toBe("pdf-preparation");
    expect(data.aiCalled).toBe(false);
    expect(data.review).toEqual({ status: "not_performed", checks: [] });
    expect(data.capabilities.aiExtraction).toBe(false);
    expect(data.capabilities.triangularComparison).toBe(false);
    expect(data.results).toHaveLength(2);
    expect(data.results[0].pdf.pages).toHaveLength(2);
    expect(data.results[0].pdf.pages[0].blocks.length).toBeGreaterThan(0);
    expect(data.results[0].pdf.pages[0].text).toContain("20 CTNS");
    expect(
      data.results[0].document.fields.packageCount.current.value,
    ).toBeNull();
    expect(data.results[0].typeMismatch).toBeNull();
    expect(data.results[0].detectedType).toBeNull();
    expect(data.summary.comparisonReadiness).toBe("ready_for_pair");
    expect(data.summary.comparisonStatus).toBe("not_performed");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("distinguishes three-document readiness from performed triangular comparison", async () => {
    const r = await send(await form([...shippingTypes]));
    const data = await r.json();
    expect(r.status).toBe(200);
    expect(data.summary.comparisonReadiness).toBe("ready_for_triangle");
    expect(data.summary.comparisonStatus).toBe("not_performed");
  });
  it("keeps a successful PDF when another is unreadable and does not claim pair readiness", async () => {
    const r = await send(await form(undefined, true));
    const data = await r.json();
    expect(r.status).toBe(200);
    expect(data.results[0].error.code).toBe("INVALID_PDF");
    expect(data.results[0].document).toBeNull();
    expect(data.summary.successfulDocuments).toBe(1);
    expect(data.summary.comparisonReadiness).toBe("insufficient_documents");
  });
  it("never classifies from misleading filenames", async () => {
    const bytes = await makePdf([["HOUSE B/L", "Shipment test"]]);
    const r = await prepareShippingFile(
      new File([new Uint8Array(bytes)], "invoice.pdf", {
        type: "application/pdf",
      }),
      "export_declaration",
    );
    expect(r.document?.uploadType).toBe("export_declaration");
    expect(r.detectedType).toBeNull();
    expect(r.typeMismatch).toBeNull();
  });
  it("fails safely for a cancelled request", async () => {
    const r = await prepareShippingFile(
      new File(["%PDF-test"], "synthetic.pdf", { type: "application/pdf" }),
      "house_bl",
      AbortSignal.abort(),
    );
    expect(r.document).toBeNull();
    expect(r.error).not.toBeNull();
  });
  it("blocks old public Invoice/PL requests even when an API key is present", async () => {
    vi.stubEnv("OPENAI_API_KEY", "synthetic-key-not-real");
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("must not call"));
    const r = await send(await form(["invoice", "packing_list"]));
    expect(r.status).toBe(409);
    expect((await r.json()).error.code).toBe("LEGACY_ANALYSIS_DISABLED");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("requires slot metadata on the new public contract", async () => {
    const f = await form();
    f.delete("slots");
    expect((await send(f)).status).toBe(400);
  });
  it("preserves foreign-origin protection before parsing uploads", async () => {
    const r = await send(await form(), "https://other");
    expect(r.status).toBe(403);
    expect((await r.json()).error.code).toBe("CROSS_ORIGIN_DENIED");
  });
  it("PHASE3.3 accepts same-type and single-file batches without claiming comparison", async () => {
    expect((await send(await form(["house_bl"]))).status).toBe(200);
    expect((await send(await form(["house_bl", "house_bl"]))).status).toBe(200);
  });
  it("preserves count and filename/type safety", async () => {
    expect(
      (
        await send(
          await form([
            "house_bl",
            "house_manifest",
            "house_bl",
            "house_manifest",
            "house_bl",
          ]),
        )
      ).status,
    ).toBe(400);
    const f = await form();
    f.set("files", new File(["png"], "synthetic.png", { type: "image/png" }));
    const r = await send(f);
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe("INVALID_FORMAT");
  });
  it("reports readiness without comparing quantities or inventing a zero-error count", () => {
    const s = summarizeShipping([]);
    expect(s.comparisonStatus).toBe("not_performed");
    expect(s.comparisonReadiness).toBe("insufficient_documents");
    expect(s).not.toHaveProperty("confirmedMatches");
    expect(s).not.toHaveProperty("confirmedMismatches");
  });
});
