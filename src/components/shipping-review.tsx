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
import { unit32 } from "@/modules/shipping/review-evidence";
import { ShippingFields } from "./shipping-fields";
import type { GroundedField } from "@/modules/documents/schema";
const labels: Record<ShippingAssessment, string> = {
  ...assessmentLabels,
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
  const [filter, setFilter] = useState("all"),
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
  const active = groups.find((g) => g.id === selected);
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
            c.assessment !== "insufficient_information" &&
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
        {displayed ?? String(f.field.current.value ?? "정보 없음")}
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
    const owner = (f: ComparisonGroup["fields"][number]) =>
      [f.documentId, f.itemId ?? f.cargoId ?? f.containerId ?? "document"].join(
        "/",
      );
    const unique = fs.filter(
      (f, i) =>
        fs.findIndex(
          (v) =>
            owner(v) === owner(f) &&
            v.fieldName === f.fieldName &&
            v.field.current.status === f.field.current.status &&
            v.field.current.value === f.field.current.value,
        ) === i,
    );
    const paired = new Set<ComparisonGroup["fields"][number]>();
    const values = unique.map((f) => {
      const unitKey =
        f.fieldName === "packageCount" ? "packageUnit" : f.fieldName + "Unit";
      const unit =
        typeof f.field.current.value === "number" &&
        f.field.current.status === "verified"
          ? unique.find(
              (v) =>
                owner(v) === owner(f) &&
                (v.fieldName === unitKey ||
                  (f.containerId && v.fieldName === "weightUnit")) &&
                v.field.current.status === "verified",
            )
          : undefined;
      if (unit) paired.add(unit);
      return {
        field: f,
        text: unit
          ? `${f.field.current.value} ${unit.field.current.value}`
          : undefined,
      };
    });
    return values.filter((v) => !paired.has(v.field));
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
        {review.outcomes && (
          <p className="mt-2 text-xs text-slate-500">
            독립 판정 {review.outcomes.independentChecks} · 대조 대상 없음{" "}
            {review.outcomes.notApplicable} · 원문 검증 실패{" "}
            {review.outcomes.evidenceFailed} (원본 검사 진단은 상세에 보존)
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
              ? "일치·정보 부족 포함 전체 보기"
              : "확인할 항목만 보기"}
          </button>
        </div>
      </div>
      <p className="px-4 pb-2 text-[11px] text-slate-500 md:hidden">
        비교표를 좌우로 밀어 다른 서류와 판정을 확인하세요. 항목을 누르면 상세가
        열립니다.
      </p>
      <div
        className="max-w-full overflow-x-auto"
        role="region"
        aria-label="문서 비교표 스크롤"
        tabIndex={0}
      >
        <table className="w-full min-w-[700px] table-fixed text-left text-xs">
          <caption className="sr-only">
            선적서류 비교표. 같은 종류의 복수 문서는 파일명을 함께 표시합니다.
          </caption>
          <thead className="border-b border-slate-200 bg-slate-50">
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
          <tbody>
            {visible.map((g) => (
              <tr
                key={g.id}
                data-testid="comparison-row"
                className="border-b border-slate-100 align-top hover:bg-slate-50/70"
              >
                <th className="sticky left-0 z-[1] break-words bg-white p-3 font-semibold">
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
                  <td key={t} className="p-3">
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
                            {
                              documents.find((d) => d.id === f.documentId)
                                ?.fileName
                            }{" "}
                            · p.{f.field.current.source?.page ?? "?"}
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
                <td className="p-3">
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
                          raw.assessment !== "insufficient_information");
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
                  .filter((d) =>
                    active.fields.some((f) => f.documentId === d.id),
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
