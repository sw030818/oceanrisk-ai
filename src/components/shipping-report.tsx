"use client";
import type { ShippingResult } from "@/modules/shipping/prepare";
import type { ShippingReview } from "@/modules/shipping/review-model";
import { shippingLabels } from "@/modules/shipping/catalog";
const labels = {
  confirmed_match: "확인된 일치",
  confirmed_mismatch: "확인된 불일치",
  provisional_match: "잠정 일치",
  provisional_mismatch: "잠정 불일치",
  needs_review: "확인 필요",
  insufficient_information: "정보 부족",
  not_comparable: "비교 불가",
};
export function ShippingReport({
  results,
  review,
}: {
  results: ShippingResult[];
  review: ShippingReview;
}) {
  return (
    <>
      <button
        onClick={() => window.print()}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold print:hidden"
      >
        검토 보고서 인쇄 / PDF 저장
      </button>
      <style>{`@media print {body * {visibility:hidden} #shipping-print-report,#shipping-print-report * {visibility:visible} #shipping-print-report {display:block;position:absolute;left:0;top:0;width:100%;font-size:10pt} #shipping-print-report tr {break-inside:avoid} dialog {display:none}}`}</style>
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
            확정 불일치 {review.summary?.confirmedMismatches ?? 0} · 잠정{" "}
            {review.summary?.provisional ?? 0} · 확인 필요{" "}
            {review.summary?.needsReview ?? 0} · 정보 부족{" "}
            {review.summary?.insufficient ?? 0}
          </p>
        )}
        <p>
          AI 추출과 원문 근거 확인을 구분한 보조 검토입니다. 사용자 수정·OCR
          인식은 원문 검증 성공이 아닙니다. 세관 신고·법률 판단을 대신하지
          않습니다.
        </p>
        <ul className="my-4">
          {results.map((r) => (
            <li key={r.pdf.id}>
              {r.pdf.fileName} ·{" "}
              {shippingLabels[r.detectedType ?? r.uploadSlot].title} ·{" "}
              {r.error
                ? "실패"
                : r.document?.extractionStatus === "partial"
                  ? "일부 성공"
                  : r.document?.extractionStatus === "not_performed"
                    ? "PDF 원문만 준비"
                    : "분석 완료"}
            </li>
          ))}
        </ul>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              <th>검토 항목 / 상태</th>
              <th>값 및 원문 참조</th>
              <th>판정 이유 / 다음 확인</th>
            </tr>
          </thead>
          <tbody>
            {review.checks.map((c) => (
              <tr key={c.id} className="border-t border-slate-300">
                <td className="p-2 align-top">
                  {c.title ?? c.category}
                  <br />
                  {labels[c.assessment]}
                </td>
                <td className="p-2 align-top">
                  {c.fields.map((f, i) => (
                    <p key={i}>
                      {String(f.field.current.value ?? "정보 없음")} ·{" "}
                      {f.field.current.status === "user_edited"
                        ? "사용자 수정"
                        : f.field.current.status === "verified"
                          ? "원문 확인"
                          : "근거 미확인"}
                      <br />
                      {f.field.original.source?.fileName ?? f.documentId} ·{" "}
                      {f.field.original.source?.page ?? "?"}페이지
                    </p>
                  ))}
                </td>
                <td className="p-2 align-top">
                  {c.explanation}
                  <br />
                  {c.followUp}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </>
  );
}
