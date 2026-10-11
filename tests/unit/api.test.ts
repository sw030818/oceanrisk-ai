import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/analyze/route";
import { MAX_TOTAL_BYTES } from "@/modules/upload/limits";
describe("server upload boundary", () => {
  it("rejects wrong content type", async () => {
    const response = await POST(
      new Request("http://test/api/analyze", { method: "POST", body: "x" }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_REQUEST");
  });
  it("rejects an empty multipart request", async () => {
    const response = await POST(
      new Request("http://test/api/analyze", {
        method: "POST",
        body: new FormData(),
      }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("NO_FILES");
  });
  it("bounds an oversized body even without a content-length header", async () => {
    const response = await POST(
      new Request("http://test/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "multipart/form-data; boundary=test" },
        body: new Uint8Array(MAX_TOTAL_BYTES + 129 * 1024),
      }),
    );
    expect(response.status).toBe(413);
    expect((await response.json()).error.code).toBe("TOTAL_TOO_LARGE");
  });
  it("does not cache or analyze disguised files", async () => {
    const form = new FormData();
    form.append(
      "files",
      new File(["fake PDF"], "test.pdf", { type: "application/pdf" }),
    );
    const response = await POST(
      new Request("http://test/api/analyze", { method: "POST", body: form }),
    );
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    const data = await response.json();
    expect(data.results[0].error.code).toBe("INVALID_PDF");
    expect(data.results[0].document).toBeNull();
  });
});
