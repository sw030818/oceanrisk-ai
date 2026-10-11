import { describe, expect, it, vi } from "vitest";
import { selectAvailableFlash } from "@/modules/ai/models";
import { extractWithGemini } from "@/modules/ai/gemini";
import { syntheticDocument } from "../fixtures/synthetic";
const available = (name: string, methods = ["generateContent"]) => ({ name: `models/${name}`, supportedGenerationMethods: methods });
const good = syntheticDocument();
const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status });
describe("confirmed 404 model discovery with mocked Google (not live validation)", () => {
  it("selects only advertised text Flash models, with latest/stable preference", () => {
    expect(selectAvailableFlash([available("gemini-3-flash-preview"), available("gemini-3-flash"), available("gemini-4-pro"), available("gemini-3-flash-native-audio"), available("gemini-3-flash-image"), available("gemini-9-flash", ["embedContent"])], "gemini-2.5-flash")).toBe("gemini-3-flash");
  });
  it("permits a Flash alias only when Google actually lists it", () => {
    expect(selectAvailableFlash([available("gemini-flash-latest")],"gemini-2.5-flash")).toBe("gemini-flash-latest");
  });
  it("prefers a compatible stable family over a newer unstable or unrelated generation", () => {
    expect(selectAvailableFlash([available("gemini-3.8-flash"),available("gemini-2.5-flash-lite"),available("gemini-flash-latest")],"gemini-2.5-flash")).toBe("gemini-2.5-flash-lite");
    expect(selectAvailableFlash([available("gemini-3.8-flash-preview"),available("gemini-2.5-flash-lite")],"gemini-2.5-flash")).toBe("gemini-2.5-flash-lite");
  });
  it("prefers the closest stable upgrade over the latest generation and alias", () => {
    expect(selectAvailableFlash([available("gemini-3.8-flash"),available("gemini-3.1-flash-lite"),available("gemini-flash-latest")],"gemini-2.5-flash")).toBe("gemini-3.1-flash-lite");
  });
  it("excludes advertised TTS/audio/image variants even when generateContent is supported", () => {
    expect(selectAvailableFlash([available("gemini-2.5-flash-preview-tts"),available("gemini-3.1-flash-preview-image"),available("gemini-3.1-flash-preview-audio")],"gemini-2.5-flash")).toBeNull();
  });
  it.each([null, [], [{ name: "../../private" }], [available("gemini-2.5-flash")], [available("gemini-3-flash-live")]])("never guesses a model outside the supported list", (models) => {
    expect(selectAvailableFlash(models, "gemini-2.5-flash")).toBeNull();
  });
  it("does one authenticated discovery then one supported-model retry after 404", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({},404)).mockResolvedValueOnce(json({ models: [available("gemini-3-flash-preview")] })).mockResolvedValueOnce(json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(good.data) }] } }] }));
    const models: string[] = [];
    const result = await extractWithGemini(good.pdf, { apiKey: "synthetic-test-key", fetcher, onModelUsed: model => models.push(model) });
    expect(result).toEqual(good.data);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[1][0]).toBe("https://generativelanguage.googleapis.com/v1beta/models?pageSize=100");
    expect(fetcher.mock.calls[1][1].headers).toEqual({ "x-goog-api-key": "synthetic-test-key" });
    expect(models).toEqual(["gemini-2.5-flash","gemini-3-flash-preview"]);
    const body=JSON.parse(fetcher.mock.calls[2][1].body);
    expect(body.generationConfig.responseFormat.text.mimeType).toBe("APPLICATION_JSON");
    expect(body.generationConfig.responseFormat.text.schema.$defs).toBeDefined();
    expect(body.generationConfig.responseMimeType).toBeUndefined();
    expect(body.generationConfig.responseJsonSchema).toBeUndefined();
    expect(body.generationConfig.thinkingConfig).toBeUndefined();
  });
  it.each([400,401,403,429,500])("never discovers or retries provider status %s", async status => {
    const fetcher=vi.fn().mockResolvedValue(json({},status));
    await expect(extractWithGemini(good.pdf,{apiKey:"test",fetcher})).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("stops if a supported model also returns 404", async () => {
    const fetcher=vi.fn().mockResolvedValueOnce(json({},404)).mockResolvedValueOnce(json({models:[available("gemini-3-flash")]})).mockResolvedValueOnce(json({},404));
    await expect(extractWithGemini(good.pdf,{apiKey:"test",fetcher})).rejects.toMatchObject({code:"API_MODEL_NOT_FOUND"});
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("tries a second advertised candidate only after the first is also 404", async () => {
    const fetcher=vi.fn().mockResolvedValueOnce(json({},404)).mockResolvedValueOnce(json({models:[available("gemini-2.5-flash-lite"),available("gemini-flash-latest")]})).mockResolvedValueOnce(json({},404)).mockResolvedValueOnce(json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(good.data) }] } }] }));
    expect(await extractWithGemini(good.pdf,{apiKey:"test",fetcher})).toEqual(good.data);
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(fetcher.mock.calls[3][0]).toContain("gemini-flash-latest:generateContent");
  });
  it.each([400,429,503])("never proceeds to another candidate after fallback status %s", async status => {
    const fetcher=vi.fn().mockResolvedValueOnce(json({},404)).mockResolvedValueOnce(json({models:[available("gemini-2.5-flash-lite"),available("gemini-flash-latest")]})).mockResolvedValueOnce(json({},status));
    await expect(extractWithGemini(good.pdf,{apiKey:"test",fetcher})).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
