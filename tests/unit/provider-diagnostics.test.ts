import { describe, expect, it } from "vitest";
import { providerDiagnostics } from "@/modules/ai/provider-diagnostics";
import { AnalysisError, safeError } from "@/modules/documents/errors";
describe("whitelisted provider diagnostics do not echo confidential text", () => {
  it("reports request field names/status without raw message or details", () => {
    const result=providerDiagnostics({error:{status:"INVALID_ARGUMENT",message:"Unknown responseJsonSchema private-key-and-trade-data",details:[{metadata:{private:"secret"}}]}},400,"gemini-3-flash");
    expect(result).toMatchObject({httpStatus:400,status:"INVALID_ARGUMENT",model:"gemini-3-flash",requestFields:["responseJsonSchema"]});
    expect(JSON.stringify(result)).not.toMatch(/private|secret|trade-data/);
  });
  it("distinguishes a zero daily quota without exposing project IDs", () => {
    const result=providerDiagnostics({error:{status:"RESOURCE_EXHAUSTED",message:"GenerateContentRequestsPerDay quota limit: 0 project secret-id"}},429,"gemini-3-flash");
    expect(result).toMatchObject({quotaWindow:"day",quotaLimitZero:true});
    expect(JSON.stringify(result)).not.toContain("secret-id");
  });
  it("identifies a minute quota", () => expect(providerDiagnostics({error:{message:"PerMinute limit: 20"}},429,"gemini-3-flash").quotaWindow).toBe("minute"));
  it.each([null,{}, {error:{status:"secret-text",message:42}}])("handles malformed diagnostics %j", payload => {
    expect(providerDiagnostics(payload,503,"private-model-value")).toEqual({httpStatus:503,status:"UNKNOWN",requestFields:[],quotaWindow:"unknown",quotaLimitZero:false});
  });
  it("retains only the safe diagnostic object in pipeline errors", () => {
    const diagnostics=providerDiagnostics({error:{status:"UNAVAILABLE",message:"private"}},503,"gemini-3-flash");
    expect(safeError(new AnalysisError("API_ERROR","safe message",502,diagnostics))).toEqual({code:"API_ERROR",message:"safe message",diagnostics});
  });
});
