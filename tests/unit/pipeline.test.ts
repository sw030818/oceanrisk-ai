import { describe, expect, it, vi } from "vitest";
import { analyzeFile } from "@/modules/analysis/pipeline";
import { AnalysisError } from "@/modules/documents/errors";
import { syntheticDocument, makePdf } from "../fixtures/synthetic";
describe("real PDF to grounded result pipeline", () => {
  it("extracts a real generated PDF then grounds mocked AI candidates", async () => {
    const { lines, data } = syntheticDocument();
    const file = new File(
      [new Uint8Array(await makePdf([lines]))],
      "invoice.pdf",
      { type: "application/pdf" },
    );
    const result = await analyzeFile(file, { ai: async () => data });
    expect(result.error).toBeNull();
    expect(result.document?.items[0].quantity.status).toBe("verified");
    expect(result.document?.partialShipment.status).toBe("verified");
  });
  it("retains PDF pages when AI is not configured", async () => {
    const file = new File(
      [
        new Uint8Array(
          await makePdf([["Commercial invoice", "Quantity: 100 PCS"]]),
        ),
      ],
      "invoice.pdf",
    );
    const result = await analyzeFile(file, {
      ai: async () => {
        throw new AnalysisError("API_NOT_CONFIGURED", "AI not configured");
      },
    });
    expect(result.pdf.pages).toHaveLength(1);
    expect(result.document).toBeNull();
    expect(result.error?.code).toBe("API_NOT_CONFIGURED");
  });
  it("does not call AI after PDF parsing failure", async () => {
    const ai = vi.fn();
    const result = await analyzeFile(new File(["bad PDF"], "broken.pdf"), {
      ai,
    });
    expect(ai).not.toHaveBeenCalled();
    expect(result.error?.code).toBe("INVALID_PDF");
  });
});
