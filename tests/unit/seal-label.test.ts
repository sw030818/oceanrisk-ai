import { it, expect } from "vitest";
import { text32 } from "../../src/modules/shipping/review-evidence";

// A seal value cited with its printed label ("SEAL: KS1192892") is the same
// seal as the bare value on another form; only an explicit "label:" is removed.
it("compares a labelled seal value by the seal number only", () => {
  expect(text32("SEAL: KS1192892")).toBe(text32("KS1192892"));
  expect(text32("Seal No.: KS1192892")).toBe(text32("/KS1192892"));
  expect(text32("봉인번호: KS1192892")).toBe(text32("KS1192892"));
  expect(text32("SEAL: KS1192892")).not.toBe(text32("KS1192893"));
  expect(text32("SEALED CARGO")).toBe("sealed cargo");
  expect(text32("SEAL:")).toBe("seal:");
});
