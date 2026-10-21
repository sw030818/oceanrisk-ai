import type { ShippingCheck, ShippingReview } from "./review-model";
import type { ShippingDocument } from "./schema";
import { evidenceCauses, semanticCauses } from "./issue-causes";
import { refKey32, verified32 } from "./review-evidence";
export interface ReviewIssue {
  id: string;
  cause:
    | "value_conflict"
    | "reference_conflict"
    | "evidence"
    | "missing"
    | "scope"
    | "classification";
  severity: "high" | "attention";
  assessment: ShippingCheck["assessment"];
  title: string;
  explanation: string;
  followUp: string;
  documentIds: string[];
  relatedCheckIds: string[];
  fields: ShippingCheck["fields"];
  rootCauseIds?: string[];
  affectedFieldNames?: string[];
}
const rank = (s: ShippingCheck["assessment"]) =>
  s === "confirmed_mismatch" ? 0 : s === "provisional_mismatch" ? 1 : 2;
// Group by the same cause AND shipment AND affected entity. Different item rows,
// documents with absent references and unrelated faults never share a key.
export function reviewIssues(
  review: ShippingReview,
  documents: ShippingDocument[] = [],
): ReviewIssue[] {
  const issues = new Map<string, ReviewIssue>();
  for (const c of review.primaryChecks ?? review.checks) {
    if (c.disposition === "informational" || c.assessment === "confirmed_match" || c.assessment === "not_applicable")
      continue;
    const causal = evidenceCauses(c, documents);
    if(!causal.length&&c.rootCauseIds?.length&&(c.assessment!=="confirmed_mismatch"||c.rootCauseKind==='value_conflict'||c.rootCauseKind==='reference_conflict'))causal.push(...c.rootCauseIds.map(key=>({key,kind:c.rootCauseKind??'scope',fields:c.fields})));
    if (!causal.length) causal.push(...semanticCauses(c, documents));
    if (causal.length) {
      for (const root of causal) {
        const key = "root:" + root.key;
        const ids = [
          ...new Set([c.id, ...(c.comparison?.relatedCheckIds ?? [])]),
        ];
        const previous = issues.get(key);
        if (previous) {
          previous.relatedCheckIds = [
            ...new Set([...previous.relatedCheckIds, ...ids]),
          ];
          previous.documentIds = [
            ...new Set([...previous.documentIds, ...(c.documentIds ?? [])]),
          ];
          previous.affectedFieldNames = [
            ...new Set([
              ...(previous.affectedFieldNames ?? []),
              ...c.fields.map((f) => f.fieldName),
            ]),
          ];
          for (const f of c.fields)
            if (!previous.fields.some((v) => refKey32(v) === refKey32(f)))
              previous.fields.push(f);
          if (rank(c.assessment) < rank(previous.assessment))
            {previous.assessment = c.assessment;previous.severity=c.assessment==='confirmed_mismatch'?'high':'attention';previous.title=c.title??previous.title;previous.explanation=c.explanation;previous.followUp=c.followUp;}
          if(c.id===root.key){previous.title=c.title??previous.title;previous.explanation=c.explanation;previous.followUp=c.followUp;}
        } else
          issues.set(key, {
            id: key,
            rootCauseIds: [root.key],
            cause: root.kind,
            severity: c.assessment==='confirmed_mismatch'?'high':"attention",
            assessment: c.assessment,
            title:
              root.kind==='value_conflict'||root.kind==='reference_conflict'?c.title??'원문 기재 차이 확인':root.kind === "classification"
                ? "문서 유형의 원문 근거 확인 필요"
                : root.kind === "scope"
                  ? "품명·규격의 의미 대응 확인 필요"
                  : "필드 원문 근거 확인 필요",
            explanation:
              root.kind==='value_conflict'||root.kind==='reference_conflict'?c.explanation:root.kind === "classification"
                ? "문서 유형을 입증하지 못해 관련 비교는 잠정입니다. 독립적으로 확인된 필드와 원본 검사는 보존합니다."
                : root.kind === "scope"
                  ? "같은 품목군이지만 한영 표현 또는 추가 규격의 대응이 충분하지 않습니다. 같은 원문 HS 번호의 품목 소속 보류도 이 원인에 연결하며, 실제 번호 충돌은 별도 문제로 유지합니다."
                  : root.fields
                      .map((f) => f.field.current.reason)
                      .filter(Boolean)
                      .join(" "),
            followUp:
              root.kind==='value_conflict'||root.kind==='reference_conflict'?c.followUp:root.kind === "classification"
                ? "표제와 House 발행 문맥을 원문에서 확인해 주세요."
                : root.kind === "scope"
                  ? "작성자에게 품명·규격의 대응과 해당 HS의 품목 소속을 확인해 주세요."
                  : "해당 필드의 라벨·값·행 소속을 원문에서 확인해 주세요. 수정값은 원문 검증과 구분합니다.",
            documentIds: [
              ...new Set([
                ...(c.documentIds ?? []),
                ...root.fields.map((f) => f.documentId),
              ]),
            ],
            relatedCheckIds: ids,
            fields: [...c.fields],
            affectedFieldNames: [...new Set(c.fields.map((f) => f.fieldName))],
          });
      }
      continue;
    }
    const codes = c.comparison?.reasonCodes ?? [];
    const blockingRelations = (review.relationships ?? []).filter(
      (r) =>
        c.relationshipIds.includes(r.id) &&
        (r.status === "conflict" ||
          r.conflictRoles.length > 0 ||
          !!r.mappingWarnings?.length),
    );
    const referenceOrigin =
      c.category === "reference" &&
      blockingRelations.some((r) =>
        c.fields.some(
          (f) =>
            r.conflictRoles.includes(f.fieldName) ||
            r.mappingWarnings?.some((w) => w.role === f.fieldName),
        ),
      );
    const relationshipOnly =
      (c.assessment === "provisional_match" || referenceOrigin) &&
      blockingRelations.length > 0 &&
      c.fields.length > 0 &&
      c.fields.every(verified32);
    const cause: ReviewIssue["cause"] = relationshipOnly
      ? blockingRelations.some(
          (r) => r.status === "conflict" || r.conflictRoles.length > 0,
        )
        ? "reference_conflict"
        : "scope"
      : c.assessment === "confirmed_mismatch"
        ? c.category === "reference"
          ? "reference_conflict"
          : "value_conflict"
        : codes.includes("EVIDENCE_UNVERIFIED") || codes.includes("USER_EDITED")
          ? "evidence"
          : c.assessment === "insufficient_information"
            ? "missing"
            : "scope";
    const bad = c.fields.filter((f) => !verified32(f));
    const fields = cause === "evidence" && bad.length ? bad : c.fields;
    const entities = [...new Set(fields.map((f) => refKey32(f)))].sort();
    const shipment =
      c.comparison?.hbl ??
      [...new Set(c.fields.map((f) => f.documentId))].sort().join("+");
    // Exact cause signature is intentionally conservative. No category-only or
    // fuzzy-title deduplication that could hide a separate business problem.
    const allocation = c.scopeResolution?.kind === "allocation";
    const key = allocation
      ? JSON.stringify([
          "declaration_allocation",
          c.scopeResolution!.groupCheckId,
        ])
      : relationshipOnly
        ? JSON.stringify([
            "reference_dependency",
            blockingRelations.map((r) => r.id).sort(),
          ])
        : JSON.stringify([
            cause,
            shipment,
            c.comparison?.meaning ?? c.category,
            entities.length ? entities : [c.id],
          ]);
    const previous = issues.get(key);
    if (previous) {
      previous.relatedCheckIds = [
        ...new Set([
          ...previous.relatedCheckIds,
          c.id,
          ...(c.comparison?.relatedCheckIds ?? []),
        ]),
      ];
      if (rank(c.assessment) < rank(previous.assessment)) {
        previous.assessment = c.assessment;
        previous.severity =
          c.assessment === "confirmed_mismatch" ? "high" : "attention";
      }
      previous.documentIds = [
        ...new Set([
          ...previous.documentIds,
          ...(c.documentIds ?? []),
          ...c.fields.map((f) => f.documentId),
        ]),
      ];
      for (const f of c.fields)
        if (!previous.fields.some((v) => refKey32(v) === refKey32(f)))
          previous.fields.push(f);
    } else
      issues.set(key, {
        id: "issue:" + key,
        cause,
        severity: c.assessment === "confirmed_mismatch" ? "high" : "attention",
        assessment: c.assessment,
        title: allocation
          ? "복수 신고 포장·중량 배분 확인"
          : relationshipOnly
            ? "서류 간 참조 연결 확인"
            : (c.title ?? c.category),
        explanation: allocation
          ? "전체 신고 목록과 품목 수량 대응은 별도 검사에서 검증했습니다. 포장 개수·중량은 개별 신고의 배분 또는 공동 기재 범위를 입증하지 못해 함께 확인합니다. 관련 검사와 원문은 모두 보존합니다."
          : relationshipOnly
            ? "동일한 참조 연결 또는 신고 포함 범위에 의존하는 검사를 함께 표시합니다. 서로 다른 수치·품목의 오류는 별도 문제로 유지합니다. 관련 검사의 실제 값과 연결 근거를 확인해 주세요."
            : c.explanation,
        followUp: c.followUp,
        documentIds: [
          ...new Set([
            ...(c.documentIds ?? []),
            ...c.fields.map((f) => f.documentId),
          ]),
        ],
        relatedCheckIds: [
          ...new Set([c.id, ...(c.comparison?.relatedCheckIds ?? [])]),
        ],
        fields: [...c.fields],
      });
  }
  return [...issues.values()].sort(
    (a, b) =>
      rank(a.assessment) - rank(b.assessment) || a.id.localeCompare(b.id),
  );
}
export function withReviewIssues(
  review: ShippingReview,
  documents: ShippingDocument[] = [],
): ShippingReview {
  return { ...review, issues: reviewIssues(review, documents) };
}
