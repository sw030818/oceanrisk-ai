import { describe, expect, it } from "vitest";
import { displayTitle, issueSummary } from "@/modules/shipping/display-titles";
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
