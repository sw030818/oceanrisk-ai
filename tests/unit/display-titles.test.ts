import { describe, expect, it } from "vitest";
import { displayTitle, issueSummary, issueValues } from "@/modules/shipping/display-titles";
import type { ReviewIssue } from "@/modules/shipping/issues";

describe("result screen titles", () => {
  it("maps engine check titles to plain names without changing unknown ones", () => {
    expect(displayTitle("검증된 공통 HBL 참조")).toBe("House B/L 번호");
    expect(displayTitle("양하항 / POD")).toBe("양하항 (POD)");
    expect(displayTitle("품목 A HS 공통 6단위 (전체 세번과 구분)")).toBe(
      "품목 A HS 코드 (앞 6자리)",
    );
    expect(displayTitle("화물 품명 · AI 상품 의미 대응")).toBe(
      "화물 품명 · AI 상품 의미 대응",
    );
  });
  it("summarizes distinct issue titles with a remainder count", () => {
    const issue = (title: string) => ({ title }) as ReviewIssue;
    expect(issueSummary([issue("양하항 / POD")])).toBe("양하항 (POD)");
    expect(
      issueSummary(
        ["양하항 / POD", "Seal 번호", "컨테이너 목록", "문서 전체 총중량", "양하항 / POD"].map(issue),
      ),
    ).toBe("양하항 (POD), Seal 번호, 컨테이너 번호 외 1건");
  });
});

describe("conflict values on the result screen", () => {
  const field = (documentId: string, fieldName: string, value: string) =>
    ({
      documentId,
      fieldName,
      field: {
        original: { value, status: "verified", reason: "" },
        current: { value, status: "verified", reason: "" },
      },
    }) as unknown as ReviewIssue["fields"][number];
  const label = (id: string) => ({ bl: "House B/L", ed: "수출신고필증", mf: "House 적하목록" })[id] ?? id;
  const order = ["House B/L", "수출신고필증", "House 적하목록"];
  const issue = (cause: ReviewIssue["cause"], fields: ReviewIssue["fields"]) =>
    ({ cause, fields, title: "t", affectedFieldNames: [...new Set(fields.map((f) => f.fieldName))] }) as unknown as ReviewIssue;

  it("groups documents that print the same value, in document order", () => {
    const i = issue("value_conflict", [
      field("mf", "portOfDischarge", "ROTTERDAM"),
      field("ed", "portOfDischarge", "ANTWERP"),
      field("bl", "portOfDischarge", "ROTTERDAM"),
    ]);
    expect(issueValues(i, label, order)).toBe(
      "House B/L · House 적하목록: ROTTERDAM ↔ 수출신고필증: ANTWERP",
    );
  });
  it("shows only the field whose values differ, not a shared prerequisite", () => {
    const i = issue("value_conflict", [
      field("bl", "goodsDescription", "WOVEN APRON"),
      field("mf", "goodsDescription", "WOVEN APRON"),
      field("bl", "hsCode", "6211.42"),
      field("mf", "hsCode", "8501.10"),
    ]);
    expect(issueValues(i, label, order)).toBe("House B/L: 6211.42 ↔ House 적하목록: 8501.10");
  });
  it("lists every value a document prints for list fields", () => {
    const i = issue("value_conflict", [
      field("bl", "sealNumber", "S-1"),
      field("bl", "sealNumber", "S-2"),
      field("mf", "sealNumber", "S-2"),
      field("mf", "sealNumber", "S-9"),
    ]);
    expect(issueValues(i, label, order)).toBe("House B/L: S-1, S-2 ↔ House 적하목록: S-2, S-9");
  });
  it("stays silent for evidence or scope problems and for agreeing values", () => {
    const fields = [field("bl", "portOfDischarge", "A"), field("mf", "portOfDischarge", "B")];
    expect(issueValues(issue("evidence", fields), label, order)).toBeNull();
    expect(issueValues(issue("scope", fields), label, order)).toBeNull();
    expect(
      issueValues(issue("value_conflict", [field("bl", "portOfDischarge", "A"), field("mf", "portOfDischarge", "A")]), label, order),
    ).toBeNull();
  });
});
