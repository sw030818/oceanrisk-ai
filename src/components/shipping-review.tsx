"use client";
import { useState, useRef, useEffect } from "react";
import type {
  ShippingReview,
  ShippingAssessment,
} from "@/modules/shipping/review-model";
import type { ShippingDocument } from "@/modules/shipping/schema";
import { assessmentLabels } from "@/modules/rules/model";
import { shippingLabels, shippingTypes } from "@/modules/shipping/catalog";
import {
  assessmentRank,
  comparisonGroups,
  comparisonDisplayFields,
  shipmentOptions,
  type ComparisonGroup,
} from "@/modules/shipping/presentation";
import { portCode, contextualCarton } from "@/modules/shipping/equivalence";
import { partyName32 } from "@/modules/shipping/parties";
import { unit32, refKey32 } from "@/modules/shipping/review-evidence";
import {
  literalReading,
  pairedReadings,
} from "@/modules/shipping/display-reading";
import { shippingFieldLabels } from "@/modules/shipping/catalog";
import { ShippingFields } from "./shipping-fields";
import type { GroundedField } from "@/modules/documents/schema";
const labels: Record<ShippingAssessment, string> = {
  ...assessmentLabels,
  provisional_match: "값은 같지만 근거 확인 필요 (잠정 일치)",
  provisional_mismatch: "차이가 있으나 확정 전 확인 필요 (잠정 불일치)",
  not_comparable: "비교 불가",
  not_applicable: "대조 대상 없음",
};
const color = (s: ShippingAssessment) =>
  s === "confirmed_mismatch"
    ? "bg-red-50 text-red-700"
    : s === "confirmed_match"
      ? "bg-emerald-50 text-emerald-800"
      : [
            "insufficient_information",
            "not_comparable",
            "not_applicable",
          ].includes(s)
        ? "bg-slate-100 text-slate-600"
        : "bg-orange-50 text-orange-800";
