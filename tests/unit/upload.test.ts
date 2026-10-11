import { describe, expect, it } from "vitest";
import { validateUploads } from "@/modules/upload/validate";
import { MAX_TOTAL_BYTES } from "@/modules/upload/limits";
describe("upload policy", () => {
  const valid = { name: "invoice.pdf", type: "application/pdf", size: 1000 };
  it("accepts multiple PDFs", () => {
    expect(() =>
      validateUploads([valid, { ...valid, name: "packing.PDF" }]),
    ).not.toThrow();
  });
  it.each([
    [[], "NO_FILES"],
    [[{ ...valid, name: "file.png" }], "INVALID_FORMAT"],
    [[{ ...valid, type: "text/plain" }], "INVALID_FORMAT"],
    [[{ ...valid, size: 0 }], "EMPTY_FILE"],
    [[{ ...valid, size: MAX_TOTAL_BYTES + 1 }], "FILE_TOO_LARGE"],
    [Array(5).fill(valid), "TOO_MANY_FILES"],
    [[{ ...valid, size: MAX_TOTAL_BYTES }, valid], "TOTAL_TOO_LARGE"],
  ])("rejects invalid upload set", (files, code) => {
    try {
      validateUploads(files as (typeof valid)[]);
      throw new Error("Expected rejection");
    } catch (error) {
      expect(error).toMatchObject({ code });
    }
  });
});
