import type { ReviewIssue } from "./issues";

// Screen wording only. Check titles stay unchanged in the engine and in
// stored evidence; this maps them to plain names for the result screen.
const exact: Record<string, string> = {
  "검증된 공통 HBL 참조": "House B/L 번호",
  "수출신고 참조": "수출신고번호",
  "선적 참조": "선적 참조번호",
  "컨테이너 목록": "컨테이너 번호",
  "화물 품명 의미": "품명",
  "기재 물품 수량 (합계/단일품목 범위)": "물품 수량",
  "문서 전체 총중량": "총중량 (서류 전체)",
  "문서 전체 순중량": "순중량 (서류 전체)",
  "문서 전체 포장 개수": "포장 개수 (서류 전체)",
  "Consignee / 수하인": "수하인 (Consignee)",
  "Shipper / 송하인": "송하인 (Shipper)",
  "선적항 / POL": "선적항 (POL)",
  "양하항 / POD": "양하항 (POD)",
  "HS 공통 6단위 (전체 세번과 구분)": "HS 코드 (앞 6자리)",
};

export function displayTitle(title: string): string {
  if (exact[title]) return exact[title];
  return title.replace("HS 공통 6단위 (전체 세번과 구분)", "HS 코드 (앞 6자리)");
}

export function issueSummary(issues: ReviewIssue[], limit = 3): string {
  const titles = [...new Set(issues.map((i) => displayTitle(i.title)))];
  const shown = titles.slice(0, limit).join(", ");
  return titles.length > limit
    ? `${shown} 외 ${titles.length - limit}건`
    : shown;
}
