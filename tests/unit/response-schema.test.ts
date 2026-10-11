import { describe, expect, it } from "vitest";
import { geminiResponseSchema } from "@/modules/ai/response-schema";
import { extractWithGemini } from "@/modules/ai/gemini";
import { syntheticDocument } from "../fixtures/synthetic";
describe("documented transport subset with unchanged strict output validation", () => {
  it("retains field definitions/required/numeric bounds and avoids unsupported string constraints or references", () => {
    const schema = geminiResponseSchema() as { required: string[]; properties: { items: { maxItems: number; items: { required: string[] } } } };
    expect(schema.required).toContain("partialShipment");
    expect(schema.properties.items.maxItems).toBe(100);
    expect(schema.properties.items.items.required).toEqual(expect.arrayContaining(["quantity", "unit", "description"]));
    expect(JSON.stringify(schema)).not.toMatch(/\$(?:schema|ref|defs)|maxLength|minLength/);
    expect(JSON.stringify(schema)).toContain('"minimum":0');
  });
  it.each(["overlong party", "overlong quote", "invalid page", "too many items"])("still rejects %s in a 200 provider response", async problem => {
    const { pdf, data } = syntheticDocument();
    if (problem === "overlong party") data.seller.value = "S".repeat(301);
    if (problem === "overlong quote") data.items[0].quantity.evidence!.quote = "Q".repeat(801);
    if (problem === "invalid page") data.items[0].quantity.evidence!.page = 0;
    if (problem === "too many items") data.items = Array.from({ length: 101 }, () => structuredClone(data.items[0]));
    const fetcher = async () => new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(data) }] } }] }));
    await expect(extractWithGemini(pdf, { apiKey: "synthetic-test-key", fetcher })).rejects.toMatchObject({ code: "INVALID_AI_RESPONSE" });
  });
});
