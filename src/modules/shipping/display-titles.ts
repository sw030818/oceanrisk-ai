import type { ReviewIssue } from "./issues";
import { pairedReadings } from "./display-reading";

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

/**
 * What each document prints for a value/reference conflict, documents with the
 * same values grouped: "House B/L · House 적하목록: ROTTERDAM ↔ 수출신고필증: ANTWERP".
 * Only the field whose values actually differ is shown (an HS conflict does not
 * repeat the shared goods name). Presentation only; null when it is not a plain
 * value difference or would not fit on one line.
 */
export function issueValues(
  issue: ReviewIssue,
  documentLabel: (documentId: string) => string,
  labelOrder: string[] = [],
): string | null {
  if (!["value_conflict", "reference_conflict"].includes(issue.cause)) return null;
  const names = new Set(issue.affectedFieldNames ?? issue.fields.map((f) => f.fieldName));
  const readings = pairedReadings(issue.fields.filter((f) => names.has(f.fieldName))).filter(
    (r) => !r.field.fieldName.endsWith("Unit") && r.field.field.current.value !== null,
  );
  const perDocument = (fieldName: string) => {
    const byDoc = new Map<string, Set<string>>();
    for (const r of readings.filter((v) => v.field.fieldName === fieldName))
      byDoc.set(r.field.documentId, (byDoc.get(r.field.documentId) ?? new Set()).add(r.text.trim()));
    const groups = new Map<string, string[]>();
    for (const [doc, values] of byDoc) {
      const key = [...values].sort().join(", ");
      groups.set(key, [...(groups.get(key) ?? []), documentLabel(doc)]);
    }
    return groups;
  };
  const conflicting = [...new Set(readings.map((r) => r.field.fieldName))]
    .map((name) => perDocument(name))
    .filter((g) => g.size >= 2);
  if (conflicting.length !== 1 || conflicting[0].size > 3) return null;
  const rank = (label: string) => {
    const i = labelOrder.findIndex((l) => label.startsWith(l));
    return i < 0 ? labelOrder.length : i;
  };
  const text = [...conflicting[0]]
    .map(([values, docs]) => ({ values, docs: [...new Set(docs)].sort((a, b) => rank(a) - rank(b)) }))
    .sort((a, b) => rank(a.docs[0]) - rank(b.docs[0]))
    .map(({ values, docs }) => `${docs.join(" · ")}: ${values}`)
    .join(" ↔ ");
  return text.length <= 180 ? text : null;
}
