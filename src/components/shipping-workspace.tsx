"use client";
import Link from "next/link";
import { shippingValues } from "@/modules/shipping/fields";
import { useEffect, useRef, useState } from "react";
import {
  Anchor,
  ArrowRight,
  FileSearch,
  FileCheck2,
  ShieldCheck,
  Layers3,
  ChevronRight,
  LoaderCircle,
  Info,
  ScanText,
} from "lucide-react";
import { UploadSlotCard } from "./upload-slot";
import { ShippingFields } from "./shipping-fields";
import { EvidenceDialog } from "./evidence-dialog";
import {
  shippingTypes,
  shippingLabels,
  type ShippingType,
} from "@/modules/shipping/catalog";
import { validateUploads } from "@/modules/upload/validate";
import { safeError } from "@/modules/documents/errors";
import { summarizeShipping } from "@/modules/shipping/summary";
import type { ShippingResult } from "@/modules/shipping/prepare";
import { shippingDocumentSchema } from "@/modules/shipping/schema";
import type { GroundedField, PdfPage } from "@/modules/documents/schema";
const emptySlots = () =>
  ({
    house_bl: null,
    export_declaration: null,
    house_manifest: null,
  }) as Record<ShippingType, File | null>;
type Selection = {
  field: GroundedField<string | number>;
  label: string;
  page?: PdfPage;
  raw?: boolean;
};
export function ShippingWorkspace() {
  const [slots, setSlots] = useState(emptySlots);
  const [analysisMode, setAnalysisMode] = useState(true);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [consent, setConsent] = useState(false);
  const [results, setResults] = useState<ShippingResult[]>([]),
    [selection, setSelection] = useState<Selection | null>(null);
  const [tab, setTab] = useState<"upload" | "results">("upload");
  const abort = useRef<AbortController | null>(null),
    run = useRef(0);
  useEffect(() => () => abort.current?.abort(), []);
  const active = shippingTypes.filter((t) => slots[t]),
    files = active.map((t) => slots[t]!);
  const summary = summarizeShipping(results);
  const canPrepare = active.length >= 2 && consent && !busy;
  function invalidate() {
    setResults([]);
    setSelection(null);
    setError(null);
  }
  function select(slot: ShippingType, incoming: File[]) {
    if (busy || !incoming.length) return;
    if (incoming.length !== 1) {
      setError("각 업로드 영역에는 PDF 1개만 넣어 주세요.");
      return;
    }
    const next = { ...slots, [slot]: incoming[0] };
    try {
      validateUploads(Object.values(next).filter((f): f is File => f !== null));
      setSlots(next);
      invalidate();
    } catch (e) {
      setError(safeError(e).message);
    }
  }
  function reset() {
    run.current++;
    abort.current?.abort();
    setBusy(false);
    setSlots(emptySlots());
    invalidate();
    setConsent(false);
    setTab("upload");
  }
  async function prepare() {
    if (active.length < 2) {
      setError("서로 다른 종류의 서류를 최소 2개 선택해 주세요.");
      return;
    }
    if (!consent) {
      setError("자료 처리 및 외부 전송 권한 안내를 확인해 주세요.");
      return;
    }
    try {
      validateUploads(files);
    } catch (e) {
      setError(safeError(e).message);
      return;
    }
    const token = ++run.current,
      controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    invalidate();
    try {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      form.append("slots", JSON.stringify(active));
      form.append("operation", analysisMode ? "analyze" : "prepare");
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error?.message ?? "자료 준비 요청을 처리하지 못했습니다.",
        );
      if (
        !["pdf-preparation", "shipping-analysis"].includes(data.mode) ||
        !Array.isArray(data.results) ||
        data.results.length !== files.length
      )
        throw new Error(
          "현재 단계와 맞지 않는 분석 응답입니다. 새 선적서류 검증 결과로 사용하지 않았습니다.",
        );
      for (const result of data.results) {
        if (
          !shippingTypes.includes(result.uploadSlot) ||
          !result.pdf ||
          !Array.isArray(result.pdf.pages)
        )
          throw new Error("서버의 문서 응답 형식이 올바르지 않습니다.");
        if (result.document) shippingDocumentSchema.parse(result.document);
      }
      if (token !== run.current) return;
      setResults(data.results);
      setTab("results");
    } catch (e) {
      if (token === run.current)
        setError(
          e instanceof Error ? e.message : "서버에 연결하지 못했습니다.",
        );
    } finally {
      if (token === run.current) setBusy(false);
    }
  }
  function fixSlot(id: string, target: ShippingType) {
    const old = results.find((r) => r.pdf.id === id)?.uploadSlot;
    if (!old || old === target) return;
    setSlots((current) => ({
      ...current,
      [old]: current[target],
      [target]: current[old],
    }));
    setResults((current) =>
      current.map((r) => {
        const slot =
          r.pdf.id === id
            ? target
            : r.uploadSlot === target
              ? old
              : r.uploadSlot;
        return {
          ...r,
          originalUploadSlot: r.originalUploadSlot ?? r.uploadSlot,
          uploadSlot: slot,
          document: r.document ? { ...r.document, uploadType: slot } : null,
          typeMismatch:
            r.document?.classificationStatus === "classified"
              ? r.detectedType !== slot
              : null,
        };
      }),
    );
  }
  const pending = (
    <div
      role="status"
      className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-6 text-blue-900"
    >
      <Info size={17} className="mt-1 shrink-0" />
      <p>
        <strong>문서 분석과 서류 간 대조는 별도 단계입니다.</strong>
        <br />
        AI는 문서 분류·값·근거 후보를 추출하고, 코드가 실제 원문을 대조합니다.
        삼각대조는 아직 실행하지 않습니다. 사용자 수정값은 원문 검증 완료로
        표시하지 않습니다.
      </p>
    </div>
  );
  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-800">
      <header className="flex h-[72px] items-center justify-between border-b border-slate-200 bg-white px-5 md:px-9">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-[#142744]"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#152e51] text-white">
            <Anchor size={20} />
          </span>
          OceanRisk <span className="text-blue-600">AI</span>
        </Link>
        <span className="rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-700">
          신고 전 문서 분석
        </span>
      </header>
      <div className="mx-auto flex max-w-[1600px]">
        <aside className="sticky top-0 hidden h-[calc(100vh-72px)] w-56 shrink-0 flex-col border-r border-slate-200 bg-white p-5 lg:flex">
          <p className="mt-3 px-3 text-[10px] font-semibold tracking-widest text-slate-400">
            WORKSPACE
          </p>
          <button
            onClick={() => setTab("upload")}
            className={`mt-5 flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold ${tab === "upload" ? "bg-blue-50 text-blue-700" : "text-slate-500"}`}
          >
            <FileSearch size={18} />
            서류 업로드
          </button>
          <button
            disabled={!results.length}
            onClick={() => setTab("results")}
            className={`mt-2 flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold ${tab === "results" ? "bg-blue-50 text-blue-700" : "text-slate-500 disabled:text-slate-300"}`}
          >
            <FileCheck2 size={18} />
            문서 검토 결과
          </button>
          <div className="mt-auto rounded-xl border border-slate-100 bg-slate-50 p-4">
            <ShieldCheck size={20} className="text-blue-600" />
            <p className="mt-3 text-xs font-bold">근거를 먼저 확인합니다</p>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">
              서로 다른 출처의 원문과 연결관계를 신고 전에 점검하기 위한
              기반입니다.
            </p>
          </div>
          <p className="mt-5 text-[10px] text-slate-400">
            © 2026 OceanRisk AI
          </p>
        </aside>
        <main className="min-w-0 flex-1 px-5 pb-10 pt-7 md:px-9 lg:px-10">
          <div className="mb-6 flex items-center gap-2 text-[11px] text-slate-400">
            <Layers3 size={13} />
            워크스페이스
            <ChevronRight size={12} />
            <span className="text-slate-600">
              {tab === "upload" ? "서류 업로드" : "문서 검토 결과"}
            </span>
          </div>
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-[10px] font-bold tracking-[0.16em] text-blue-700">
                PRE-FILING DOCUMENT REVIEW
              </p>
              <h1 className="break-keep text-2xl font-bold tracking-tight text-[#142744] md:text-[28px]">
                {tab === "upload"
                  ? "적하목록 신고 전, 원문부터 정확하게."
                  : "원문을 확인하고, 대조를 준비하세요."}
              </h1>
              <p className="mt-2.5 text-sm leading-6 text-slate-500">
                중소 포워더를 위한 서로 다른 출처의 선적·신고 자료 검토
              </p>
            </div>
            <div className="flex gap-2 lg:hidden">
              <button
                onClick={() => setTab("upload")}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
              >
                업로드
              </button>
              <button
                disabled={!results.length}
                onClick={() => setTab("results")}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs disabled:opacity-40"
              >
                문서 검토 결과
              </button>
            </div>
          </div>
          {error && (
            <div
              role="alert"
              data-testid="upload-error"
              className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            >
              {error}
            </div>
          )}
          {tab === "upload" ? (
            <>
              <section className="relative mb-7 overflow-hidden rounded-2xl bg-[#152e51] p-6 text-white md:p-8">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-16 -top-12 size-72 rounded-full border-[35px] border-white/[0.035]"
                />
                <div className="relative flex flex-wrap justify-between gap-6">
                  <div>
                    <p className="mb-4 text-[10px] text-blue-100">
                      선적서류와 신고 예정자료, 한곳에서
                    </p>
                    <h2 className="text-xl font-semibold leading-relaxed md:text-2xl">
                      서로 다른 원본 자료를,
                      <br />
                      신고 전에 함께 검토하도록.
                    </h2>
                    <p className="mt-3 max-w-xl text-xs leading-6 text-blue-100/75">
                      House B/L · 수출신고필증 · House 적하목록
                      <br />
                      최소 2종의 PDF로 시작하고, 3종을 함께 올려 삼각대조 자료를
                      준비하세요.
                    </p>
                  </div>
                  <div className="self-center">
                    <p className="text-3xl font-light">
                      03<span className="ml-1 text-sm text-blue-200">종</span>
                    </p>
                    <p className="mt-2 text-[10px] text-blue-100/70">
                      준비 대상 문서
                    </p>
                  </div>
                </div>
              </section>
              {pending}
              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
                <div className="mb-6">
                  <h2 className="text-sm font-bold">검토할 선적서류 업로드</h2>
                  <p className="mt-2 text-xs leading-6 text-slate-500">
                    서류 종류는 사용자가 선택한 영역입니다. AI 판독 유형은 아직
                    분석 후 원문 제목과 독립적으로 확인합니다.
                  </p>
                </div>
                <div
                  data-testid="upload-slots"
                  className="grid gap-4 xl:grid-cols-3"
                >
                  {shippingTypes.map((slot) => (
                    <UploadSlotCard
                      key={slot}
                      slot={slot}
                      file={slots[slot]}
                      disabled={busy}
                      onSelect={(f) => select(slot, f)}
                      onRemove={() => {
                        setSlots((current) => ({ ...current, [slot]: null }));
                        invalidate();
                      }}
                    />
                  ))}
                </div>
                <p className="mt-4 text-[11px] leading-6 text-slate-500">
                  최소 2종 · 화면에서 최대 3개 · 파일당 4 MB / 30페이지 · 모든
                  파일 합계 4 MB 이내
                </p>
                <fieldset className="mt-5 flex flex-wrap gap-4 text-xs">
                  <legend className="mb-3 font-semibold">처리 방식</legend>
                  <label>
                    <input
                      type="radio"
                      name="processing"
                      checked={analysisMode}
                      disabled={busy}
                      onChange={() => setAnalysisMode(true)}
                    />{" "}
                    AI 문서 분석
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="processing"
                      checked={!analysisMode}
                      disabled={busy}
                      onChange={() => setAnalysisMode(false)}
                    />{" "}
                    PDF 원문만 확인
                  </label>
                </fieldset>
                <div className="mt-5 rounded-xl bg-slate-50 p-4 text-xs leading-6 text-slate-600">
                  <p>
                    기업 내부 자료의 사용·처리 및 외부 전송 권한을 확인해
                    주세요. AI 분석에서는 추출 텍스트·위치 정보가 외부 OpenAI
                    API로 전송됩니다. PDF 원문만 확인을 선택하면 OpenAI로
                    전송하지 않습니다.
                  </p>
                  <label className="mt-3 flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={consent}
                      disabled={busy}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-1.5"
                    />
                    자료 처리 및 외부 AI 전송 안내와 사용 권한을 확인했습니다.
                  </label>
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-500" aria-live="polite">
                    {active.length}종 선택 ·{" "}
                    {active.length < 2
                      ? "비교 자료 준비에 최소 2종이 필요합니다."
                      : active.length === 3
                        ? "삼각대조 자료 준비 가능"
                        : "두 문서 대조 자료 준비 가능"}
                  </p>
                  <button
                    onClick={prepare}
                    disabled={!canPrepare}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {busy ? (
                      <>
                        <LoaderCircle className="animate-spin" size={16} />
                        {analysisMode
                          ? "PDF 원문·AI 응답을 확인하는 중"
                          : "PDF 원문을 확인하는 중"}
                      </>
                    ) : (
                      <>
                        {analysisMode ? "서류 분석 시작" : "비교 자료 준비"}
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
                {busy && (
                  <p role="status" className="mt-4 text-xs text-blue-700">
                    PDF를 읽고 있습니다. AI 분석 선택 시 GPT-6 Luna 응답을
                    기다린 뒤 원문 근거를 대조합니다. 서류 간 삼각대조는
                    실행하지 않습니다.
                  </p>
                )}
              </section>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {[
                  "자료 선택",
                  "PDF 원문 확인",
                  "AI 추출·근거 검증 (삼각대조 미실시)",
                ].map((label, i) => (
                  <div
                    key={label}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <span className="text-[10px] font-bold text-blue-600">
                      0{i + 1}
                    </span>
                    <p className="mt-2 text-xs font-semibold">{label}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold">
                  {summary.failedDocuments === results.length
                    ? analysisMode
                      ? "문서 분석 실패"
                      : "자료 준비 실패"
                    : summary.failedDocuments ||
                        (analysisMode && summary.partialDocuments)
                      ? analysisMode
                        ? "문서 분석 일부 성공 · 확인 필요"
                        : "자료 준비 일부 완료"
                      : analysisMode
                        ? "문서별 분석 완료 · 삼각대조 미실시"
                        : "PDF 자료 준비 완료"}
                </h2>
                <button
                  onClick={reset}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"
                >
                  새 서류 검토
                </button>
              </div>
              <div className="mb-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">PDF 원문 준비 문서</p>
                  <p className="mt-2 text-2xl font-semibold">
                    {results.filter((r) => r.pdf.pages.length > 0).length}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    AI 분석 {summary.analyzedDocuments} · 부분{" "}
                    {summary.partialDocuments} · 실패 {summary.failedDocuments}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">대조 준비 상태</p>
                  <p className="mt-3 text-sm font-semibold">
                    {summary.comparisonReadiness === "ready_for_triangle"
                      ? "3종 삼각대조 자료 준비"
                      : summary.comparisonReadiness === "ready_for_pair"
                        ? "2종 대조 자료 준비"
                        : "대상 서류 부족"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">서류 간 삼각대조</p>
                  <p className="mt-3 text-sm font-semibold">분석 미실시</p>
                </div>
              </div>
              {pending}
              <div className="mt-6 space-y-5">
                {results.map((result) => (
                  <section
                    key={result.pdf.id}
                    data-testid="shipping-document"
                    className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 md:p-6"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="break-all text-sm font-bold">
                          {result.pdf.fileName}
                        </h3>
                        <p className="mt-2 text-[11px] text-slate-500">
                          선택 영역: {shippingLabels[result.uploadSlot].title} ·{" "}
                          {result.detectedType
                            ? `AI 분류: ${shippingLabels[result.detectedType].title}`
                            : result.document?.classificationStatus ===
                                "needs_review"
                              ? "AI 분류 미확인"
                              : "실제 분류 미실시"}{" "}
                          ·{" "}
                          {result.document?.classificationStatus ===
                          "needs_review"
                            ? "분류 불확실 · "
                            : ""}
                          {result.pdf.pages.length}페이지
                          {result.originalUploadSlot &&
                            result.originalUploadSlot !== result.uploadSlot &&
                            ` · 최초 선택: ${shippingLabels[result.originalUploadSlot].title}`}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-600">
                        {result.error
                          ? result.pdf.pages.length
                            ? "AI 분석 실패 · PDF 보존"
                            : "PDF 판독 실패"
                          : result.document?.extractionStatus ===
                              "not_performed"
                            ? "PDF 원문 준비 완료"
                            : result.document &&
                                shippingValues(result.document).some(
                                  (f) => f.current.status === "user_edited",
                                )
                              ? "사용자 수정 · 원문 근거 상태 유지"
                              : result.document?.extractionStatus === "partial"
                                ? "분석 일부 성공 · 근거 확인 필요"
                                : "문서 분석·원문 근거 검증 완료"}
                      </span>
                    </div>
                    {result.error && (
                      <div
                        role="alert"
                        className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-xs leading-6 text-red-800"
                      >
                        {result.error.message}
                        <p>오류 코드: {result.error.code}</p>
                      </div>
                    )}
                    {result.typeMismatch && (
                      <div
                        role="alert"
                        className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900"
                      >
                        문서 유형 불일치: 선택 영역과 원문에서 확인된 AI 분류가
                        다릅니다. 실제 분류의 필드를 표시했습니다. 파일을
                        교체하거나 영역을 수정해 주세요.
                        <button
                          className="ml-2 underline"
                          onClick={() =>
                            fixSlot(result.pdf.id, result.detectedType!)
                          }
                        >
                          분류된 유형으로 영역 변경 (기존 파일과 교환)
                        </button>
                      </div>
                    )}
                    {result.document?.classificationStatus ===
                      "needs_review" && (
                      <p
                        role="status"
                        className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900"
                      >
                        분류 불확실: 원문 제목 근거가 충분하지 않습니다. 선택
                        영역을 실제 유형으로 간주하지 않았습니다.
                      </p>
                    )}
                    {result.document && (
                      <ShippingFields
                        document={result.document}
                        onUpdate={(doc) => {
                          setResults((current) =>
                            current.map((r) =>
                              r.pdf.id === result.pdf.id
                                ? { ...r, document: doc }
                                : r,
                            ),
                          );
                          setSelection(null);
                        }}
                        onEvidence={(field, label) =>
                          setSelection({
                            field,
                            label,
                            page: result.pdf.pages.find(
                              (p) => p.page === field.source?.page,
                            ),
                          })
                        }
                      />
                    )}
                    {!!result.pdf.pages.length && (
                      <details className="mt-5 rounded-xl border border-slate-200 p-4">
                        <summary className="cursor-pointer text-xs font-semibold">
                          페이지별 PDF 원문 보기
                        </summary>
                        {result.pdf.pages.map((page) => (
                          <div key={page.page} className="mt-5">
                            <p className="text-[10px] font-bold text-blue-700">
                              PAGE {page.page}
                            </p>
                            <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-4 font-mono text-xs leading-6">
                              {page.text}
                            </pre>
                            <details className="mt-3">
                              <summary className="cursor-pointer text-[11px] text-slate-500">
                                실제 텍스트 블록·위치 보기
                              </summary>
                              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                {page.blocks?.slice(0, 100).map((block) => (
                                  <button
                                    key={block.id}
                                    onClick={() =>
                                      setSelection({
                                        raw: true,
                                        page,
                                        label: "PDF 원문 블록",
                                        field: {
                                          value: block.text.slice(0, 300),
                                          status: "unverified",
                                          reason:
                                            "실제 PDF에서 추출한 블록입니다. 필드 역할·문서 대응·수량 검증은 아직 실행하지 않았습니다.",
                                          source: {
                                            fileId: result.pdf.id,
                                            fileName: result.pdf.fileName,
                                            page: page.page,
                                            quote: block.text.slice(0, 800),
                                            blocks: [block],
                                            segments: [
                                              {
                                                blockId: block.id,
                                                quote: block.text.slice(0, 800),
                                              },
                                            ],
                                          },
                                        },
                                      })
                                    }
                                    className="flex min-w-0 items-start gap-2 rounded-lg border border-slate-200 p-2 text-left text-[11px]"
                                  >
                                    <ScanText
                                      size={12}
                                      className="mt-1 shrink-0 text-blue-600"
                                    />
                                    <span className="break-all">
                                      {block.text}
                                    </span>
                                  </button>
                                ))}
                              </div>
                              {(page.blocks?.length ?? 0) > 100 && (
                                <p className="mt-3 text-[10px] text-slate-500">
                                  블록 버튼은 처음 100개입니다. 위의 페이지
                                  원문에는 전체 추출 텍스트를 표시합니다.
                                </p>
                              )}
                            </details>
                          </div>
                        ))}
                      </details>
                    )}
                  </section>
                ))}
              </div>
            </>
          )}
          <footer className="mt-8 border-t border-slate-200 pt-5 text-[11px] leading-6 text-slate-500">
            OceanRisk AI는 신고 전 검토를 지원하는 보조 도구입니다. 세관 신고를
            직접 수행하거나 과태료 예방을 보장하지 않습니다. 관세청·EDI·외부
            업무시스템 및 온프레미스 연동은 제공하지 않습니다.
          </footer>
        </main>
      </div>
      {selection && (
        <EvidenceDialog
          selection={selection}
          page={selection.page}
          pageText={selection.page?.text}
          candidateLabel={
            selection.raw
              ? "PDF에서 실제 추출한 블록 (필드 의미 검증 미실시)"
              : undefined
          }
          onClose={() => setSelection(null)}
        />
      )}
    </div>
  );
}