export function ShippingReviewPanel({
  review,
  documents = [],
  onUpdate,
  onEvidence,
  onConfirmRelationship,
}: {
  review: ShippingReview;
  documents?: ShippingDocument[];
  onUpdate?: (doc: ShippingDocument) => void;
  onConfirmRelationship?: (id: string) => void;
  onEvidence: (f: GroundedField<string | number>, label: string) => void;
}) {
  const [filter, setFilter] = useState("attention"),
    [shipment, setShipment] = useState("all"),
    [selected, setSelected] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    s = review.summary,
    options = shipmentOptions(documents);
  const groups = comparisonGroups(
    review,
    documents,
    shipment === "all"
      ? undefined
      : options.find((g) => g.id === shipment)?.documentIds,
    true,
  );
  const issueSelection = (() => {
    if (!selected?.startsWith("issue-selection:")) return undefined;
    try {
      const choice = JSON.parse(selected.slice("issue-selection:".length)) as {
        title: string;
        checkIds: string[];
      };
      const checks = (review.primaryChecks ?? review.checks).filter((c) =>
        choice.checkIds.includes(c.id),
      );
      if (!checks.length) return undefined;
      return {
        id: selected,
        title: choice.title,
        checks,
        assessment: [...checks].sort(
          (a, b) => assessmentRank[a.assessment] - assessmentRank[b.assessment],
        )[0].assessment,
        fields: [
          ...new Map(
            checks.flatMap((c) => c.fields).map((f) => [refKey32(f), f]),
          ).values(),
        ],
      } satisfies ComparisonGroup;
    } catch {
      return undefined;
    }
  })();
  const active = issueSelection ?? groups.find((g) => g.id === selected);
  useEffect(() => {
    if (active && !dialog.current?.open) dialog.current?.showModal();
    else if (!active) dialog.current?.close();
  }, [active]);
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
  const visible = groups
    .map((g) => ({
      ...g,
      checks: g.checks.filter(
        (c) =>
          filter === "all" ||
          (filter === "not_applicable" && c.assessment === "not_applicable") ||
          (filter === "mismatch" && c.assessment.endsWith("mismatch")) ||
          (filter === "match" && c.assessment === "confirmed_match") ||
          (filter === "review" &&
            [
              "needs_review",
              "insufficient_information",
              "not_comparable",
              "provisional_match",
              "provisional_mismatch",
            ].includes(c.assessment)) ||
          (filter === "attention" &&
            c.assessment !== "confirmed_match" &&
            c.assessment !== "not_applicable"),
      ),
    }))
    .filter((g) => g.checks.length)
    .map((g) => ({
      ...g,
      assessment: [...g.checks].sort(
        (a, b) => assessmentRank[a.assessment] - assessmentRank[b.assessment],
      )[0].assessment,
      fields: g.fields.filter((f) =>
        g.checks.some((c) =>
          c.fields.some(
            (v) =>
              v.documentId === f.documentId &&
              v.fieldName === f.fieldName &&
              v.itemId === f.itemId &&
              v.cargoId === f.cargoId &&
              v.containerId === f.containerId &&
              v.referenceId === f.referenceId,
          ),
        ),
      ),
    }));
  const source = (
    g: ComparisonGroup,
    f: ComparisonGroup["fields"][number],
    displayed?: string,
  ) => (
    <button
      onClick={() => onEvidence(f.field.current, g.title)}
      className="block max-w-full break-words text-left text-xs text-[#142744] hover:text-blue-700"
      title={`${f.field.current.source?.fileName ?? "원문 없음"} · ${f.field.current.source?.page ?? "?"}페이지`}
    >
      <span className="font-medium">
        {displayed ?? literalReading(f.field)}
      </span>
      <span
        className={`ml-1 text-[10px] ${f.field.current.status === "verified" ? "text-emerald-700" : f.field.current.status === "missing" ? "text-slate-400" : "text-orange-700"}`}
      >
        {f.field.current.status === "verified"
          ? "원문 확인"
          : f.field.current.status === "user_edited"
            ? "사용자 수정"
            : f.field.current.status === "missing"
              ? "정보 없음"
              : "근거 미확인"}
      </span>
    </button>
  );
  const tableFields = (g: ComparisonGroup, type: string) => {
    const fs = comparisonDisplayFields(g).filter(
      (f) =>
        documents.find((d) => d.id === f.documentId)?.detectedType === type,
    );
    return pairedReadings(fs);
  };
  return (
    <section
      data-testid="shipping-review"
      className="relative mt-5 min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white"
    >
      <div className="border-b border-slate-200 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-[#142744]">
            서류 간 대조 결과
          </h2>
          <span className="text-xs text-slate-500">
            검사 {review.checks.length}건 · 비교표 {groups.length}행 · 확정
            불일치 {review.outcomes?.mismatches ?? s.confirmedMismatches}건
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-600">
          관계: 근거 확인 {s.confirmedRelationships} · 사용자 확인{" "}
          {s.userConfirmedRelationships} · 후보 {s.proposedRelationships} · 충돌{" "}
          {s.conflictingRelationships} / 양자 검사 {s.pairChecks} · 삼각 검사{" "}
          {s.triangleChecks}
        </p>
        <div
          data-testid="review-kpis"
          className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4"
        >
          {[
            [
              "확정 불일치",
              review.outcomes?.mismatches ?? s.confirmedMismatches,
            ],
            [
              "확인 필요",
              review.issues?.filter(
                (i) => i.assessment !== "confirmed_mismatch",
              ).length ?? s.needsReview,
            ],
            [
              "현재 원문 근거 미확인",
              review.outcomes?.evidenceUnverified ??
                review.outcomes?.evidenceFailed ??
                0,
            ],
            ["확인된 일치", review.outcomes?.matches ?? s.matches],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-slate-200 bg-slate-50 p-3"
            >
              <p className="text-[11px] text-slate-600">{label}</p>
              <p className="mt-1 text-xl font-bold text-[#142744]">{value}</p>
            </div>
          ))}
        </div>
        {!!(
          review.outcomes?.evidenceUnverified ?? review.outcomes?.evidenceFailed
        ) && (
          <p
            data-testid="review-incomplete"
            className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900"
          >
            검토 미완료 · 원문 근거를 확인하지 못한 필드가 남아 있습니다. 확정
            불일치 0건은 모든 서류가 정상이라는 뜻이 아닙니다.
          </p>
        )}
        {review.outcomes && (
          <p className="mt-2 text-xs text-slate-500">
            독립 판정 {review.outcomes.independentChecks} · 대조 대상 없음{" "}
            {review.outcomes.notApplicable} · 최초 AI 근거 미확인{" "}
            {review.outcomes.evidenceFailed} · 현재 복구{" "}
            {review.outcomes.evidenceRecovered ?? 0} (원본 검사 진단은 상세에
            보존)
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <select
            aria-label="검토 결과 필터"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-slate-200 p-2 text-xs"
          >
            <option value="attention">우선 확인</option>
            <option value="all">전체</option>
            <option value="mismatch">불일치</option>
            <option value="review">확인 필요 · 정보 부족</option>
            <option value="match">확인된 일치</option>
            <option value="not_applicable">대조 대상 없음</option>
          </select>
          {options.length > 1 && (
            <select
              aria-label="선적 그룹 선택"
              value={shipment}
              onChange={(e) => {
                setShipment(e.target.value);
                setSelected(null);
              }}
              className="max-w-full rounded-lg border border-slate-200 p-2 text-xs"
            >
              <option value="all">전체 선적 · 복수 문서 값 함께 표시</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label} · {o.documentIds.length}문서
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() =>
              setFilter(filter === "attention" ? "all" : "attention")
            }
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
          >
            {filter === "attention"
              ? "일치·대조 대상 없음 포함 전체 보기"
              : "확인할 항목만 보기"}
          </button>
        </div>
      </div>
      {filter === "attention" && (
        <section
          aria-label="업무상 확인할 문제"
          className="space-y-2 px-4 pb-4"
        >
          <p className="text-sm font-semibold text-slate-800">
            조치가 필요한 문제 {review.issues?.length ?? visible.length}건
          </p>
          {(review.issues ?? [])
            .filter(
              (issue) =>
                shipment === "all" ||
                issue.documentIds.every((id) =>
                  options
                    .find((o) => o.id === shipment)
                    ?.documentIds.includes(id),
                ),
            )
            .map((issue) => (
              <article
                key={issue.id}
                data-testid="review-issue"
                className={`rounded-lg border p-3 ${issue.severity === "high" ? "border-red-200 bg-red-50/50" : "border-slate-200 bg-slate-50"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold">
                    {issue.title} ·{" "}
                    {issue.rootCauseIds?.some((k) =>
                      k.includes("product-meaning"),
                    )
                      ? "공통 품목군 · 규격 확인 필요"
                      : labels[issue.assessment]}
                  </h4>
                  <button
                    className="text-xs font-semibold text-blue-700"
                    onClick={() => {
                      setSelected(
                        "issue-selection:" +
                          JSON.stringify({
                            title: issue.title,
                            checkIds: issue.relatedCheckIds,
                          }),
                      );
                    }}
                  >
                    판정·원문 근거 확인
                  </button>
                </div>
                <p className="mt-1 break-words text-xs text-slate-600">
                  {issue.explanation}
                </p>
                <p className="mt-1 text-xs text-slate-700">{issue.followUp}</p>
                <p className="mt-1 break-words text-[11px] text-slate-600">
                  영향 항목:{" "}
                  {[
                    ...new Set(
                      issue.affectedFieldNames ??
                        issue.fields.map((f) => f.fieldName),
                    ),
                  ]
                    .map(
                      (k) =>
                        shippingFieldLabels[
                          k as keyof typeof shippingFieldLabels
                        ] ?? (k === "documentType" ? "문서 유형" : k),
                    )
                    .join(" · ")}{" "}
                  · 관련 검사 {issue.relatedCheckIds.length}건
                </p>
                <p className="mt-1 break-words text-[10px] text-slate-500">
                  {issue.documentIds
                    .map(
                      (id) =>
                        documents.find((d) => d.id === id)?.fileName ?? id,
                    )
                    .join(" · ")}
                </p>
              </article>
            ))}
          {!visible.length && (
            <p
              data-testid="normal-review-summary"
              className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900"
            >
              {(review.outcomes?.evidenceUnverified ?? 0) > 0
                ? "현재 비교에서 확인된 오류는 없지만 원문 근거 검토가 남아 있습니다. 확인된 일치 "
                : "현재 실행된 검사에서 확인할 문제가 없습니다. 확인된 일치 "}
              {review.outcomes?.matches ?? s.matches}건입니다. 전체 보기에서
              모든 검사와 대조 대상 없음을 확인할 수 있습니다.
            </p>
          )}
        </section>
      )}
      <p className="px-4 pb-2 text-[11px] text-slate-500 md:hidden">
        항목별 카드에서 서류 원문값을 비교하세요. 값을 누르면 PDF 근거가
        열립니다.
      </p>
      <div
        className="max-w-full overflow-x-auto"
        role="region"
        aria-label="문서 비교표 스크롤"
        tabIndex={0}
      >
        <table className="w-full table-fixed text-left text-xs md:min-w-[700px]">
          <caption className="sr-only">
            선적서류 비교표. 같은 종류의 복수 문서는 파일명을 함께 표시합니다.
          </caption>
          <thead className="hidden border-b border-slate-200 bg-slate-50 md:table-header-group">
            <tr>
              <th className="w-[19%] p-3">항목</th>
              {shippingTypes.map((t) => (
                <th key={t} className="w-[19%] p-3">
                  {shippingLabels[t].title}
                </th>
              ))}
              <th className="w-[14%] p-3">판정 / 상세</th>
            </tr>
          </thead>
          <tbody className="block md:table-row-group">
            {(filter === "attention" && review.issues
              ? visible.filter((g) =>
                  review.issues!.some(
                    (issue) =>
                      issue.relatedCheckIds.find((id) =>
                        visible.some((v) => v.checks.some((c) => c.id === id)),
                      ) === g.checks[0]?.id,
                  ),
                )
              : visible
            ).map((g) => (
              <tr
                key={g.id}
                data-testid="comparison-row"
                className="mb-3 grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 align-top md:mb-0 md:table-row md:rounded-none md:border-0 md:border-b md:border-slate-100 md:p-0 md:hover:bg-slate-50/70"
              >
                <th className="break-words bg-white font-semibold md:sticky md:left-0 md:z-[1] md:p-3">
                  <button
                    onClick={() => setSelected(g.id)}
                    className="text-left hover:text-blue-700"
                  >
                    {g.title}
                  </button>
                  <p className="mt-1 text-[10px] font-normal text-slate-500">
                    {g.checks.length}개 검사 통합
                  </p>
                </th>
                {shippingTypes.map((t) => (
                  <td key={t} className="block min-w-0 md:table-cell md:p-3">
                    <p className="mb-1 text-[10px] font-semibold text-slate-500 md:hidden">
                      {shippingLabels[t].title}
                    </p>
                    <div className="space-y-2">
                      {tableFields(g, t).map(({ field: f, text }, i) => (
                        <div key={i}>
                          {source(g, f, text)}
                          <p
                            className="max-w-full truncate text-[10px] text-slate-400"
                            title={
                              documents.find((d) => d.id === f.documentId)
                                ?.fileName
                            }
                          >
                            {documents.filter((d) => d.detectedType === t)
                              .length > 1
                              ? `${documents.find((d) => d.id === f.documentId)?.fileName} · `
                              : ""}
                            p.{f.field.current.source?.page ?? "?"}
                          </p>
                        </div>
                      ))}
                      {g.checks
                        .flatMap((c) => c.comparison?.facts ?? [])
                        .filter(
                          (f, i, fs) =>
                            f.documentType === t &&
                            f.derivation !== "literal" &&
                            f.value !== null &&
                            fs.findIndex((v) => v.id === f.id) === i,
                        )
                        .map((f) => (
                          <p key={f.id} className="text-[10px] text-slate-500">
                            {f.derivation === "single_native_row"
                              ? "단일 행 연결"
                              : f.derivation === "user_override"
                                ? "사용자 수정 후보"
                                : "구성 행 합계"}
                            : {f.value} {f.unit} · {f.componentKeys.length}개
                            근거 (원본 추출과 구분)
                          </p>
                        ))}
                      {!g.fields.some(
                        (f) =>
                          documents.find((d) => d.id === f.documentId)
                            ?.detectedType === t,
                      ) && (
                        <span className="text-slate-400">
                          정보 없음 / 대상 없음
                        </span>
                      )}
                    </div>
                  </td>
                ))}
                <td className="block md:table-cell md:p-3">
                  <span
                    className={`inline-block rounded px-2 py-1 text-[10px] font-semibold ${color(g.assessment)}`}
                  >
                    {labels[g.assessment]}
                  </span>
                  <button
                    onClick={() => setSelected(g.id)}
                    aria-label={`${g.title} 상세 분석`}
                    className="mt-2 block text-xs font-semibold text-blue-700"
                  >
                    상세 보기 →
                  </button>
                  {new Set(g.checks.map((c) => c.assessment)).size > 1 && (
                    <p className="mt-2 text-[10px] text-slate-500">
                      일치{" "}
                      {
                        g.checks.filter(
                          (c) => c.assessment === "confirmed_match",
                        ).length
                      }{" "}
                      · 미확정{" "}
                      {
                        g.checks.filter(
                          (c) =>
                            c.assessment !== "confirmed_match" &&
                            c.assessment !== "confirmed_mismatch",
                        ).length
                      }
                    </p>
                  )}
                  {review.checks
                    .filter((raw) => {
                      const eligible =
                        filter === "all" ||
                        (filter === "mismatch" &&
                          raw.assessment.endsWith("mismatch")) ||
                        (filter === "match" &&
                          raw.assessment === "confirmed_match") ||
                        (filter === "review" &&
                          [
                            "needs_review",
                            "insufficient_information",
                            "not_comparable",
                            "provisional_match",
                            "provisional_mismatch",
                          ].includes(raw.assessment)) ||
                        (filter === "attention" &&
                          raw.assessment !== "confirmed_match" &&
                          raw.assessment !== "not_applicable");
                      return (
                        eligible &&
                        visible.find((v) =>
                          v.checks.some(
                            (c) =>
                              c.id === raw.id ||
                              c.comparison?.relatedCheckIds.includes(raw.id),
                          ),
                        )?.id === g.id
                      );
                    })
                    .map((raw) => (
                      <span
                        key={raw.id}
                        data-testid="shipping-check"
                        data-assessment={raw.assessment}
                        data-category={raw.category}
                        data-scope={raw.scope}
                        hidden
                      >
                        {raw.title} · {labels[raw.assessment]}
                      </span>
                    ))}
                  {g.checks.map((c) => (
                    <span
                      key={c.id}
                      data-testid="independent-check"
                      data-assessment={c.assessment}
                      data-category={c.category}
                      data-scope={c.scope}
                      className="sr-only"
                    >
                      {c.title} · {labels[c.assessment]}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  선택한 필터에 표시할 항목이 없습니다. 전체 보기에서 비교
                  범위와 정보 부족을 확인해 주세요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <details className="m-4 rounded-lg border border-slate-200 p-3">
        <summary className="cursor-pointer text-xs font-semibold">
          선적 연결 근거와 범위 확인
        </summary>
        {review.relationships?.map((r) => (
          <div
            key={r.id}
            className="mt-3 border-t border-slate-100 pt-3 text-xs leading-6"
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
                className="rounded border border-orange-200 px-3 py-2"
                onClick={() => onConfirmRelationship(r.id)}
              >
                동일 선적 사용자 확인 (잠정)
              </button>
            )}
            {r.evidence.map((f, i) => (
              <button
                key={i}
                onClick={() =>
                  onEvidence(f.field.current, "선적 연결 · " + f.fieldName)
                }
                className="mr-2 break-all text-blue-700"
              >
                {f.field.current.source?.fileName ?? "근거 없음"} ·{" "}
                {String(f.field.current.value)} ·{" "}
                {f.field.current.source?.page ?? "?"}페이지
              </button>
            ))}
          </div>
        ))}
      </details>
      <dialog
        ref={dialog}
        onCancel={() => setSelected(null)}
        onClose={() => setSelected(null)}
        aria-label="상세 분석 패널"
        className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-dvh w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white p-0 text-[#142744] shadow-xl backdrop:bg-slate-900/25"
      >
        {active && (
          <>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-5">
              <h3 className="text-base font-bold">{active.title}</h3>
              <button
                onClick={() => {
                  dialog.current?.close();
                  setSelected(null);
                }}
                className="rounded border px-3 py-2 text-xs"
              >
                상세 닫기
              </button>
            </div>
            <div className="p-5">
              <span
                className={`rounded px-2 py-1 text-xs ${color(active.assessment)}`}
              >
                {labels[active.assessment]}
              </span>
              {active.checks.map((c) => (
                <div
                  key={c.id}
                  className="mt-4 border-b border-slate-100 pb-4 text-xs leading-6"
                >
                  <strong>
                    {c.title} · {labels[c.assessment]}
                  </strong>
                  <p>{c.explanation}</p>
                  {!!c.uncertainties?.length && (
                    <ul className="my-2 text-orange-800">
                      {[...new Set(c.uncertainties)].map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  )}
                  <p>다음 확인: {c.followUp}</p>
                  {c.comparison && (
                    <>
                      <p>
                        판정 코드:{" "}
                        {c.comparison.reasonCodes.join(", ") || "VERIFIED"}
                      </p>
                      {c.comparison.facts.map((f) => (
                        <p key={f.id}>
                          범위 {f.scope} · {f.derivation} · 구성 근거{" "}
                          {f.componentKeys.length}개
                        </p>
                      ))}
                      <details>
                        <summary>
                          원본 검사 진단 {c.comparison.relatedCheckIds.length}건
                        </summary>
                        {review.checks
                          .filter((raw) =>
                            c.comparison!.relatedCheckIds.includes(raw.id),
                          )
                          .map((raw) => (
                            <p key={raw.id}>
                              {raw.title} · {labels[raw.assessment]} ·{" "}
                              {raw.explanation}
                            </p>
                          ))}
                      </details>
                    </>
                  )}

                  {c.computedValues?.map((v) => (
                    <p key={v.documentId}>
                      {v.formula === "single_row"
                        ? "검증된 단일 행 연결"
                        : "검증된 화물행 합산"}
                      : {v.value} {v.unit} · {v.componentKeys.length}개 행 (AI
                      원본 합계와 구분)
                    </p>
                  ))}
                </div>
              ))}
              <h4 className="mt-5 text-sm font-semibold">
                원문값 · 정규화 · 근거 위치
              </h4>
              {active.fields.map((f, i) => (
                <div
                  key={i}
                  className="mt-3 rounded-lg border border-slate-200 p-3"
                >
                  {source(active, f)}
                  <p className="mt-1 break-all text-[11px] text-slate-500">
                    {f.field.original.source?.fileName ?? f.documentId} ·{" "}
                    {f.field.original.source?.page ?? "?"}페이지 ·{" "}
                    {f.field.original.source?.segments
                      ?.map((s) => s.blockId)
                      .join(", ") ?? "블록 없음"}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    정규화:{" "}
                    {portCode(f.field.current.value) ??
                      (["shipper", "consignee"].includes(f.fieldName)
                        ? partyName32(f)?.name
                        : null) ??
                      (contextualCarton(f) ? "CTNS" : null) ??
                      (f.fieldName.endsWith("Unit")
                        ? unit32(
                            f.field.current.value,
                            f.fieldName === "packageUnit"
                              ? "packaging"
                              : f.fieldName === "quantityUnit"
                                ? "quantity"
                                : "weight",
                          )?.unit
                        : null) ??
                      "별도 변환 없음"}{" "}
                    · {f.field.current.reason}
                  </p>
                </div>
              ))}
              <p className="mt-5 text-xs text-slate-500">
                수정·복원 후 무료로 다시 계산합니다. 사용자 수정은 원문 검증
                성공과 구분합니다.
              </p>
              {onUpdate &&
                documents
                  .filter(
                    (d) =>
                      active.fields.some((f) => f.documentId === d.id) ||
                      active.checks.some((c) => c.documentIds?.includes(d.id)),
                  )
                  .map((d) => (
                    <ShippingFields
                      key={d.id}
                      document={d}
                      onUpdate={onUpdate}
                      onEvidence={onEvidence}
                    />
                  ))}
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}
