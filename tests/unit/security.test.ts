import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { requireSameOrigin } from "@/modules/security/origin";
import { POST } from "@/app/api/analyze/route";
import { GET } from "@/app/api/status/route";
const { analyze } = vi.hoisted(() => ({ analyze: vi.fn() }));
vi.mock("@/modules/analysis/pipeline", () => ({ analyzeFile: analyze }));
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("OPENAI_API_KEY", "");
  analyze.mockReset().mockResolvedValue({
    pdf: { id: "synthetic", fileName: "synthetic.pdf", pages: [{ page: 1, text: "synthetic test" }] },
    document: null,
    error: { code: "API_NOT_CONFIGURED", message: "OpenAI 키가 없습니다." },
  });
});
afterEach(() => vi.unstubAllEnvs());
function request(count = 1) {
  const body = new FormData();
  for (let i = 0; i < count; i++) body.append("files", new File(["%PDF-test-only"], `synthetic-${i}.pdf`, { type: "application/pdf" }));
  return new Request("https://test/api/analyze", { method: "POST", body });
}
describe("public analysis retains request safety without local auth or quotas", () => {
  it.each(["", "obsolete-server-value"])("production upload needs no authorization regardless of obsolete access setting (%s)", async (setting) => {
    vi.stubEnv("ANALYSIS_ACCESS_TOKEN", setting);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).results[0].error.code).toBe("API_NOT_CONFIGURED");
    expect(analyze).toHaveBeenCalledTimes(1);
  });
  it("does not reject bursts after ten requests", async () => {
    for (let i = 0; i < 30; i++) expect((await POST(request())).status).toBe(200);
    expect(analyze).toHaveBeenCalledTimes(30);
  });
  it("does not apply a local hourly AI document budget", async () => {
    vi.stubEnv("OPENAI_API_KEY", "synthetic-mock-key-not-real");
    for (let i = 0; i < 8; i++) expect((await POST(request(4))).status).toBe(200);
    expect(analyze).toHaveBeenCalledTimes(32);
  });
  it("does not block five concurrent analysis batches", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    analyze.mockImplementation(async () => { await gate; return { pdf: { id: "synthetic", fileName: "synthetic.pdf", pages: [] }, document: null, error: null }; });
    const responses = Array.from({ length: 5 }, () => POST(request()));
    try { await vi.waitFor(() => expect(analyze).toHaveBeenCalledTimes(5)); } finally { release(); }
    expect((await Promise.all(responses)).map((result) => result.status)).toEqual([200, 200, 200, 200, 200]);
  });
  it("keeps selected slots separate from the classified types, independent of filenames", async () => {
    analyze.mockResolvedValueOnce({ pdf: { id: "a", fileName: "invoice.pdf", pages: [] }, document: { type: "packing_list" }, error: null });
    const body = new FormData();body.append("files", new File(["%PDF-test"], "invoice.pdf", {type:"application/pdf"}));body.append("slots", '["invoice"]');
    const response=await POST(new Request("https://test/api/analyze",{method:"POST",body}));
    expect((await response.json()).results[0]).toMatchObject({ uploadSlot:"invoice",typeMismatch:true,document:{type:"packing_list"} });
  });
  it("rejects malformed slot metadata before starting AI", async () => {
    const body = new FormData();body.append("files", new File(["%PDF-test"], "invoice.pdf", {type:"application/pdf"}));body.append("slots", '["invoice","packing_list"]');
    const response=await POST(new Request("https://test/api/analyze",{method:"POST",body}));expect(response.status).toBe(400);expect(analyze).not.toHaveBeenCalled();
  });
  it("still validates multipart requests before PDF/AI work", async () => {
    const response = await POST(new Request("https://test/api/analyze", { method: "POST", body: "not multipart" }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_REQUEST");
    expect(analyze).not.toHaveBeenCalled();
  });
  it("still enforces upload count", async () => {
    const response = await POST(request(5));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("TOO_MANY_FILES");
    expect(analyze).not.toHaveBeenCalled();
  });
  it("still bounds the request body", async () => {
    const response = await POST(new Request("https://test/api/analyze", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=x", "content-length": "999999999" }, body: "x" }));
    expect(response.status).toBe(413);
    expect((await response.json()).error.code).toBe("TOTAL_TOO_LARGE");
    expect(analyze).not.toHaveBeenCalled();
  });
  it("rejects foreign origins before analysis", async () => {
    const upload = request();
    upload.headers.set("origin", "https://other");
    const response = await POST(upload);
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("CROSS_ORIGIN_DENIED");
    expect(analyze).not.toHaveBeenCalled();
  });
  it("returns only credential presence and safe deployment metadata", async () => {
    vi.stubEnv("OPENAI_API_KEY", "synthetic-secret-test-value");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "a".repeat(40));
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_synthetic123");
    const response = GET();
    const body = await response.json();
    expect(body).toEqual({ provider: "openai", model: "gpt-6-luna", aiConfigured: true, deployment: { commitSha: "a".repeat(40), id: "dpl_synthetic123", environment: "production" } });
    expect(JSON.stringify(body)).not.toContain("synthetic-secret-test-value");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("does not echo malformed deployment environment values", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "private-value");
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "private-value");
    expect((await GET().json()).deployment).toMatchObject({ commitSha: null, id: null });
  });
});
describe("retained browser origin validation", () => {
  it("accepts same origin and explicit API clients", () => {
    expect(() => requireSameOrigin(new Request("https://test/api", { headers: { origin: "https://test" } }))).not.toThrow();
    expect(() => requireSameOrigin(new Request("https://test/api"))).not.toThrow();
  });
  it("uses Host when Next normalizes request.url", () => {
    expect(() => requireSameOrigin(new Request("http://localhost:3000/api", { headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" } }))).not.toThrow();
  });
  it("supports an HTTPS deployment behind a proxy", () => {
    expect(() => requireSameOrigin(new Request("http://localhost:3000/api", { headers: { host: "ocean.example", "x-forwarded-proto": "https", origin: "https://ocean.example" } }))).not.toThrow();
  });
  it.each(["null", "invalid", "https://other.example"])("rejects unsafe origin %s", (origin) => {
    expect(() => requireSameOrigin(new Request("https://test/api", { headers: { origin } }))).toThrowError(expect.objectContaining({ code: "CROSS_ORIGIN_DENIED" }));
  });
  it("rejects cross-site browser requests without an Origin", () => {
    expect(() => requireSameOrigin(new Request("https://test/api", { headers: { "sec-fetch-site": "cross-site" } }))).toThrow();
  });
});
