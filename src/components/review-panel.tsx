"use client";
import { CheckCircle2, AlertTriangle, FileSearch } from "lucide-react";
import type { GroundedField } from "@/modules/documents/schema";
import { assessmentLabels, type ReviewCheck } from "@/modules/rules/model";
import type { reviewDocuments } from "@/modules/rules/review";
import { statusLabels } from "./field-status";
export function ReviewPanel({
  review,
  onEvidence,
}: {
  review: ReturnType<typeof reviewDocuments>;
  onEvidence: (field: GroundedField<string | number>, label: string) => void;
}) {
  const cards = (checks: ReviewCheck[]) =>
    checks.map((c) => {
      const tone =
        c.assessment === "confirmed_mismatch"
          ? "border-red-200 bg-red-50/50"
          : c.assessment === "confirmed_match"
            ? "border-emerald-100 bg-emerald-50/50"
            : c.assessment === "insufficient_information"
              ? "border-slate-200 bg-slate-50/50"
              : "border-amber-200 bg-amber-50/50";
      return (
        <article
          key={c.id}
          data-testid={`check-${c.id}`}
          data-assessment={c.assessment}
          className={`rounded-xl border p-4 ${tone}`}
        >
          <div className="flex items-start gap-3">
            {c.assessment === "confirmed_match" ? (
              <CheckCircle2
                size={18}
                className="mt-0.5 shrink-0 text-emerald-600"
              />
            ) : (
              <AlertTriangle
                size={18}
                className={`mt-0.5 shrink-0 ${c.assessment === "confirmed_mismatch" ? "text-red-600" : "text-amber-600"}`}
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold">
                <span className="mr-2">{assessmentLabels[c.assessment]}</span>
                {c.item && c.category === "quantity" ? `${c.item} · ` : ""}
                {c.title}
              </p>
              {(c.leftValue !== undefined || c.rightValue !== undefined) && (
                <p className="mt-2 break-words text-sm font-semibold">
                  {c.scope === "cross" ? "Invoice " : "비교 값 "}
                  {c.leftValue ?? "정보 없음"} {c.unit}
                  <span className="mx-2 font-normal text-slate-400">↔</span>
                  {c.scope === "cross" ? "Packing List " : "문서 값 "}
                  {c.rightValue ?? "정보 없음"} {c.unit}
                </p>
              )}
              <p className="mt-2 text-[11px] leading-5 text-slate-600">
                {c.explanation}
              </p>
              <div className="mt-3 rounded-lg bg-white/70 p-3 text-[11px] leading-5">
                <span className="font-semibold text-blue-700">
                  발행자에게 물어보세요
                </span>
                <p className="mt-1 text-slate-600">{c.question}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {c.fields.map(({ field, label }, index) => (
                  <button
                    key={`${label}-${index}`}
                    onClick={() => onEvidence(field, label)}
                    className="max-w-full break-all rounded-md border border-slate-200 bg-white px-2.5 py-2 text-left text-[10px] text-slate-600"
                  >
                    <FileSearch size={12} className="mr-1 inline" />
                    {label} · {statusLabels[field.status]}
                    {field.source &&
                      ` · ${field.source.fileName} p.${field.source.page}`}{" "}
                    · 원문 보기
                  </button>
                ))}
              </div>
            </div>
          </div>
        </article>
      );
    });
  const s = review.summary;
  const state =
    review.status === "not_started"
      ? "분석 미실시"
      : review.status === "insufficient_documents"
        ? "대상 서류 부족"
        : review.status === "needs_review"
          ? "교차검증 완료 · 일부 항목 확인 필요"
          : "교차검증 완료";
  return (
    <div data-testid="review-panel">
      <section
        role="status"
        className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4"
      >
        <h2 className="text-sm font-bold text-blue-900">{state}</h2>
        <p className="mt-2 text-xs leading-6 text-slate-600">
          선택한 두 서류의 비교 의도와 실제 거래 동일성은 별도로 확인합니다.
          일부 참조·근거가 부족해도 다른 항목 검사는 계속합니다. 잠정 결과는
          확정 오류 건수에 포함하지 않습니다.
        </p>
      </section>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        {[
          ["분석 완료 문서", s.analyzedDocuments],
          ["실제 비교된 품목", s.comparedItems],
          ["확인된 일치 항목", s.confirmedMatches],
          ["확인된 불일치 항목", s.confirmedMismatches],
          ["잠정 결과·확인 필요", s.provisionalOrReview],
          ["정보 부족 항목", s.insufficientInformation],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <p className="text-2xl font-bold">{value}</p>
            <p className="mt-2 text-[10px] text-slate-500">{label}</p>
          </div>
        ))}
      </div>
      {s.referenceWarning && (
        <section
          role="alert"
          className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900"
        >
          <strong>거래 참조 충돌 경고 · 서로 다른 거래일 가능성</strong>
          <p>
            동일 의미의 참조가 충돌합니다. 품목 비교는 계속하되 거래 동일성에
            의존하는 결과는 확정하지 않았습니다.
          </p>
        </section>
      )}
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
        <h2 className="mb-4 text-sm font-bold">수량 교차검증</h2>
        <p className="mb-4 text-[11px] text-slate-500">
          {s.comparedItems > 0 ? (
            <>
              확인된 수량 일치 {s.confirmedQuantityMatches}건 · 확인된 수량
              불일치 {s.confirmedQuantityMismatches}건 · 원문 대조 + TypeScript
              규칙
            </>
          ) : review.status === "insufficient_documents" ||
            review.status === "not_started" ? (
            "수량 비교 미실시 · 대상 서류 부족"
          ) : (
            "수량 비교 확인 필요 · 비교 가능한 품목 또는 값 부족"
          )}
        </p>
        <div className="space-y-3">{cards(review.quantityChecks)}</div>
      </section>
      <details
        className="mb-6 rounded-2xl border border-slate-200 bg-white p-5"
        open={s.referenceWarning}
      >
        <summary className="cursor-pointer text-sm font-bold">
          당사자·참조·품목·단위·중량·포장 교차검증
        </summary>
        <div className="mt-4 space-y-3">
          {cards(
            review.checks.filter(
              (c) => c.scope === "cross" && c.category !== "quantity",
            ),
          )}
        </div>
      </details>
      <details className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
        <summary className="cursor-pointer text-sm font-bold">
          문서별 금액·중량·포장·필수정보 검토
        </summary>
        <div className="mt-4 space-y-3">
          {cards(review.checks.filter((c) => c.scope === "document"))}
        </div>
      </details>
    </div>
  );
}
