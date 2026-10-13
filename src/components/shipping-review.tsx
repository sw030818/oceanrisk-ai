"use client";
import { useState } from "react";
import type {
  ShippingReview,
  ShippingCheck,
  ShippingAssessment,
} from "@/modules/shipping/review-model";
import { assessmentLabels } from "@/modules/rules/model";
import { shippingFieldLabels } from "@/modules/shipping/catalog";
import type { GroundedField } from "@/modules/documents/schema";
const scopeNames = {
  house_bl_manifest: "House B/L ↔ Manifest",
  declaration_manifest: "수출신고필증 ↔ Manifest",
  house_bl_declaration: "House B/L ↔ 수출신고필증",
  triangle: "검증된 공통 항목 삼각대조",
  document: "문서 확인",
};
const labels: Record<ShippingAssessment, string> = {
  ...assessmentLabels,
  not_comparable: "비교 불가",
};
const rank = (c: ShippingCheck) =>
  c.assessment === "confirmed_mismatch"
    ? 0
    : c.assessment === "provisional_mismatch"
      ? 1
      : c.assessment === "needs_review"
        ? 2
        : c.assessment === "confirmed_match"
          ? 4
          : 3;
export function ShippingReviewPanel({
  review,
  onEvidence,
  onConfirmRelationship,
}: {
  review: ShippingReview;
  onConfirmRelationship?: (id: string) => void;
  onEvidence: (field: GroundedField<string | number>, label: string) => void;
}) {
  const [filter, setFilter] = useState<
      "attention" | "all" | "mismatch" | "review" | "match"
    >("attention"),
    s = review.summary;
  if (!s || review.status === "not_performed")
    return (
      <div
        data-testid="shipping-review"
        className="mt-5 rounded-xl border border-slate-200 bg-white p-5 text-xs text-slate-600"
      >
        서류 간 대조 미실시 ·{" "}
        {review.reason ??
          "AI 분석된 대상 서류가 부족합니다. PDF 원문 준비만으로 대조 성공을 표시하지 않습니다."}
      </div>
    );
  const visible = review.checks
    .filter(
      (c) =>
        filter === "all" ||
        (filter === "mismatch" && c.assessment.endsWith("mismatch")) ||
        (filter === "match" && c.assessment === "confirmed_match") ||
        (filter === "review" &&
          [
            "needs_review",
            "insufficient_information",
            "not_comparable",
            "provisional_match",
          ].includes(c.assessment)) ||
        (filter === "attention" &&
          [
            "confirmed_mismatch",
            "provisional_mismatch",
            "needs_review",
            "not_comparable",
          ].includes(c.assessment)),
    )
    .sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
  return (
    <section
      data-testid="shipping-review"
      className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 md:p-6"
    >
      <h2 className="text-base font-bold text-[#142744]">서류 간 대조 결과</h2>
      <p className="mt-2 text-xs leading-6 text-slate-500">
        {review.reason} 판정은 신고 전 확인을 돕는 자료 정합성 검토이며 법률
        위반·과태료를 확정하지 않습니다.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["확인된 일치", s.matches],
          ["확정 불일치", s.confirmedMismatches],
          ["잠정·확인 필요", s.provisional + s.needsReview],
          ["정보 부족·비교 불가", s.insufficient + s.notComparable],
        ].map(([title, count]) => (
          <div key={title} className="rounded-lg bg-slate-50 p-3">
            <p className="text-[11px] text-slate-500">{title}</p>
            <p className="mt-2 text-xl font-semibold">{count}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs leading-6 text-slate-600">
        관계: 근거 확인 {s.confirmedRelationships} · 사용자 확인{" "}
        {s.userConfirmedRelationships} · 후보 {s.proposedRelationships} · 충돌{" "}
        {s.conflictingRelationships} / 양자 검사 {s.pairChecks} · 삼각 검사{" "}
        {s.triangleChecks}
      </p>
      <details className="mt-4 rounded-lg border border-slate-200 p-3">
        <summary className="cursor-pointer text-xs font-semibold">
          선적 연결 근거와 범위 확인
        </summary>
        {review.relationships?.map((r) => (
          <div
            key={r.id}
            className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-6"
          >
            <strong>
              {r.status === "evidence_confirmed"
                ? "원문 근거로 연결"
                : r.status === "conflict"
                  ? "연결 충돌"
                  : r.status === "user_confirmed"
                    ? "사용자 연결 확인 · 잠정"
                    : "관계 확인 필요"}
            </strong>{" "}
            ·{" "}
            {r.scope === "full"
              ? "전체 범위"
              : r.scope === "partial"
                ? "부분선적"
                : r.scope === "combined_packages"
                  ? "동시포장"
                  : "범위 미확인"}
            <p>{r.reason}</p>
            {r.status === "proposed" && onConfirmRelationship && (
              <button
                className="mt-2 rounded border border-amber-200 bg-white px-3 py-2 text-xs"
                onClick={() => onConfirmRelationship(r.id)}
              >
                동일 선적 사용자 확인 (잠정)
              </button>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {r.evidence.map((f, i) => (
                <button
                  key={i}
                  onClick={() =>
                    onEvidence(f.field.current, "선적 연결 · " + f.fieldName)
                  }
                  className="rounded border border-blue-100 bg-white px-2 py-1 text-blue-700"
                >
                  {f.field.current.source?.fileName ?? "근거 없음"} ·{" "}
                  {f.field.current.value} ·{" "}
                  {f.field.current.source?.page ?? "?"}페이지
                </button>
              ))}
            </div>
          </div>
        ))}
      </details>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold">
          {filter === "attention" ? "우선 확인할 항목" : "모든 비교 항목"}
        </p>
        <select
          aria-label="검토 결과 필터"
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="rounded-lg border border-slate-200 bg-white p-2 text-xs"
        >
          <option value="attention">우선 확인</option>
          <option value="all">전체</option>
          <option value="mismatch">불일치</option>
          <option value="review">확인 필요 · 정보 부족</option>
          <option value="match">확인된 일치</option>
        </select>
        <button
          onClick={() =>
            setFilter(filter === "attention" ? "all" : "attention")
          }
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
        >
          {filter === "attention"
            ? "일치·정보 부족 포함 전체 보기"
            : "확인할 항목만 보기"}
        </button>
      </div>
      {!visible.length && (
        <p className="mt-4 rounded-lg bg-blue-50 p-4 text-xs leading-6 text-blue-900">
          비교된 범위에서 확정 불일치 또는 우선 경고를 발견하지 않았습니다. 정보
          부족 항목과 원문은 전체 보기에서 확인해 주세요.
        </p>
      )}
      <div className="mt-4 space-y-3">
        {visible.map((c) => (
          <article
            key={c.id}
            data-testid="shipping-check"
            data-assessment={c.assessment}
            data-category={c.category}
            data-scope={c.scope}
            className={`min-w-0 rounded-xl border p-4 ${c.assessment === "confirmed_mismatch" ? "border-red-200 bg-red-50" : c.assessment === "confirmed_match" ? "border-blue-100 bg-blue-50/30" : "border-amber-100 bg-amber-50/30"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="break-words text-xs font-bold">
                {c.title ?? c.category}
              </h3>
              <span className="rounded bg-white px-2 py-1 text-[10px] font-semibold">
                {labels[c.assessment]}
              </span>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              {scopeNames[c.scope]} · 중요도{" "}
              {c.importance === "high"
                ? "높음"
                : c.importance === "info"
                  ? "정보"
                  : "확인"}{" "}
              / 확실성{" "}
              {c.assessment.startsWith("confirmed_")
                ? "원문·연결 확인"
                : "잠정 또는 보류"}
            </p>
            <p className="mt-3 text-xs leading-6">{c.explanation}</p>
            {!!c.uncertainties?.length && (
              <ul className="mt-2 text-[11px] leading-6 text-amber-900">
                {c.uncertainties.map((w) => (
                  <li key={w}>• {w}</li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {c.fields.map((f, i) => (
                <button
                  key={i}
                  onClick={() =>
                    onEvidence(f.field.current, c.title ?? "서류 간 대조 근거")
                  }
                  className="max-w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-[11px] leading-5"
                >
                  <span className="block break-all font-semibold">
                    {f.field.current.source?.fileName ?? "사용자 확인값"} ·{" "}
                    {shippingFieldLabels[
                      f.fieldName as keyof typeof shippingFieldLabels
                    ] ??
                      (f.fieldName === "weightUnit"
                        ? "중량 단위"
                        : f.fieldName)}
                  </span>
                  <span className="break-all">
                    {String(f.field.current.value ?? "정보 없음")} ·{" "}
                    {f.field.current.status === "user_edited"
                      ? "사용자 수정"
                      : f.field.current.status === "verified"
                        ? "원문 확인"
                        : "근거 미확인"}{" "}
                    ·{" "}
                    {f.field.current.source
                      ? `${f.field.current.source.page}페이지 원문 보기`
                      : "원문 없음"}
                  </span>
                </button>
              ))}
            </div>
            {c.computedValues?.map((v) => (
              <p key={v.documentId} className="mt-2 text-xs">
                검증된 화물행 합산: {v.value} {v.unit} ·{" "}
                {v.componentKeys.length}개 행 (AI 원본 합계와 구분)
              </p>
            ))}
            <p className="mt-3 border-t border-slate-200/60 pt-3 text-[11px] leading-6 text-slate-600">
              다음 확인: {c.followUp}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
