import { describe, it, expect, vi } from "vitest";
import {
  shippingBatches,
  mergeShippingResults,
  failedShippingUpload,
} from "../../src/modules/shipping/batches";
import {
  parseShippingIds,
  parseShippingSlots,
} from "../../src/modules/shipping/uploads";
import { evaluation33, fixture33, truth33 } from "../fixtures/shipping33";
import { shippingValues } from "../../src/modules/shipping/fields";
import { reviewShipping } from "../../src/modules/shipping/review";
import { verifyShippingField } from "../../src/modules/shipping/verify";
import { shippingFieldSchema } from "../../src/modules/shipping/schema";
import { extractPdfText } from "../../src/modules/pdf/extract";
import { reserve33 } from "../../scripts/lib/phase33-live";
import { collectionCoverage32 } from "../../src/modules/shipping/coverage";
import { ocrCandidates, ocrPdfPages } from "../../src/modules/pdf/ocr";
import { PDFDocument } from "pdf-lib";
import { analyzeShippingFile } from "../../src/modules/shipping/analysis";
import { emptyShippingWire } from "../../src/modules/shipping/ground";
const file = (name = "same.pdf", size = 100) =>
  new File([new Uint8Array(size)], name, { type: "application/pdf" });
const upload = (id: string, size = 100) => ({
  id,
  file: file("same.pdf", size),
  slot: "house_bl" as const,
});
describe("PHASE3.3 batched workspace and independent grounding", () => {
  it("accepts same-type and single-document mappings but rejects malformed mapping", () => {
    expect(parseShippingSlots('["house_bl","house_bl"]', 2)).toHaveLength(2);
    expect(parseShippingSlots('["house_bl"]', 1)).toHaveLength(1);
    expect(() => parseShippingSlots('["house_bl"]', 2)).toThrow();
  });
  it("requires unique explicit IDs even when names are duplicated", () => {
    expect(parseShippingIds('["a","b"]', 2)).toEqual(["a", "b"]);
    expect(() => parseShippingIds('["a","a"]', 2)).toThrow();
  });
  it("splits six PDFs into three safe sequential batches", () => {
    expect(
      shippingBatches(
        Array.from({ length: 6 }, (_, i) => upload("id" + i)),
      ).map((b) => b.length),
    ).toEqual([2, 2, 2]);
  });
  it("splits by bytes, never bypasses 4MB request or single-file bounds", () => {
    expect(
      shippingBatches([
        upload("a", 3 * 1024 * 1024),
        upload("b", 2 * 1024 * 1024),
      ]),
    ).toHaveLength(2);
    expect(() => shippingBatches([upload("a", 4 * 1024 * 1024 + 1)])).toThrow();
  });
  it("enforces workspace memory/count bounds independently of per-request bounds", () => {
    expect(() =>
      shippingBatches(Array.from({ length: 25 }, (_, i) => upload(String(i)))),
    ).toThrow();
    expect(() =>
      shippingBatches(
        Array.from({ length: 17 }, (_, i) =>
          upload(String(i), 4 * 1024 * 1024),
        ),
      ),
    ).toThrow();
  });
  it("merges duplicate filenames by ID and preserves a prior success after failure", () => {
    const a = failedShippingUpload(upload("a"), "FAIL", "safe"),
      b = failedShippingUpload(upload("b"), "FAIL", "safe");
    const good = { ...a, error: null };
    expect(mergeShippingResults([good, b], [a])).toEqual([good, b]);
  });
  for (const t of [
    ...evaluation33("normal"),
    truth33("export_declaration", "new-bilingual", "bilingual"),
  ])
    it(`independent native ${t.layout} layout has literal numeric/header-unit grounding`, async () => {
      const f = await fixture33(t),
        present = shippingValues(f.document).filter(
          (v) => v.original.value !== null,
        );
      expect(present.every((v) => v.original.status === "verified")).toBe(true);
      expect(f.document.collectionCoverage?.items.complete).toBe(true);
    });
  it("normal new layouts connect three pairs and a triangle without false mismatch", async () => {
    const fs = await Promise.all(evaluation33("normal").map(fixture33));
    const r = reviewShipping(fs.map((f) => f.document));
    expect(r.summary?.confirmedRelationships).toBe(3);
    expect(r.triangleStatus).toBe("performed");
    expect(r.summary?.confirmedMismatches).toBe(0);
  });
  it("wrapped description binds its numeric owner row and never a second item", async () => {
    const f = await fixture33(truth33("house_bl", "wrapped", "wrapped"));
    expect(f.document.items[0].fields.goodsDescription.original.status).toBe(
      "verified",
    );
    const candidate = structuredClone(f.wire.items[0].fields.quantity);
    candidate.evidence = f.wire.items[1].fields.quantity.evidence;
    const owner =
      f.document.items[0].fields.goodsDescription.original.source?.layout;
    expect(
      verifyShippingField(candidate, f.pdf, "quantity", "item", owner).original
        .status,
    ).toBe("unverified");
  });
  it("repeated headers on later pages retain page-specific unit evidence", async () => {
    const f = await fixture33(
      truth33("export_declaration", "continued", "multipage"),
    );
    expect(f.document.items[1].fields.quantityUnit.original.status).toBe(
      "verified",
    );
    expect(f.document.items[1].fields.quantityUnit.original.source?.page).toBe(
      f.document.items[1].fields.quantity.original.source?.page,
    );
  });
  it("six documents connect only the eight ground-truth shipment pairs", async () => {
    const fs = await Promise.all(evaluation33("complex").map(fixture33)),
      r = reviewShipping(fs.map((f) => f.document));
    expect(r.summary?.confirmedRelationships).toBe(8);
    expect(
      r
        .relationships!.filter((x) => x.status === "evidence_confirmed")
        .every(
          (x) =>
            !x.documentIds.includes("complex-bl-b") ||
            !x.documentIds.some(
              (id) =>
                id === "complex-declaration-0" ||
                id === "complex-declaration-1",
            ),
        ),
    ).toBe(true);
  });
  it("explicit complete declarations aggregate distinct item quantities without shared packaging sums", async () => {
    const fs = await Promise.all(evaluation33("complex").map(fixture33)),
      r = reviewShipping(fs.map((f) => f.document));
    expect(
      r.checks
        .filter((c) => c.title === "복수 신고 물품 수량 합계")
        .some((c) => c.assessment === "confirmed_match"),
    ).toBe(true);
    expect(
      r.checks.filter((c) => c.title === "복수 신고 대응 품목 수량"),
    ).toHaveLength(2);
    expect(
      r.checks.some(
        (c) =>
          c.title?.includes("복수 신고") &&
          c.category === "packaging" &&
          c.computedValues,
      ),
    ).toBe(false);
  });
  it("duplicate declaration numbers block aggregation", async () => {
    const ts = evaluation33("complex");
    ts[3].roots.declarationNumber = ts[2].roots.declarationNumber;
    ts[3].declarations = ts[2].declarations;
    const fs = await Promise.all(ts.map(fixture33)),
      r = reviewShipping(fs.map((f) => f.document));
    expect(
      r.checks.find((c) => c.title === "복수 신고 물품 수량 합계")?.assessment,
    ).toBe("needs_review");
  });
  it("duplicate goods across declarations and missing reference lists never sum", async () => {
    const ts = evaluation33("complex");
    ts[3].items = ts[2].items;
    ts[0].declarations = [];
    const fs = await Promise.all(ts.map(fixture33)),
      r = reviewShipping(fs.map((f) => f.document));
    expect(
      r.checks.find((c) => c.title === "복수 신고 물품 수량 합계")
        ?.computedValues,
    ).toBeUndefined();
  });
  it("partial shipment and user edits cannot confirm group totals", async () => {
    const fs = await Promise.all(evaluation33("complex").map(fixture33));
    const f = fs[2].document.items[0].fields.quantity;
    f.current = { ...f.current, value: 610, status: "user_edited" };
    expect(
      reviewShipping(fs.map((f) => f.document)).checks.find(
        (c) => c.title === "복수 신고 물품 수량 합계",
      )?.assessment,
    ).toBe("needs_review");
  });
  it("uncertain native documents retain provisional results without false confirmed errors", async () => {
    const fs = await Promise.all(evaluation33("uncertain").map(fixture33)),
      r = reviewShipping(fs.map((f) => f.document));
    expect(r.summary?.confirmedRelationships).toBe(0);
    expect(r.summary?.confirmedMismatches).toBe(0);
    expect(r.summary?.provisional).toBeGreaterThan(0);
  });
  it("an entirely blank PDF stays free and is detected as an OCR candidate", async () => {
    const p = await PDFDocument.create();
    p.addPage();
    const pages = await extractPdfText(await p.save(), undefined, true);
    expect(
      ocrCandidates({ id: "blank", fileName: "blank.pdf", pages }),
    ).toEqual([1]);
  });
  it("OCR without exact subset page correspondence rejects the response", async () => {
    const p = await PDFDocument.create();
    p.addPage();
    const bytes = await p.save(),
      pdf = {
        id: "ocr",
        fileName: "ocr.pdf",
        pages: await extractPdfText(bytes, undefined, true),
      };
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "completed",
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    pages: [{ page: 2, lines: ["HOUSE BILL OF LADING"] }],
                  }),
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );
    await expect(
      ocrPdfPages(bytes, pdf, { apiKey: "synthetic-only", fetcher }),
    ).rejects.toMatchObject({ code: "OCR_INVALID_PAGES" });
  });
  it("OCR candidate text never obtains native verified provenance", async () => {
    const f = await fixture33(truth33("house_bl", "ocr-ground"));
    f.pdf.pages[0].textSource = "ocr";
    const v = verifyShippingField(
      f.wire.fields.packageCount,
      f.pdf,
      "packageCount",
    );
    expect(v.original.status).toBe("unverified");
    expect(v.original.verificationCode).toBe("ocr_unverified");
    expect(v.original.source?.blocks).toBeUndefined();
    expect(
      shippingFieldSchema.safeParse({
        original: { ...v.original, status: "verified" },
        current: { ...v.original, status: "verified" },
      }).success,
    ).toBe(false);
  });
  it("unreadable OCR fails without an unnecessary second provider extraction", async () => {
    const p = await PDFDocument.create();
    p.addPage();
    const bytes = await p.save(),
      ai = vi.fn().mockResolvedValue(emptyShippingWire("house_bl"));
    const r = await analyzeShippingFile(
      new File([new Uint8Array(bytes)], "blank.pdf"),
      "house_bl",
      { allowOCR: true, ai, ocr: async (_b, pdf) => pdf },
    );
    expect(r.error?.code).toBe("NO_READABLE_TEXT");
    expect(ai).not.toHaveBeenCalled();
  });
  it("summary rows are excluded from native item coverage", async () => {
    const f = await fixture33(truth33("house_bl", "total-boundary"));
    const p = f.pdf.pages[0],
      b = p.blocks!.find((b) => b.text === f.truth.items[1].name)!;
    p.blocks!.push({
      ...b,
      id: "synthetic-total",
      text: "TOTAL",
      row: b.row + 1,
      y: b.y + 15,
    });
    expect(collectionCoverage32(f.document, f.pdf).items.rowCount).toBe(2);
  });
  it("OCR preserves native pages while marking only selected pages as unverified recognition", async () => {
    const p = await PDFDocument.create();
    p.addPage();
    p.addPage();
    const bytes = await p.save(),
      pdf = {
        id: "mixed",
        fileName: "mixed.pdf",
        pages: [
          {
            page: 1,
            text: "Native searchable page retains its original text",
            blocks: [],
          },
          { page: 2, text: "", blocks: [], ocrStatus: "candidate" as const },
        ],
      };
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "completed",
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    pages: [
                      {
                        page: 1,
                        lines: ["HOUSE BILL OF LADING", "Packages: 20 CTNS"],
                      },
                    ],
                  }),
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const r = await ocrPdfPages(bytes, pdf, {
      apiKey: "synthetic-only",
      fetcher,
    });
    expect(r.pages[0]).toEqual(pdf.pages[0]);
    expect(r.pages[1].textSource).toBe("ocr");
    expect(r.pages[1].page).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.store).toBe(false);
    expect(body.input[1].content[0].type).toBe("input_file");
  });
  it("excess OCR pages fail before any supplier request", async () => {
    const p = await PDFDocument.create();
    for (let i = 0; i < 4; i++) p.addPage();
    const bytes = await p.save(),
      pdf = {
        id: "large-scan",
        fileName: "scan.pdf",
        pages: await extractPdfText(bytes, undefined, true),
      },
      fetcher = vi.fn();
    await expect(
      ocrPdfPages(bytes, pdf, { apiKey: "synthetic-only", fetcher }),
    ).rejects.toMatchObject({ code: "OCR_PAGE_LIMIT" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("new budget separately stops cost, supplier-request and document bounds without restoring unknown usage", () => {
    const fresh = () => ({
      documents: 0,
      requests: 0,
      measuredCostUsd: 0,
      unresolvedCostUpperUsd: 0,
      maxDocuments: 24,
      maxRequests: 30,
      maxCostUsd: 0.1,
    });
    const b = fresh();
    reserve33(b, [0.06], 2);
    expect(() => reserve33(b, [0.05], 1)).toThrow();
    expect(b.documents).toBe(1);
    const c = fresh();
    c.requests = 30;
    expect(() => reserve33(c, [0.001], 1)).toThrow();
    const d = fresh();
    d.documents = 24;
    expect(() => reserve33(d, [0.001], 1)).toThrow();
  });
  it("duplicate HBL originals protect explicit declaration group totals", async () => {
    const fs = await Promise.all(evaluation33("complex").map(fixture33));
    const duplicate = structuredClone(fs[0].document);
    duplicate.id = "duplicate-HBL";
    for (const f of shippingValues(duplicate))
      for (const v of [f.original, f.current])
        if (v.source) v.source.fileId = duplicate.id;
    const checks = reviewShipping([
      ...fs.map((f) => f.document),
      duplicate,
    ]).checks.filter((c) => c.title === "복수 신고 물품 수량 합계");
    expect(checks).toHaveLength(2);
    expect(
      checks.every((c) => c.assessment === "needs_review" && !c.computedValues),
    ).toBe(true);
  });
  it("shared containers across different HBL cargo groups never confirm an unstated packing allocation", async () => {
    const ts = evaluation33("complex");
    ts[5].cargo![1].container = ts[5].cargo![0].container;
    const fs = await Promise.all(ts.map(fixture33)),
      r = reviewShipping(fs.map((f) => f.document));
    const sums = r.checks.filter((c) => c.title?.startsWith("HBL별 화물행"));
    expect(sums.length).toBeGreaterThan(0);
    expect(sums.every((c) => !c.assessment.startsWith("confirmed_"))).toBe(
      true,
    );
  });
  it("complex normal ground truth has no accidental cross-shipment total defaults", async () => {
    const fs = await Promise.all(evaluation33("complex").map(fixture33)),
      r = reviewShipping(fs.map((f) => f.document));
    expect(r.summary?.confirmedMismatches).toBe(0);
    expect(r.summary?.confirmedRelationships).toBe(8);
  });
});
