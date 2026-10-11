import { describe, expect, it, vi, afterEach } from "vitest";
import { createAnalysisLimiter } from "@/modules/security/limiter";
import {
  requireAnalysisAccess,
  requireSameOrigin,
  accessSettings,
} from "@/modules/security/access";
import { POST } from "@/app/api/analyze/route";
afterEach(() => vi.unstubAllEnvs());
const testToken = "synthetic-only-access-token-1234567890";
describe("prototype access and cost safeguards", () => {
  it("fails closed when production has no access token", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ANALYSIS_ACCESS_TOKEN", "");
    expect(accessSettings()).toEqual({ required: true, configured: false });
    expect(() =>
      requireAnalysisAccess(new Request("https://test")),
    ).toThrowError(expect.objectContaining({ code: "ACCESS_NOT_CONFIGURED" }));
  });
  it("rejects missing, wrong and oversized bearer values", () => {
    for (const supplied of ["", "Bearer wrong", "Bearer " + "x".repeat(300)])
      expect(() =>
        requireAnalysisAccess(
          new Request("https://test", { headers: { authorization: supplied } }),
          { required: true, token: testToken },
        ),
      ).toThrowError(expect.objectContaining({ code: "ACCESS_DENIED" }));
  });
  it("accepts only the configured private token", () => {
    expect(() =>
      requireAnalysisAccess(
        new Request("https://test", {
          headers: { authorization: `Bearer ${testToken}` },
        }),
        { required: true, token: testToken },
      ),
    ).not.toThrow();
  });
  it("rejects a weak configured code", () => {
    expect(() =>
      requireAnalysisAccess(new Request("https://test"), {
        required: true,
        token: "short",
      }),
    ).toThrowError(expect.objectContaining({ code: "ACCESS_NOT_CONFIGURED" }));
  });
  it("rejects other-site requests, accepts same origin and explicit API clients", () => {
    expect(() =>
      requireSameOrigin(
        new Request("https://test/api", {
          headers: { origin: "https://other" },
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: "CROSS_ORIGIN_DENIED" }));
    expect(() =>
      requireSameOrigin(
        new Request("https://test/api", {
          headers: { origin: "https://test" },
        }),
      ),
    ).not.toThrow();
    expect(() =>
      requireSameOrigin(new Request("https://test/api")),
    ).not.toThrow();
  });
  it("limits request bursts and recovers after the window", () => {
    let now = 0;
    const limiter = createAnalysisLimiter(() => now);
    for (let i = 0; i < 10; i++) limiter.checkRequest();
    expect(() => limiter.checkRequest()).toThrowError(
      expect.objectContaining({ code: "REQUEST_RATE_LIMIT" }),
    );
    now = 60001;
    expect(() => limiter.checkRequest()).not.toThrow();
  });
  it("limits concurrency and releases exactly once", () => {
    const limiter = createAnalysisLimiter();
    const a = limiter.reserve(1, false),
      b = limiter.reserve(1, false);
    expect(() => limiter.reserve(1, false)).toThrowError(
      expect.objectContaining({ code: "ANALYSIS_BUSY" }),
    );
    a();
    a();
    const c = limiter.reserve(1, false);
    expect(() => limiter.reserve(1, false)).toThrow();
    b();
    c();
  });
  it("reserves the AI budget per document and does not refund failed provider calls", () => {
    let now = 0;
    const limiter = createAnalysisLimiter(() => now);
    for (let i = 0; i < 6; i++) limiter.reserve(4, true)();
    expect(() => limiter.reserve(1, true)).toThrowError(
      expect.objectContaining({ code: "AI_BUDGET_LIMIT" }),
    );
    expect(() => limiter.reserve(1, false)).not.toThrow();
    now = 3600001;
    expect(() => limiter.reserve(1, true)).not.toThrow();
  });
  it("denies unauthorized API requests before reading uploaded data", async () => {
    vi.stubEnv("ANALYSIS_ACCESS_TOKEN", testToken);
    const response = await POST(
      new Request("https://test/api/analyze", {
        method: "POST",
        body: "not multipart",
      }),
    );
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("ACCESS_DENIED");
  });
  it("allows authorized requests to reach ordinary upload validation", async () => {
    vi.stubEnv("ANALYSIS_ACCESS_TOKEN", testToken);
    const response = await POST(
      new Request("https://test/api/analyze", {
        method: "POST",
        headers: { authorization: `Bearer ${testToken}` },
        body: "not multipart",
      }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_REQUEST");
  });
  it("returns configuration failure for an unprotected production API", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ANALYSIS_ACCESS_TOKEN", "");
    const response = await POST(
      new Request("https://test/api/analyze", {
        method: "POST",
        body: "not multipart",
      }),
    );
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("ACCESS_NOT_CONFIGURED");
  });
  it("uses the received Host when Next normalizes the internal URL", () => {
    expect(() =>
      requireSameOrigin(
        new Request("http://localhost:3000/api", {
          headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
        }),
      ),
    ).not.toThrow();
  });
  it("supports the deployed HTTPS proxy protocol and still denies foreign origins", () => {
    expect(() =>
      requireSameOrigin(
        new Request("http://localhost:3000/api", {
          headers: {
            host: "ocean.example",
            "x-forwarded-proto": "https",
            origin: "https://ocean.example",
          },
        }),
      ),
    ).not.toThrow();
    expect(() =>
      requireSameOrigin(
        new Request("http://localhost:3000/api", {
          headers: {
            host: "ocean.example",
            "x-forwarded-proto": "https",
            origin: "https://other.example",
          },
        }),
      ),
    ).toThrow();
  });
  it("rejects null/malformed and cross-site origins", () => {
    for (const origin of ["null", "invalid"])
      expect(() =>
        requireSameOrigin(
          new Request("https://test/api", { headers: { origin } }),
        ),
      ).toThrowError(expect.objectContaining({ code: "CROSS_ORIGIN_DENIED" }));
    expect(() =>
      requireSameOrigin(
        new Request("https://test/api", {
          headers: { "sec-fetch-site": "cross-site" },
        }),
      ),
    ).toThrow();
  });
  it("rejects inaccessible overlong or whitespace-only configured codes", () => {
    for (const token of ["x".repeat(257), " ".repeat(32)]) {
      vi.stubEnv("ANALYSIS_ACCESS_TOKEN", token);
      expect(accessSettings().configured).toBe(false);
      expect(() =>
        requireAnalysisAccess(new Request("https://test")),
      ).toThrowError(
        expect.objectContaining({ code: "ACCESS_NOT_CONFIGURED" }),
      );
    }
  });
});
