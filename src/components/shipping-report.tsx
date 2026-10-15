"use client";
import type { ShippingResult } from "@/modules/shipping/prepare";
import type { ShippingReview } from "@/modules/shipping/review-model";
import { shippingLabels, shippingTypes } from "@/modules/shipping/catalog";
import {
  comparisonGroups,
  comparisonDisplayFields,
} from "@/modules/shipping/presentation";
import { pairedReadings } from "@/modules/shipping/display-reading";
import { assessmentLabels } from "@/modules/rules/model";
export function ShippingReport({
  results,
  review,
}: {
  results: ShippingResult[];
  review: ShippingReview;
}) {
  const docs = results.flatMap((r) => (r.document ? [r.document] : [])),
    groups = comparisonGroups(review, docs, undefined, true),
    labels = {
      ...assessmentLabels,
      not_comparable: "비교 불가",
      not_applicable: "대조 대상 없음",
    };
  return (
    <>
      <button
        onClick={() => window.print()}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold print:hidden"
      >
        검토 보고서 인쇄 / PDF 저장
      </button>
      <style>{`@media print {body * {visibility:hidden} #shipping-print-report,#shipping-print-report * {visibility:visible} #shipping-print-report {display:block;position:absolute;left:0;top:0;width:100%;font-size:9pt} #shipping-print-report tr,#shipping-print-report li {break-inside:avoid} #shipping-print-report th,#shipping-print-report td{padding:6pt;border:1px solid #cbd5e1} #shipping-print-report thead{display:table-header-group} dialog {display:none}}`}</style>
      <article
        id="shipping-print-report"
        className="hidden bg-white p-6 text-slate-900 print:block"
      >
        <h1 className="text-xl font-bold">OceanRisk AI 선적서류 검토 보고서</h1>
        {review.status === "not_performed" ? (
          <p className="my-3">
            서류 간 대조 미실시 · PDF 원문 준비 또는 대상 부족 상태입니다.
            불일치가 없다는 판정이 아닙니다.
          </p>
        ) : (
          <p className="my-3">
            확정 불일치{" "}
            {review.outcomes?.mismatches ??
              review.summary?.confirmedMismatches ??
              0}{" "}
            · 확인된 일치{" "}
            {review.outcomes?.matches ?? review.summary?.matches ?? 0} ·
            잠정/확인 필요{" "}
            {review.outcomes?.review ??
              (review.summary?.provisional ?? 0) +
                (review.summary?.needsReview ?? 0)}{" "}
            · 정보 부족/비교 불가{" "}
            {review.outcomes
              ? review.outcomes.requiredMissing + review.outcomes.notComparable
              : (review.summary?.insufficient ?? 0) +
                (review.summary?.notComparable ?? 0)}{" "}
            ({review.outcomes ? "의미·범위별 독립 판정 기준" : "원본 검사 기준"}
            )
          </p>
        )}
        {review.outcomes && (
          <p>
            대조 대상 없음 {review.outcomes.notApplicable} · 현재 원문 근거
            미확인{" "}
            {review.outcomes.evidenceUnverified ??
              review.outcomes.evidenceFailed}{" "}
            · 최초 AI 미확인 {review.outcomes.evidenceFailed} · 복구{" "}
            {review.outcomes.evidenceRecovered ?? 0} · 원본 검사{" "}
            {review.outcomes.checksExecuted} / 독립 판정{" "}
            {review.outcomes.independentChecks}
          </p>
        )}
        {(review.outcomes?.evidenceUnverified ??
          review.outcomes?.evidenceFailed ??
          0) > 0 && (
          <p className="my-2 font-bold">
            검토 미완료 · 근거 미확인 항목이 남아 있습니다. 오류 0건을 전체
            정상으로 해석하지 마세요.
          </p>
        )}
        <h2 className="mt-4 font-bold">분석 대상</h2>
        <ul>
          {results.map((r) => (
            <li key={r.pdf.id}>
              {r.pdf.fileName} ·{" "}
              {r.detectedType
                ? shippingLabels[r.detectedType].title
                : "실제 유형 미확인"}{" "}
              ·{" "}
              {r.error
                ? "실패"
                : r.document?.extractionStatus === "not_performed"
                  ? "PDF 원문만 준비"
                  : r.document?.extractionStatus === "partial"
                    ? "일부 성공"
                    : "분석 완료"}{" "}
              · 분류{" "}
              {r.document?.classificationStatus === "classified"
                ? "근거 확인"
                : r.document?.classificationStatus === "needs_review"
                  ? "불확실"
                  : "미실시"}
            </li>
          ))}
        </ul>
        <h2 className="mt-4 font-bold">불일치 및 확인 필요 사항</h2>
        <ul>
          {review.issues?.map((issue) => (
            <li key={issue.id} className="mb-2">
              <strong>
                {issue.title} · {labels[issue.assessment]}
              </strong>
              <p>
                관련 검사 {issue.relatedCheckIds.length}건 · {issue.explanation}
              </p>
              <p>{issue.followUp}</p>
              <p>
                {issue.documentIds
                  .map((id) => docs.find((d) => d.id === id)?.fileName ?? id)
                  .join(" · ")}
              </p>
            </li>
          ))}
        </ul>
        <p>모든 검사와 근거는 아래 비교표에 보존됩니다.</p>
        <h2 className="my-3 font-bold">서류별 통합 비교표</h2>
        <table className="w-full border-collapse text-left text-[9px]">
          <thead>
            <tr>
              <th>항목</th>
              {shippingTypes.map((t) => (
                <th key={t}>{shippingLabels[t].title}</th>
              ))}
              <th>판정</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id}>
                <th className="align-top">{g.title}</th>
                {shippingTypes.map((t) => (
                  <td key={t} className="align-top">
                    {pairedReadings(
                      comparisonDisplayFields(g).filter(
                        (f) =>
                          docs.find((d) => d.id === f.documentId)
                            ?.detectedType === t,
                      ),
                    ).map(({ field: f, text }, i) => (
                      <p key={i}>
                        {text} ·{" "}
                        {f.field.current.status === "verified"
                          ? "원문 확인"
                          : f.field.current.status === "user_edited"
                            ? "사용자 수정"
                            : "근거 미확인"}
                        <br />
                        {f.field.original.source?.fileName ?? f.documentId} · p.
                        {f.field.original.source?.page ?? "?"} ·{" "}
                        {f.field.original.source?.segments
                          ?.map((s) => s.blockId)
                          .join(", ") ?? "블록 없음"}
                      </p>
                    ))}
                  </td>
                ))}
                <td className="align-top">
                  {labels[g.assessment]} · {g.checks.length}개 검사
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <h2 className="my-3 font-bold">원본 검사 기록 (보존)</h2>
        <ul className="text-[8px]">
          {review.checks.map((c) => (
            <li key={c.id} className="border-b border-slate-200 py-1">
              <strong>
                {c.title ?? c.category} · {labels[c.assessment]}
              </strong>{" "}
              — {c.comparison?.reasonCodes?.join(", ") || c.explanation}
              <br />
              {[
                ...new Set(
                  c.fields.map(
                    (f) =>
                      `${docs.find((d) => d.id === f.documentId)?.fileName ?? f.documentId} p.${f.field.current.source?.page ?? "?"} ${f.field.current.source?.segments?.map((s) => s.blockId).join(",") ?? "근거 없음"}`,
                  ),
                ),
              ].join(" / ")}
            </li>
          ))}
        </ul>
        <h2 className="my-3 font-bold">분석 제한 사항</h2>
        <p>
          검증된 참조 범위의 자료 정합성 보조 검토입니다. 누락
          필드·부분선적·미명시 배분은 정상 일치로 취급하지 않습니다. 사용자
          수정·OCR 인식은 원문 검증 성공이 아닙니다. PDF 전문은 보고서에
          포함하지 않습니다. 세관 신고·법률 판단을 대신하지 않습니다.
        </p>
      </article>
    </>
  );
}
