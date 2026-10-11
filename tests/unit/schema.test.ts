import { describe, expect, it } from "vitest";
import { numberFieldSchema, evidenceSchema } from "@/modules/documents/schema";
describe("grounded data model", () => {
 it("accepts unknown values with no evidence", () => { expect(numberFieldSchema.parse({ value: null, evidence: null }).value).toBeNull(); });
 it("rejects invalid quantities and page references", () => {
  expect(numberFieldSchema.safeParse({ value: -1, evidence: null }).success).toBe(false);
  expect(evidenceSchema.safeParse({ page: 0, quote: "Quantity 10" }).success).toBe(false);
 });
});
