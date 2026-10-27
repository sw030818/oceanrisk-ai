"use client";
import Link from "next/link";
import { shippingValues } from "@/modules/shipping/fields";
import { useEffect, useRef, useState, useMemo } from "react";
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
import {
  ShippingUploadCard,
  type UploadProgress,
} from "./shipping-upload-card";
import {
  shippingBatches,
  mergeShippingResults,
  failedShippingUpload,
  type ShippingUpload,
} from "@/modules/shipping/batches";
import { semanticWireSchema, type SemanticReport } from "@/modules/shipping/semantic-schema";
import { semanticContext } from "@/modules/shipping/semantic-context";
import { reviewShipping } from "@/modules/shipping/review";
import { ShippingReviewPanel } from "./shipping-review";
import { ShippingReport } from "./shipping-report";
import { ShippingFields } from "./shipping-fields";
import { EvidenceDialog } from "./evidence-dialog";
import {
  shippingTypes,
  shippingLabels,
  type ShippingType,
} from "@/modules/shipping/catalog";

import { safeError } from "@/modules/documents/errors";
import { summarizeShipping } from "@/modules/shipping/summary";
import {
  displayTitle,
  issueSummary,
  issueValues,
} from "@/modules/shipping/display-titles";
import type { ShippingResult } from "@/modules/shipping/prepare";
import { shippingDocumentSchema } from "@/modules/shipping/schema";
import type { GroundedField, PdfPage } from "@/modules/documents/schema";
const emptySlots = (): Record<ShippingType, File[]> => ({
  house_bl: [],
  export_declaration: [],
  house_manifest: [],
});
type Selection = {
  field: GroundedField<string | number>;
  label: string;
  page?: PdfPage;
  raw?: boolean;
};
export function ShippingWorkspace() {
  const [slots, setSlots] = useState(emptySlots);
  const [identities, setIdentities] = useState(
    new Map<File, { id: string; url: string }>(),
  );
  const urls = useRef(new Set<string>());
  function idFor(file: File) {
    return identities.get(file)?.id ?? "";
  }
  const urlById = new Map([...identities.values()].map((m) => [m.id, m.url]));
  const [progress, setProgress] = useState<Record<string, UploadProgress>>({});
  const [reusedDocuments, setReusedDocuments] = useState(0);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [semantic, setSemantic] = useState<SemanticReport | undefined>();
  const [resultAnalysis, setResultAnalysis] = useState(false);
  const [comparisonEnabled, setComparisonEnabled] = useState(false);
  const [confirmedRelationships, setConfirmedRelationships] = useState<
    string[]
  >([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [consent, setConsent] = useState(false);
  const [results, setResults] = useState<ShippingResult[]>([]),
    [selection, setSelection] = useState<Selection | null>(null);
  const [tab, setTab] = useState<"upload" | "results">("upload");
  useEffect(() => {
    if (tab === "results") window.scrollTo({ top: 0, behavior: "instant" });
  }, [tab]);
  const abort = useRef<AbortController | null>(null),
    run = useRef(0);
  useEffect(
    () => () => {
      abort.current?.abort();
      urls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  const entries: ShippingUpload[] = shippingTypes.flatMap((slot) =>
    slots[slot].map((file) => ({ id: idFor(file), file, slot })),
  );
  const selectedTypes = new Set(entries.map((e) => e.slot)).size;
  const summary = summarizeShipping(results);
  const review = useMemo(
    () =>
      comparisonEnabled
        ? reviewShipping(
            results.flatMap((r) => (r.document ? [r.document] : [])),
            { confirmedRelationships, semantic },
          )
        : { status: "not_performed" as const, checks: [] },
    [results, comparisonEnabled, confirmedRelationships, semantic],
  );
  const canPrepare = entries.length > 0 && consent && !busy;
  function invalidate(retained?: Set<string>) {
    setSemantic(undefined);
    setResults((current) =>
      retained ? current.filter((r) => retained.has(r.pdf.id)) : [],
    );
    if (!retained) setComparisonEnabled(false);
    setConfirmedRelationships([]);
    setSelection(null);
    setError(null);
    setProgress((p) =>
      retained
        ? Object.fromEntries(
            Object.entries(p).filter(([id]) => retained.has(id)),
          )
        : {},
    );
  }
  function commitSlots(next: Record<ShippingType, File[]>) {
    const all = shippingTypes.flatMap((slot) =>
      next[slot].map((file) => ({
        file,
        slot,
        id: identities.get(file)?.id ?? crypto.randomUUID(),
      })),
    );
    shippingBatches(all);
    const meta = new Map<File, { id: string; url: string }>();
    for (const e of all) {
      const prior = identities.get(e.file);
      const url = prior?.url ?? URL.createObjectURL(e.file);
      urls.current.add(url);
      meta.set(e.file, { id: e.id, url });
    }
    for (const [file, m] of identities)
      if (!meta.has(file)) {
        URL.revokeObjectURL(m.url);
        urls.current.delete(m.url);
      }
    setIdentities(meta);
    setSlots(next);
    invalidate(new Set(all.map((e) => e.id)));
  }
  function select(slot: ShippingType, incoming: File[]) {
    if (busy || !incoming.length) return;
    const added = incoming.map(
      (f) =>
        new File([f], f.name, { type: f.type, lastModified: f.lastModified }),
    );
    try {
      commitSlots({ ...slots, [slot]: [...slots[slot], ...added] });
    } catch (e) {
      setError(safeError(e).message);
    }
  }
  // Synthetic sample transactions (no real company data) let a visitor try
  // the flow without their own documents. Loading never starts AI analysis.
  async function loadSample(kind: "normal" | "mismatch") {
    if (busy) return;
    try {
      const names: Record<ShippingType, string> = {
        house_bl: "house-bl",
        export_declaration: "export-declaration",
        house_manifest: "house-manifest",
      };
      const label = kind === "normal" ? "예시-정상" : "예시-오류포함";
      const loaded = await Promise.all(
        shippingTypes.map(async (slot) => {
          const res = await fetch(`/samples/${kind}/${names[slot]}.pdf`);
          if (!res.ok) throw new Error("예시 서류를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
          const blob = await res.blob();
          return [slot, [new File([blob], `${label}-${names[slot]}.pdf`, { type: "application/pdf", lastModified: 0 })]] as [ShippingType, File[]];
        }),
      );
      setError(null);
      commitSlots({ ...emptySlots(), ...Object.fromEntries(loaded) });
    } catch (e) {
      setError(safeError(e).message);
    }
  }
  // Pre-stored synthetic ZIPs (B/L, 수출신고필증, 혼재화물적하목록). Nothing is
  // generated at click time; one stored set is picked at random.
  function downloadSample(kind: "same" | "mixed") {
    const count = kind === "same" ? 7 : 3;
    const name = `oceanrisk-${kind === "same" ? "same-shipment" : "mixed-shipments"}-${1 + Math.floor(Math.random() * count)}.zip`;
    const a = document.createElement("a");
    a.href = `/samples/downloads/${name}`;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  function remove(slot: ShippingType, id: string) {
    const next = {
      ...slots,
      [slot]: slots[slot].filter((f) => idFor(f) !== id),
    };
    if (Object.values(next).every((fs) => !fs.length)) {
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      urls.current.clear();
      setIdentities(new Map());
      setSlots(next);
      invalidate();
      return;
    }
    commitSlots(next);
  }
  function replace(slot: ShippingType, id: string, file: File) {
    try {
      commitSlots({
        ...slots,
        [slot]: slots[slot].map((f) => (idFor(f) === id ? file : f)),
      });
    } catch (e) {
      setError(safeError(e).message);
    }
  }
  function reset() {
    urls.current.forEach((url) => URL.revokeObjectURL(url));
    urls.current.clear();
    run.current++;
    abort.current?.abort();
    setBusy(false);
    setSlots(emptySlots());
    setIdentities(new Map());
    invalidate();
    setConsent(false);
    setTab("upload");
  }
  async function prepare(analyze = true) {
    if (!consent) {
      setError("자료 처리 및 외부 전송 권한 안내를 확인해 주세요.");
      return;
    }
    const cached = analyze
      ? results.filter(
          (r) =>
            entries.some((e) => e.id === r.pdf.id) &&
            !r.error &&
            r.document &&
            r.document.extractionStatus !== "not_performed",
        )
      : [];
    const pendingEntries = entries.filter(
      (e) => !cached.some((r) => r.pdf.id === e.id),
    );
    setReusedDocuments(cached.length);
    if (!pendingEntries.length) {
      setResultAnalysis(analyze);
      setTab("results");
      return;
    }
    let batches: ShippingUpload[][];
    try {
      batches = shippingBatches(pendingEntries);
    } catch (e) {
      setError(safeError(e).message);
      return;
    }
    const token = ++run.current,
      controller = new AbortController();
    abort.current = controller;
    invalidate();
    setBusy(true);
    setResultAnalysis(analyze);
    setBatchProgress({ current: 0, total: batches.length });
    let merged: ShippingResult[] = cached;
    setResults(cached);
    let stopAI = false;
    try {
      for (const [index, batch] of batches.entries()) {
        if (token !== run.current || controller.signal.aborted) break;
        setBatchProgress({ current: index + 1, total: batches.length });
        setProgress((p) => ({
          ...p,
          ...Object.fromEntries(
            batch.map((e) => [e.id, { state: "processing" }]),
          ),
        }));
        let incoming: ShippingResult[];
        if (stopAI)
          incoming = batch.map((e) =>
            failedShippingUpload(
              e,
              "BATCH_STOPPED",
              "앞선 API 이용 한도 또는 인증 오류로 추가 AI 호출을 중단했습니다. PDF 원문만 보기를 사용할 수 있습니다.",
            ),
          );
        else
          try {
            const form = new FormData();
            batch.forEach((e) => form.append("files", e.file));
            form.append("slots", JSON.stringify(batch.map((e) => e.slot)));
            form.append("documentIds", JSON.stringify(batch.map((e) => e.id)));
            form.append("operation", analyze ? "analyze" : "prepare");
            form.append("ocr", analyze ? "auto" : "off");
            const response = await fetch("/api/analyze", {
              method: "POST",
              body: form,
              signal: controller.signal,
            });
            const data = await response.json();
            if (!response.ok)
              throw new Error(
                data.error?.message ?? "이번 배치를 처리하지 못했습니다.",
              );
            if (
              !["pdf-preparation", "shipping-analysis"].includes(data.mode) ||
              !Array.isArray(data.results) ||
              data.results.length !== batch.length
            )
              throw new Error("분석 응답 형식이 올바르지 않습니다.");
            incoming = data.results.map((r: ShippingResult, i: number) => {
              if (
                !shippingTypes.includes(r.uploadSlot) ||
                !r.pdf ||
                !Array.isArray(r.pdf.pages)
              )
                throw new Error("문서 응답 형식이 올바르지 않습니다.");
              // Older mocked contracts have server-generated IDs; retain their source
              // identity. PHASE3.3 responses must echo each stable upload ID.
              if (
                ["3.3", "3.4", "3.5", "3.6", "3.7", "3.8"].includes(data.phase) &&
                r.pdf.id !== batch[i].id
              )
                throw new Error("문서 식별자가 요청과 다릅니다.");
              if (r.document) shippingDocumentSchema.parse(r.document);
              return r;
            });
            if (analyze)
              setComparisonEnabled(
                data.capabilities?.pairComparison === true &&
                  ["3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8"].includes(
                    data.phase,
                  ),
              );
            stopAI =
              ["3.3", "3.4", "3.5", "3.6", "3.7", "3.8"].includes(data.phase) &&
              incoming.some(
                (r) =>
                  r.error &&
                  [
                    "API_AUTH_OR_CONFIG",
                    "API_RATE_LIMIT",
                    "INVALID_MODEL",
                    "API_NOT_CONFIGURED",
                    "BATCH_STOPPED",
                  ].includes(r.error.code),
              );
          } catch (e) {
            if (controller.signal.aborted) break;
            incoming = batch.map((entry) =>
              failedShippingUpload(
                entry,
                "BATCH_REQUEST_FAILED",
                e instanceof Error ? e.message : "배치 연결에 실패했습니다.",
              ),
            );
          }
        if (token !== run.current) return;
        incoming.forEach((r, i) => {
          if (r.error?.code === "BATCH_DEFERRED") batches.push([batch[i]]);
        });
        merged = mergeShippingResults(merged, incoming);
        setResults(merged);
        setProgress((p) => ({
          ...p,
          ...Object.fromEntries(
            batch.map((e, i) => [
              e.id,
              {
                state:
                  incoming[i].error?.code === "BATCH_DEFERRED"
                    ? "waiting"
                    : incoming[i].error
                      ? "failed"
                      : incoming[i].document?.extractionStatus === "partial"
                        ? "partial"
                        : "complete",
                error:
                  incoming[i].error?.code === "BATCH_DEFERRED"
                    ? undefined
                    : incoming[i].error?.message,
              },
            ]),
          ),
        }));
      }
      if (analyze && !stopAI && !controller.signal.aborted && token === run.current) {
        const documents = merged.flatMap(r=>!r.error&&r.document&&r.document.extractionStatus!=="not_performed"?[r.document]:[]), context = semanticContext(documents);
        // One request after ALL upload batches. Mock/legacy/prepare results have
        // no server receipt and can never accidentally trigger a paid stage.
        const snapshots = merged.flatMap(r=>r.semanticSnapshot?[r.semanticSnapshot]:[]);
        if (context.pairs.length && snapshots.length === documents.length) {
          try {
            const response = await fetch("/api/semantic",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({snapshots}),signal:controller.signal});
            const data = await response.json();
            if(!response.ok)throw new Error(data.error?.message??"상품 의미 분석을 완료하지 못했습니다.");
            if(!data.semantic || !["complete","partial","failed","not_needed"].includes(data.semantic.status) || typeof data.semantic.inputKey!=="string" || !semanticWireSchema.safeParse(data.semantic.decisions).success)throw new Error("상품 의미 분석 응답 형식을 확인하지 못했습니다.");
            if(token === run.current)setSemantic(data.semantic);
          } catch(e) {
            if(token === run.current)setSemantic({status:"failed",inputKey:context.key,decisions:{pairs:[]},requestedPairs:context.pairs.length,omittedPairs:context.omittedPairs,error:{code:"SEMANTIC_FAILED",message:e instanceof Error?e.message:"상품 의미 분석 실패"}});
          }
        }
      }
      if (token === run.current) {
        setTab("results");
        if (controller.signal.aborted)
          setError(
            "분석을 중단했습니다. 완료된 다른 문서 결과는 보존했습니다.",
          );
      }
    } finally {
      if (token === run.current) setBusy(false);
    }
  }
  function fixSlot(id: string, target: ShippingType) {
    const old = results.find((r) => r.pdf.id === id)?.uploadSlot;
    if (!old || old === target) return;
    const file = slots[old].find((f) => idFor(f) === id);
    if (file)
      setSlots((current) => ({
        ...current,
        [old]: current[old].filter((f) => idFor(f) !== id),
        [target]: [...current[target], file],
      }));
    setResults((current) =>
      current.map((r) =>
        r.pdf.id === id
          ? {
              ...r,
              originalUploadSlot: r.originalUploadSlot ?? r.uploadSlot,
              uploadSlot: target,
              document: r.document
                ? { ...r.document, uploadType: target }
                : null,
              typeMismatch: false,
            }
          : r,
      ),
    );
  }
  const pending = (
    <div
      role="status"
      className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-6 text-blue-900"
    >
      <Info size={17} className="mt-1 shrink-0" />
      <p>
        <strong>AI가 읽은 값을 그대로 믿지 않습니다.</strong>
        <br />
        AI가 서류 종류와 값을 읽으면, 프로그램이 각 값이 PDF 원문의 어느
        위치에 있는지 다시 확인합니다. 원문에서 확인된 값만 서류끼리 비교하고,
        확인하지 못한 값이나 사용자가 고친 값은 &lsquo;확정&rsquo;으로 판정하지
        않습니다. 서류 간 대조는 분석 후 같은 거래로 연결된 서류가 있을 때만
        실행합니다.
      </p>
    </div>
  );
  const issues = review.issues ?? [];
  const mismatchIssues = issues.filter(
    (i) => i.assessment === "confirmed_mismatch",
  );
  const otherIssues = issues.filter(
    (i) => i.assessment !== "confirmed_mismatch",
  );
  const reviewed = comparisonEnabled && review.status !== "not_performed";
  // Never let issue grouping hide a confirmed mismatch count.
  const mismatchCount =
    mismatchIssues.length || (review.outcomes?.mismatches ?? 0);
  const comparisonUnverified =
    review.outcomes?.comparisonEvidenceUnverified ?? 0;
  const unusedUnverified =
    comparisonUnverified === 0
      ? (review.outcomes?.evidenceUnverified ?? 0)
      : 0;
  const heading =
    summary.failedDocuments === results.length
      ? resultAnalysis
        ? "문서 분석 실패"
        : "자료 준비 실패"
      : summary.failedDocuments
        ? resultAnalysis
          ? "문서 분석 일부 성공 · 확인 필요"
          : "자료 준비 일부 완료"
        : !resultAnalysis
          ? "PDF 자료 준비 완료"
          : reviewed && review.issues
            ? mismatchCount
              ? `확정 불일치 ${mismatchCount}건 · 제출 전 확인 필요`
              : otherIssues.length
                ? `확인 필요 ${otherIssues.length}건 · 확정된 불일치 없음`
                : comparisonUnverified
                  ? "서류 대조 완료 · 원문 미확인 값 검토 필요"
                  : "서류 대조 완료 · 확인할 문제 없음"
            : summary.partialDocuments
              ? "문서 분석 일부 성공 · 확인 필요"
              : comparisonEnabled
                ? "문서별 분석·서류 대조 완료"
                : "문서별 분석 완료 · 삼각대조 미실시";
  const documents = results.flatMap((r) => (r.document ? [r.document] : []));
  const labelOrder = shippingTypes.map((t) => shippingLabels[t].title);
  const documentLabel = (id: string) => {
    const d = documents.find((v) => v.id === id);
    if (!d) return id;
    const type = d.detectedType ?? d.uploadType;
    return documents.filter((v) => (v.detectedType ?? v.uploadType) === type).length > 1
      ? `${shippingLabels[type].title}(${d.fileName})`
      : shippingLabels[type].title;
  };
  const singleMismatchValues =
    mismatchIssues.length === 1
      ? issueValues(mismatchIssues[0], documentLabel, labelOrder)
      : null;
  const failedNames = [
    ...new Set(
      results.filter((r) => r.error).map((r) => shippingLabels[r.uploadSlot].title),
    ),
  ];
  const failurePrefix =
    resultAnalysis &&
    summary.failedDocuments &&
    summary.failedDocuments < results.length
      ? `${failedNames.join(" · ")} 파일 ${summary.failedDocuments}개의 AI 분석이 실패해 비교에서 빠졌습니다. 서류 업로드 화면에서 분석을 다시 시작하면 실패한 파일만 다시 분석합니다. `
      : "";
  const verdictBody = !resultAnalysis
    ? "PDF에서 글자와 위치만 준비했습니다. AI 판독과 서류 대조는 실행하지 않았습니다."
    : summary.failedDocuments === results.length
      ? "모든 파일의 AI 분석이 실패했습니다. 아래 파일별 오류를 확인해 주세요."
      : reviewed && review.issues
        ? mismatchCount
          ? singleMismatchValues
            ? `${displayTitle(mismatchIssues[0].title)} — ${singleMismatchValues}. 원문 근거로 확인된 차이입니다. 적하목록 제출 전에 원본 서류를 확인해 주세요.`
            : `${issueSummary(mismatchIssues) || "일부 항목"}: 원문 근거로 서류 간 값이 다르게 확인됐습니다. 적하목록 제출 전에 원본 서류를 확인해 주세요.`
          : otherIssues.length
            ? `원문 근거로 확정된 차이는 없습니다. ${issueSummary(otherIssues)} 항목은 근거가 부족하거나 범위가 불분명해 사람이 확인해야 합니다.`
            : comparisonUnverified
              ? "확정된 차이는 없지만, 비교에 쓰인 값 중 원문에서 위치를 확인하지 못한 값이 있습니다."
              : `원문 근거로 확인한 ${review.outcomes?.matches ?? review.summary?.matches ?? 0}개 검사가 모두 일치합니다.${unusedUnverified ? ` AI가 읽었지만 원문에서 위치를 확인하지 못한 값 ${unusedUnverified}개는 비교에 쓰지 않았습니다.` : ""}`
        : comparisonEnabled
          ? "서류 간 대조를 실행하지 못했습니다. 같은 거래로 연결할 근거가 부족하거나 대조할 서류가 부족합니다."
          : "서류별 판독만 실행했습니다. 서류끼리 비교하려면 서로 다른 서류를 2종 이상 올려 주세요.";
  const verdict = failurePrefix + verdictBody;
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
                  : "서류 검토 결과"}
              </h1>
              <p className="mt-2.5 text-sm leading-6 text-slate-500">
                {tab === "upload"
                  ? "House B/L · 수출신고필증 · House 적하목록의 값이 서로 맞는지 신고 전에 확인합니다."
                  : "결론을 먼저 보고, 문제 항목은 원문 위치로 바로 확인하세요."}
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
                      House B/L · 수출신고필증 · House 적하목록
                    </p>
                    <h2 className="text-xl font-semibold leading-relaxed md:text-2xl">
                      세 서류의 값이 서로 맞는지,
                      <br />
                      적하목록 제출 전에 확인하세요.
                    </h2>
                    <p className="mt-3 max-w-xl text-xs leading-6 text-blue-100/75">
                      PDF를 올리면 AI가 값을 읽고, 원문 위치를 확인한 값만
                      서류끼리 비교합니다.
                      <br />
                      서류마다 여러 PDF를 올릴 수 있습니다.
                    </p>
                  </div>
                  <div className="self-center">
                    <p className="text-3xl font-light">
                      03<span className="ml-1 text-sm text-blue-200">종</span>
                    </p>
                    <p className="mt-2 text-[10px] text-blue-100/70">
                      교차 검토 서류
                    </p>
                  </div>
                </div>
              </section>
              {pending}
              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
                <div className="mb-6">
                  <h2 className="text-sm font-bold">서류를 종류별 칸에 올려 주세요</h2>
                  <p className="mt-2 text-xs leading-6 text-slate-500">
                    다른 칸에 잘못 올려도 분석 후 문서 제목으로 실제 종류를
                    확인해 알려 드립니다.
                  </p>
                  <div
                    data-testid="sample-loader"
                    className="mt-3 flex flex-wrap items-center gap-2 text-xs"
                  >
                    <span className="text-slate-500">서류가 없다면 예시 서류로 체험하기:</span>
                    <button
                      type="button"
                      onClick={() => loadSample("normal")}
                      disabled={busy}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      정상 거래
                    </button>
                    <button
                      type="button"
                      onClick={() => loadSample("mismatch")}
                      disabled={busy}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      오류 포함 거래
                    </button>
                    <span className="text-[11px] text-slate-400">
                      가상의 회사·화물로 만든 합성 서류입니다.
                    </span>
                  </div>
                  <div
                    data-testid="sample-download"
                    className="mt-2 flex flex-wrap items-center gap-2 text-xs"
                  >
                    <span className="text-slate-500">샘플 PDF 내려받기 (ZIP, 3장):</span>
                    <button
                      type="button"
                      onClick={() => downloadSample("same")}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                    >
                      같은 거래 서류 3장
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadSample("mixed")}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                    >
                      서로 다른 거래 서류 3장
                    </button>
                    <span className="text-[11px] text-slate-400">
                      미리 준비한 합성 세트 중 하나를 무작위로 내려받습니다.
                    </span>
                  </div>
                </div>
                <div
                  data-testid="upload-slots"
                  className="grid gap-4 xl:grid-cols-3"
                >
                  {shippingTypes.map((slot) => (
                    <ShippingUploadCard
                      key={slot}
                      slot={slot}
                      files={slots[slot]}
                      idFor={idFor}
                      progress={progress}
                      disabled={busy}
                      onSelect={(f) => select(slot, f)}
                      onRemove={(id) => remove(slot, id)}
                      onReplace={(id, file) => replace(slot, id, file)}
                    />
                  ))}
                </div>
                <p className="mt-4 text-[11px] leading-6 text-slate-500">
                  {entries.length}개 파일 · {selectedTypes}종 선택 (최대 24개 ·
                  합계 64 MB · 파일당 4 MB · 30페이지)
                  <br />
                  서로 다른 서류가 2종 이상이고 같은 거래로 확인되면 서류끼리
                  비교합니다. 한 종류만 올리면 서류별 판독만 합니다.
                </p>
                <div className="mt-5 rounded-xl bg-slate-50 p-4 text-xs leading-6 text-slate-600">
                  <p>
                    AI 분석을 위해 PDF에서 읽은 글자와 위치 정보를 OpenAI로
                    보냅니다. 글자가 없는 스캔 페이지는 해당 페이지 이미지가
                    전송될 수 있습니다. 원본 PDF는 브라우저에서만 열고 서버에
                    보관하지 않습니다. &lsquo;PDF 원문만 보기&rsquo;는 OpenAI를
                    사용하지 않습니다. 회사·공공 자료는 처리 권한이 있는지 먼저
                    확인해 주세요.
                  </p>
                  <label className="mt-3 flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={consent}
                      disabled={busy}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-1.5"
                    />
                    서류를 처리할 권한이 있고, 외부 AI 전송 안내를 확인했습니다.
                  </label>
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500">
                      AI 판독 → 원문 위치 확인 → 서류끼리 비교
                    </p>
                    <button
                      onClick={() => prepare(false)}
                      disabled={!canPrepare}
                      className="mt-2 text-xs text-blue-700 underline disabled:opacity-40"
                    >
                      PDF 원문만 보기
                    </button>
                  </div>
                  <button
                    onClick={() => prepare(true)}
                    disabled={!canPrepare}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {busy ? (
                      <>
                        <LoaderCircle className="animate-spin" size={16} />
                        문서 처리 중
                      </>
                    ) : (
                      <>
                        AI 서류 분석 시작
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
                {busy && (
                  <div
                    role="status"
                    className="mt-4 text-xs leading-6 text-blue-700"
                  >
                    {batchProgress.current}/{batchProgress.total}번째 묶음 처리
                    중 · 파일마다 AI 판독과 원문 확인에 수십 초가 걸릴 수
                    있습니다.
                    <button
                      onClick={() => abort.current?.abort()}
                      className="ml-3 underline"
                    >
                      분석 중단
                    </button>
                  </div>
                )}
              </section>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {[
                  ["서류 올리기", "종류별 칸에 PDF를 올립니다. 서류마다 여러 파일도 됩니다."],
                  ["AI 판독 · 원문 확인", "AI가 읽은 값마다 PDF의 실제 라벨·행·열 위치를 다시 확인합니다."],
                  ["서류끼리 비교", "같은 거래의 값만 비교해 불일치와 확인할 항목을 알려 줍니다."],
                ].map(([label, body], i) => (
                  <div
                    key={label}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <span className="text-[10px] font-bold text-blue-600">
                      0{i + 1}
                    </span>
                    <p className="mt-2 text-xs font-semibold">{label}</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-500">
                      {body}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <section
                aria-label="검토 결론"
                className={`mb-5 rounded-2xl border bg-white p-5 md:p-6 ${reviewed && mismatchCount ? "border-red-200" : reviewed && otherIssues.length ? "border-orange-200" : "border-slate-200"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 max-w-3xl">
                    <h2 className="text-lg font-bold text-[#142744]">
                      {heading}
                    </h2>
                    <p
                      data-testid="result-verdict"
                      className="mt-2 text-sm leading-6 text-slate-600"
                    >
                      {verdict}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ShippingReport results={results} review={review} />
                    <button
                      onClick={reset}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"
                    >
                      새 서류 검토
                    </button>
                  </div>
                </div>
                <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-6 text-slate-500">
                  파일 {results.length}개 ·{" "}
                  {shippingTypes
                    .filter((t) =>
                      results.some(
                        (r) => (r.detectedType ?? r.uploadSlot) === t,
                      ),
                    )
                    .map((t) => shippingLabels[t].title)
                    .join(" · ")}
                  {resultAnalysis &&
                    ` · AI 분석 ${summary.analyzedDocuments}개${summary.failedDocuments ? ` · 실패 ${summary.failedDocuments}개` : ""}`}{" "}
                  {!resultAnalysis && (
                    <>
                      · 대조 준비:{" "}
                      <span className="font-semibold text-slate-700">
                        {summary.comparisonReadiness === "ready_for_triangle"
                          ? "3종 대조 가능"
                          : summary.comparisonReadiness === "ready_for_pair"
                            ? "2종 대조 가능"
                            : "대상 서류 부족"}
                      </span>{" "}
                    </>
                  )}
                  · 서류 간 대조:{" "}
                  <span className="font-semibold text-slate-700">
                    {!comparisonEnabled
                      ? "분석 미실시"
                      : review.triangleStatus === "performed"
                        ? "3종 대조 완료"
                        : review.triangleStatus === "insufficient_documents"
                          ? "2종만 대조 · 3종 부족"
                          : "같은 거래 연결 확인 필요"}
                  </span>
                </p>
                {results.some(
                  (r) => r.document?.classificationStatus === "needs_review",
                ) && (
                  <p className="mt-2 text-xs text-orange-800">
                    {results.length}개 파일 중{" "}
                    {
                      results.filter(
                        (r) =>
                          r.document?.classificationStatus === "needs_review",
                      ).length
                    }
                    개는 문서 제목으로 서류 종류를 확인하지 못했습니다.
                    아래 서류별 판독 결과에서 이유를 확인해 주세요.
                  </p>
                )}
                {!!reusedDocuments && (
                  <p className="mt-2 text-xs text-blue-700">
                    기존 성공 결과 {reusedDocuments}개를 유지했습니다. 해당
                    문서는 AI를 다시 호출하지 않았습니다.
                  </p>
                )}
              </section>
              {comparisonEnabled && (
                <ShippingReviewPanel
                  review={review}
                  documents={results.flatMap((r) =>
                    r.document ? [r.document] : [],
                  )}
                  onUpdate={(doc) =>
                    setResults((current) =>
                      current.map((r) =>
                        r.pdf.id === doc.id ? { ...r, document: doc } : r,
                      ),
                    )
                  }
                  onConfirmRelationship={(id) =>
                    setConfirmedRelationships((current) => [
                      ...new Set([...current, id]),
                    ])
                  }
                  onEvidence={(field, label) =>
                    setSelection({
                      field,
                      label,
                      page: results
                        .find((r) => r.pdf.id === field.source?.fileId)
                        ?.pdf.pages.find((p) => p.page === field.source?.page),
                    })
                  }
                />
              )}
              <div className="mt-8">
                <h2 className="text-base font-bold text-[#142744]">
                  서류별 판독 결과
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  AI가 읽은 값과 원문 위치를 서류마다 확인하고, 잘못 읽은 값은
                  직접 고칠 수 있습니다. 고친 값은 다시 계산하지만 원문 확인
                  완료로 표시하지 않습니다.
                </p>
              </div>
              <div className="mt-4 space-y-5">
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
                            ? `${result.document?.classification?.recovery ? "원문 제목 판독" : "AI 분류"}: ${shippingLabels[result.detectedType].title}`
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
                              ? "사용자 수정 포함"
                              : result.document?.extractionStatus === "partial"
                                ? "일부 값 원문 미확인"
                                : "모든 값 원문 확인"}
                      </span>
                    </div>
                    {urlById.get(result.pdf.id) && (
                      <a
                        href={urlById.get(result.pdf.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-block text-xs text-blue-700 underline"
                      >
                        원본 PDF 열기 (브라우저 내 파일)
                      </a>
                    )}
                    {result.ocrPages?.length && (
                      <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                        OCR 페이지: {result.ocrPages.join(", ")} · 인식값은 원본
                        이미지에서 직접 확인해 주세요.
                      </p>
                    )}
                    {result.ocrError && (
                      <p role="alert" className="mt-3 text-xs text-amber-900">
                        OCR 처리: {result.ocrError.message}
                      </p>
                    )}
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
                        문서 유형 불일치: 선택 영역과 원문에서 확인된 판독
                        유형이 다릅니다. 실제 분류의 필드를 표시했습니다. 파일을
                        교체하거나 영역을 수정해 주세요.
                        <button
                          className="ml-2 underline"
                          onClick={() =>
                            fixSlot(result.pdf.id, result.detectedType!)
                          }
                        >
                          분류된 유형으로 영역 변경 (다른 파일 유지)
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
                              PAGE {page.page}{" "}
                              {page.textSource === "ocr"
                                ? "· OCR 인식 (독립 원문 검증 아님)"
                                : page.ocrStatus === "candidate"
                                  ? "· 텍스트 부족 / OCR 후보"
                                  : ""}
                            </p>
                            <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-4 font-mono text-xs leading-6">
                              {page.text}
                            </pre>
                            {page.textSource !== "ocr" && (
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
                                                  quote: block.text.slice(
                                                    0,
                                                    800,
                                                  ),
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
                            )}
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
