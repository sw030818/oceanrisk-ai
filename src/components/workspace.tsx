"use client";

import Link from "next/link";
import { EditableField } from "./editable-field";
import { EvidenceDialog } from "./evidence-dialog";
import { statusColors, statusLabels } from "./field-status";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Anchor,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  FileCheck2,
  FileSearch,
  FileText,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
  AlertTriangle,
  Info,
  ScanText,
} from "lucide-react";
import { validateUploads } from "@/modules/upload/validate";
import { safeError } from "@/modules/documents/errors";
import { editField } from "@/modules/evidence/verify";
import { summarizeAnalysis } from "@/modules/analysis/summary";
import { compareQuantities } from "@/modules/rules/quantity";
import type {
  AnalysisResult,
  GroundedDocument,
  GroundedField,
} from "@/modules/documents/schema";

const typeLabels = {
  invoice: "Commercial Invoice",
  packing_list: "Packing List",
  unknown: "문서 유형 미확인",
};
const subscribeReady = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
type EvidenceSelection = {
  field: GroundedField<string | number>;
  label: string;
};

export function Workspace() {
  const ready = useSyncExternalStore(subscribeReady, clientReady, serverReady);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [accessRequired, setAccessRequired] = useState(false);
  const [accessConfigured, setAccessConfigured] = useState(true);
  const [accessToken, setAccessToken] = useState("");
  const [consent, setConsent] = useState(false);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [documents, setDocuments] = useState<GroundedDocument[]>([]);
  const [tab, setTab] = useState<"upload" | "results">("upload");
  const [selection, setSelection] = useState<EvidenceSelection | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const runToken = useRef(0);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/status", { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => {
        setConfigured(data.aiConfigured === true);
        setAccessRequired(data.accessRequired === true);
        setAccessConfigured(data.accessConfigured !== false);
      })
      .catch(() => {});
    return () => {
      controller.abort();
      abort.current?.abort();
    };
  }, []);
  const summary = summarizeAnalysis(results);
  const checks = useMemo(() => compareQuantities(documents), [documents]);
  const verifiedCount = documents.reduce(
    (count, doc) =>
      count +
      [
        doc.seller,
        doc.buyer,
        doc.documentNumber,
        doc.transactionReference,
        doc.partialShipment,
        doc.currency,
        doc.totalAmount,
        ...doc.items.flatMap((item) => Object.values(item)),
      ].filter((field) => field.status === "verified").length,
    0,
  );
  function addFiles(incoming: File[]) {
    if (busy) return;
    const next = [...files];
    incoming.forEach((file) => {
      if (
        !next.some(
          (old) =>
            old.name === file.name &&
            old.size === file.size &&
            old.lastModified === file.lastModified,
        )
      )
        next.push(file);
    });
    try {
      validateUploads(next);
      setFiles(next);
      setError(null);
    } catch (problem) {
      setError(safeError(problem).message);
    }
  }
  function clearAll() {
    runToken.current++;
    abort.current?.abort();
    setBusy(false);
    setFiles([]);
    setResults([]);
    setDocuments([]);
    setSelection(null);
    setError(null);
    setConsent(false);
    setTab("upload");
  }
  async function analyze() {
    try {
      validateUploads(files);
    } catch (problem) {
      setError(safeError(problem).message);
      return;
    }
    if (!consent) {
      setError("문서 처리 및 AI 전송 안내를 확인해 주세요.");
      return;
    }
    const token = ++runToken.current;
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError(null);
    setSelection(null);
    setResults([]);
    setDocuments([]);
    try {
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: form,
        signal: controller.signal,
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error?.message ?? "분석 요청을 처리하지 못했습니다.",
        );
      if (!Array.isArray(data.results))
        throw new Error("서버 응답 형식이 올바르지 않습니다.");
      if (token !== runToken.current) return;
      setResults(data.results);
      setDocuments(
        data.results.flatMap((result: AnalysisResult) =>
          result.document ? [result.document] : [],
        ),
      );
      setConfigured(data.aiConfigured === true);
      setTab("results");
    } catch (problem) {
      if (token === runToken.current)
        setError(
          problem instanceof Error
            ? problem.message
            : "서버에 연결하지 못했습니다. 다시 시도해 주세요.",
        );
    } finally {
      if (token === runToken.current) setBusy(false);
    }
  }
  function updateDoc(
    id: string,
    update: (doc: GroundedDocument) => GroundedDocument,
  ) {
    setDocuments((current) =>
      current.map((doc) => (doc.id === id ? update(doc) : doc)),
    );
    setSelection(null);
  }
  const sourceResult = results.find(
    (result) => result.pdf.id === selection?.field.source?.fileId,
  );
  const sourcePage = sourceResult?.pdf.pages.find(
    (page) => page.page === selection?.field.source?.page,
  );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[76px] max-w-[1600px] items-center justify-between px-5 lg:px-9">
          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label="OceanRisk AI 홈"
          >
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#152f55] text-white">
              <Anchor size={23} strokeWidth={1.7} />
            </div>
            <div className="text-xl font-bold tracking-tight text-[#172e50]">
              OceanRisk<span className="ml-1.5 text-blue-600">AI</span>
              <span className="ml-3 hidden rounded border border-blue-100 bg-blue-50 px-1.5 py-0.5 align-middle text-[9px] font-semibold tracking-wider text-blue-600 sm:inline">
                EARLY ACCESS
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-5">
            <a
              href="#guide"
              className="hidden items-center gap-1.5 text-xs font-medium text-slate-500 sm:flex"
            >
              <CircleHelp size={16} />
              이용 가이드
            </a>
            <span className="h-7 w-px bg-slate-200" />
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                OR
              </div>
              <span className="hidden text-xs font-semibold text-slate-600 md:block">
                문서 검토 워크스페이스
              </span>
            </div>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1600px]">
        <aside className="sticky top-[76px] hidden h-[calc(100vh-76px)] w-[220px] shrink-0 flex-col border-r border-slate-200 bg-white px-5 py-8 lg:flex">
          <p className="px-3 text-[10px] font-semibold tracking-[0.18em] text-slate-400">
            WORKSPACE
          </p>
          <button
            onClick={() => setTab("upload")}
            className={`mt-5 flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold ${tab === "upload" ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50"}`}
          >
            <FileSearch size={18} />
            서류 업로드
          </button>
          <button
            disabled={!results.length}
            onClick={() => setTab("results")}
            className={`mt-2 flex items-center justify-between rounded-lg px-3 py-3 text-sm font-medium ${tab === "results" ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50 disabled:text-slate-300"}`}
          >
            <span className="flex items-center gap-3">
              <FileCheck2 size={18} />
              분석 결과
            </span>
            {results.length > 0 && (
              <span className="rounded bg-white px-1.5 text-xs">
                {results.length}
              </span>
            )}
          </button>
          <div className="mt-auto rounded-xl border border-slate-100 bg-slate-50 p-4">
            <ShieldCheck size={20} className="text-blue-600" />
            <p className="mt-3 text-xs font-bold text-slate-700">
              근거를 먼저 확인합니다
            </p>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">
              AI 추출값과 PDF 원문을 대조한 뒤, 코드로 수량을 비교합니다.
            </p>
          </div>
          <p className="mt-5 px-1 text-[10px] text-slate-400">
            © 2026 OceanRisk AI
          </p>
        </aside>
        <main className="min-w-0 flex-1 px-5 pb-10 pt-7 md:px-9 lg:px-10">
          <div className="mb-6 flex items-center gap-2 text-[11px] text-slate-400">
            <Layers3 size={13} />
            <span>워크스페이스</span>
            <ChevronRight size={12} />
            <span className="text-slate-600">
              {tab === "upload" ? "서류 업로드" : "분석 결과"}
            </span>
          </div>
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-blue-600" />
                <p className="text-[10px] font-bold tracking-[0.16em] text-blue-700">
                  MARITIME DOCUMENT INTELLIGENCE
                </p>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#142744] md:text-[28px]">
                {tab === "upload"
                  ? "서류 검토, 더 명확하게."
                  : "원문을 확인하고, 다음 판단으로."}
              </h1>
              <p className="mt-2.5 text-sm leading-6 text-slate-500">
                {tab === "upload"
                  ? "무역 서류의 정보와 수량 차이를 원문 근거와 함께 확인하세요."
                  : "AI 추출값은 후보입니다. 근거를 검토하고 필요한 정보를 수정하세요."}
              </p>
            </div>
            <div className="flex rounded-lg border border-slate-200 bg-white p-1 lg:hidden">
              <button
                onClick={() => setTab("upload")}
                className={`rounded px-3 py-1.5 text-xs ${tab === "upload" ? "bg-blue-50 text-blue-700" : "text-slate-500"}`}
              >
                업로드
              </button>
              <button
                disabled={!results.length}
                onClick={() => setTab("results")}
                className={`rounded px-3 py-1.5 text-xs ${tab === "results" ? "bg-blue-50 text-blue-700" : "text-slate-500 disabled:text-slate-300"}`}
              >
                분석 결과
              </button>
            </div>
          </div>
          {error && (
            <div
              role="alert"
              className="mb-5 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            >
              <AlertTriangle size={18} className="shrink-0" />
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
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-4 -bottom-24 size-56 rounded-full border border-white/10"
                />
                <div className="relative flex flex-wrap items-center justify-between gap-6">
                  <div>
                    <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] text-blue-100">
                      <Sparkles size={12} />
                      복잡한 무역 서류를 이해하는 첫 단계
                    </div>
                    <h2 className="text-xl font-semibold leading-relaxed tracking-tight md:text-2xl">
                      작은 수량 차이도,
                      <br />
                      놓치지 않도록.
                    </h2>
                    <p className="mt-3 max-w-lg text-xs leading-6 text-blue-100/75">
                      Invoice와 Packing List를 함께 올려 주세요.
                      <br className="hidden sm:block" /> 주요 정보, 원문 근거,
                      확인이 필요한 질문을 한곳에서 검토합니다.
                    </p>
                  </div>
                  <div className="flex gap-7 pr-3 md:gap-10">
                    <div>
                      <p className="text-3xl font-light">
                        02<span className="ml-1 text-sm text-blue-200">종</span>
                      </p>
                      <p className="mt-2 text-[10px] text-blue-100/70">
                        지원 문서 유형
                      </p>
                    </div>
                    <div className="w-px bg-white/10" />
                    <div>
                      <p className="text-3xl font-light">
                        01<span className="ml-1 text-sm text-blue-200">개</span>
                      </p>
                      <p className="mt-2 text-[10px] text-blue-100/70">
                        수량 비교 규칙
                      </p>
                    </div>
                  </div>
                </div>
              </section>
              <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_290px]">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
                  {accessRequired && (
                    <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 p-4">
                      <label className="block text-xs font-semibold text-blue-900">
                        분석 접근 코드
                        <input
                          aria-label="분석 접근 코드"
                          type="password"
                          autoComplete="off"
                          value={accessToken}
                          disabled={busy}
                          onChange={(event) =>
                            setAccessToken(event.target.value)
                          }
                          className="mt-2 w-full rounded-lg border border-blue-200 bg-white px-3 py-2.5 text-sm"
                          placeholder="운영자에게 받은 코드를 입력하세요"
                        />
                      </label>
                      <p className="mt-2 text-[11px] leading-5 text-blue-800">
                        접근 코드는 이 브라우저 화면의 메모리에서만 사용하며
                        Gemini에 전송하지 않습니다.
                      </p>
                      {!accessConfigured && (
                        <p
                          role="alert"
                          className="mt-2 text-xs font-semibold text-amber-800"
                        >
                          서버 접근 제한이 아직 설정되지 않았습니다. 운영자에게
                          문의해 주세요.
                        </p>
                      )}
                    </div>
                  )}
                  <div className="mb-6 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <UploadCloud size={19} />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold">
                          분석할 서류 업로드
                        </h2>
                        <p className="mt-1 text-[11px] text-slate-400">
                          동일 거래의 Invoice · Packing List
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-500">
                      텍스트 PDF
                    </span>
                  </div>
                  <div
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (!busy) setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragging(false);
                      addFiles(Array.from(event.dataTransfer.files));
                    }}
                    className={`rounded-xl border-2 border-dashed p-6 text-center transition md:p-9 ${dragging ? "border-blue-500 bg-blue-50" : "border-blue-200/70 bg-[#f8faff]"}`}
                  >
                    <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl border border-blue-100 bg-white text-blue-600 shadow-sm">
                      <UploadCloud size={27} strokeWidth={1.5} />
                    </div>
                    <p className="text-sm font-semibold">
                      PDF 파일을 여기에 놓아주세요
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      또는 아래 버튼으로 여러 파일을 선택하세요
                    </p>
                    <button
                      type="button"
                      disabled={busy || !ready}
                      onClick={() => input.current?.click()}
                      className="mt-5 inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-5 py-2.5 text-xs font-bold text-blue-700 shadow-sm transition hover:bg-blue-50 disabled:opacity-50"
                    >
                      <UploadCloud size={14} />
                      파일 선택
                    </button>
                    <input
                      ref={input}
                      type="file"
                      disabled={busy || !ready}
                      accept=".pdf,application/pdf"
                      multiple
                      aria-label="PDF 파일 선택"
                      className="sr-only"
                      onChange={(event) => {
                        addFiles(Array.from(event.target.files ?? []));
                        event.target.value = "";
                      }}
                    />
                    <p className="mt-5 text-[10px] leading-5 text-slate-400">
                      최대 4개 · 파일당 4 MB · 전체 합계 4 MB · 파일당 30페이지
                    </p>
                  </div>
                  {files.length > 0 && (
                    <ul className="mt-4 space-y-2" aria-label="선택한 파일">
                      {files.map((file, i) => (
                        <li
                          key={`${file.name}-${i}`}
                          className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3"
                        >
                          <FileText
                            size={19}
                            className="shrink-0 text-blue-600"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">
                              {file.name}
                            </p>
                            <p className="mt-0.5 text-[10px] text-slate-400">
                              {(file.size / 1024).toFixed(1)} KB · PDF
                            </p>
                          </div>
                          <button
                            disabled={busy}
                            aria-label={`${file.name} 제거`}
                            onClick={() =>
                              setFiles((current) =>
                                current.filter((_, index) => index !== i),
                              )
                            }
                            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                          >
                            <X size={15} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-5 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-3">
                    <LockKeyhole
                      size={14}
                      className="mt-0.5 shrink-0 text-slate-400"
                    />
                    <p className="text-[10px] leading-5 text-slate-500">
                      업로드 파일은 이 앱의 데이터베이스에 저장하지 않습니다. AI
                      분석 시 추출 텍스트가 Google Gemini로 전송됩니다. 제공자
                      데이터 처리 정책을 확인하고 민감정보는 제거해 주세요.
                    </p>
                  </div>
                  <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-[11px] leading-5 text-slate-600">
                    <input
                      type="checkbox"
                      checked={consent}
                      disabled={busy || !ready}
                      onChange={(event) => setConsent(event.target.checked)}
                      className="mt-1 accent-blue-600"
                    />
                    문서 처리·AI 전송 안내를 확인했으며 분석에 동의합니다.
                  </label>
                  {configured === false && (
                    <p
                      role="status"
                      className="mt-4 rounded-lg border border-amber-100 bg-amber-50 p-3 text-[11px] leading-5 text-amber-800"
                    >
                      Gemini 키가 설정되지 않았습니다. PDF 원문 추출은 가능하며
                      AI 정보 추출·수량 비교 결과는 생성되지 않습니다.
                    </p>
                  )}
                  <button
                    onClick={analyze}
                    disabled={
                      busy ||
                      !files.length ||
                      !consent ||
                      (accessRequired && (!accessConfigured || !accessToken))
                    }
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    {busy ? (
                      <>
                        <LoaderCircle size={17} className="animate-spin" />
                        원문 추출 및 AI 분석 진행 중
                      </>
                    ) : (
                      <>
                        서류 분석 시작
                        <ArrowRight size={17} />
                      </>
                    )}
                  </button>
                  {busy && (
                    <div
                      role="status"
                      className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-blue-700"
                    >
                      <span>
                        문서 수에 따라 시간이 걸릴 수 있습니다. 실제 응답을
                        기다리는 중입니다.
                      </span>
                      <button onClick={clearAll} className="underline">
                        분석 취소
                      </button>
                    </div>
                  )}
                </section>
                <div className="space-y-5">
                  <section className="rounded-2xl border border-slate-200 bg-white p-5">
                    <h2 className="text-xs font-bold">이렇게 검토합니다</h2>
                    <div className="mt-5 space-y-5">
                      {[
                        {
                          icon: ScanText,
                          title: "문서 정보 읽기",
                          text: "페이지별 원문과 주요 필드를 추출합니다.",
                        },
                        {
                          icon: ShieldCheck,
                          title: "원문 근거 확인",
                          text: "AI가 제시한 문구와 실제 원문을 대조합니다.",
                        },
                        {
                          icon: FileCheck2,
                          title: "수량 차이 검토",
                          text: "같은 상품·단위·선적 범위만 비교합니다.",
                        },
                      ].map((step, i) => (
                        <div key={step.title} className="flex gap-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
                            <step.icon size={17} />
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold">
                              <span className="mr-2 text-blue-500">
                                0{i + 1}
                              </span>
                              {step.title}
                            </p>
                            <p className="mt-1.5 text-[10px] leading-5 text-slate-500">
                              {step.text}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
                    <div className="flex items-center gap-2 text-blue-800">
                      <Info size={16} />
                      <h2 className="text-xs font-bold">
                        업로드 전 확인해 주세요
                      </h2>
                    </div>
                    <ul className="mt-3 space-y-2 text-[11px] leading-5 text-slate-600">
                      <li>• 글자를 선택할 수 있는 PDF가 필요합니다.</li>
                      <li>
                        • 스캔 문서·이미지 PDF·암호화 파일은 지원하지 않습니다.
                      </li>
                      <li>• 서로 다른 거래의 문서를 섞지 마세요.</li>
                      <li>• 정보가 부족하면 ‘검증 불가’로 표시합니다.</li>
                    </ul>
                  </section>
                </div>
              </div>
              <section
                id="guide"
                className="mt-7 rounded-xl border border-slate-200 bg-white px-5 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <CircleHelp size={18} className="text-slate-400" />
                    <div>
                      <h2 className="text-xs font-semibold">
                        어떤 서류를 준비해야 하나요?
                      </h2>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Commercial Invoice는 거래 품목·금액, Packing List는 출하
                        품목·수량·중량을 확인하는 서류입니다.
                      </p>
                    </div>
                  </div>
                  <a
                    href="#scope"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600"
                  >
                    검토 범위 보기
                    <ArrowUpRight size={13} />
                  </a>
                </div>
              </section>
            </>
          ) : (
            <>
              <section
                role="status"
                className={`mb-5 rounded-xl border p-4 ${summary.status === "success" ? "border-emerald-100 bg-emerald-50" : summary.status === "partial" ? "border-amber-100 bg-amber-50" : "border-red-100 bg-red-50"}`}
              >
                <h2 className="text-sm font-bold">{summary.title}</h2>
                <p className="mt-2 text-xs leading-6 text-slate-600">
                  {summary.message}
                </p>
              </section>
              <div className="mb-6 grid grid-cols-3 gap-3">
                {[
                  {
                    label: "처리한 문서",
                    value: results.length,
                    icon: FileText,
                  },
                  {
                    label: "원문 대조 필드",
                    value: verifiedCount,
                    icon: ShieldCheck,
                  },
                  {
                    label: "수량 차이",
                    value: checks.filter((check) => check.status === "mismatch")
                      .length,
                    icon: FileCheck2,
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-slate-200 bg-white p-4 md:p-5"
                  >
                    <stat.icon size={18} className="mb-3 text-blue-600" />
                    <p className="text-2xl font-bold">
                      {stat.value}
                      <span className="ml-2 text-[11px] font-normal text-slate-400">
                        개
                      </span>
                    </p>
                    <p className="mt-2 break-all text-[10px] text-slate-500">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
              <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-sm font-bold">
                    <FileCheck2 size={18} className="text-blue-600" />
                    수량 교차검증
                  </h2>
                  <span className="text-[10px] text-slate-400">
                    원문 대조 + TypeScript 규칙 · 전체 안전성 평가 아님
                  </span>
                </div>
                <div className="space-y-3">
                  {checks.map((check) => (
                    <div
                      key={check.id}
                      className={`rounded-xl border p-4 ${check.status === "mismatch" ? "border-red-200 bg-red-50/50" : check.status === "match" ? "border-emerald-100 bg-emerald-50/50" : "border-amber-100 bg-amber-50/50"}`}
                    >
                      <div className="flex items-start gap-3">
                        {check.status === "match" ? (
                          <CheckCircle2
                            size={18}
                            className="mt-0.5 shrink-0 text-emerald-600"
                          />
                        ) : (
                          <AlertTriangle
                            size={18}
                            className={`mt-0.5 shrink-0 ${check.status === "mismatch" ? "text-red-600" : "text-amber-600"}`}
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold">
                            {check.status === "unverifiable" && (
                              <span className="mr-2 text-amber-700">
                                {check.confidence === "candidate"
                                  ? "비교 후보"
                                  : "검증 불가"}
                              </span>
                            )}
                            {check.item ? `${check.item} · ` : ""}
                            {check.title}
                          </p>
                          {check.invoiceQuantity !== undefined && (
                            <p className="mt-2 text-sm font-semibold">
                              Invoice {check.invoiceQuantity} {check.unit}{" "}
                              <span className="mx-2 font-normal text-slate-400">
                                ↔
                              </span>{" "}
                              Packing List {check.packingQuantity} {check.unit}
                            </p>
                          )}
                          <p className="mt-2 text-[11px] leading-5 text-slate-600">
                            {check.explanation}
                          </p>
                          <div className="mt-3 rounded-lg bg-white/70 p-3 text-[11px] leading-5">
                            <span className="font-semibold text-blue-700">
                              발행자에게 물어보세요
                            </span>
                            <p className="mt-1 text-slate-600">
                              {check.question}
                            </p>
                          </div>
                          {check.sources.filter(Boolean).length > 0 && (
                            <p className="mt-2 break-all text-[10px] text-slate-500">
                              근거:{" "}
                              {check.sources
                                .filter(Boolean)
                                .map(
                                  (source) =>
                                    `${source!.fileName} p.${source!.page} · “${source!.quote}”`,
                                )
                                .join(" / ")}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              {results.map((result) => {
                const doc = documents.find((doc) => doc.id === result.pdf.id);
                return (
                  <section
                    key={result.pdf.id}
                    className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 md:p-6"
                  >
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <FileText
                          size={20}
                          className="shrink-0 text-blue-600"
                        />
                        <div className="min-w-0">
                          <h2 className="break-all text-sm font-bold">
                            {result.pdf.fileName}
                          </h2>
                          <p className="mt-1 text-[10px] text-slate-400">
                            원문 {result.pdf.pages.length}페이지 ·{" "}
                            {doc ? typeLabels[doc.type] : "AI 추출 결과 없음"}
                          </p>
                        </div>
                      </div>
                      {doc && (
                        <button
                          onClick={() => {
                            updateDoc(doc.id, () => result.document!);
                          }}
                          className="inline-flex items-center gap-1.5 text-[11px] text-slate-500"
                        >
                          <RotateCcw size={13} />
                          AI 추출값 복원
                        </button>
                      )}
                    </div>
                    {result.error && (
                      <div
                        role="alert"
                        className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900"
                      >
                        <p className="font-semibold">
                          분석을 완료하지 못했습니다
                        </p>
                        <p>{result.error.message}</p>
                        <p className="mt-1 text-[10px] text-amber-700">
                          오류 코드: {result.error.code}
                        </p>
                      </div>
                    )}
                    {doc && (
                      <>
                        <p className="mb-5 rounded-lg bg-blue-50 px-3 py-2.5 text-[11px] leading-5 text-blue-800">
                          값을 수정하면 ‘사용자 수정’으로 표시되며 확정 수량
                          비교에서 제외됩니다. 수정 서류는 새로 업로드해
                          원문부터 다시 검증하세요.
                        </p>
                        {doc.type === "unknown" && (
                          <p className="mb-5 text-xs text-amber-800">
                            지원하는 문서 유형으로 분류되지 않았습니다. Invoice
                            또는 Packing List인지 확인해 주세요.
                          </p>
                        )}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                          {(
                            [
                              ["seller", "판매자"],
                              ["buyer", "구매자"],
                              ["documentNumber", "문서 번호"],
                              ["transactionReference", "거래 참조"],
                              ["currency", "통화"],
                              ["totalAmount", "총 금액"],
                            ] as const
                          ).map(([key, label]) => (
                            <EditableField
                              key={key}
                              label={label}
                              field={doc[key]}
                              numeric={key === "totalAmount"}
                              onEvidence={() =>
                                setSelection({ field: doc[key], label })
                              }
                              onChange={(value) =>
                                updateDoc(doc.id, (current) =>
                                  key === "totalAmount"
                                    ? {
                                        ...current,
                                        totalAmount: editField(
                                          current.totalAmount,
                                          value as number | null,
                                        ),
                                      }
                                    : {
                                        ...current,
                                        [key]: editField(
                                          current[key],
                                          value as string | null,
                                        ),
                                      },
                                )
                              }
                            />
                          ))}
                          <div>
                            <label className="mb-2 block text-xs font-medium text-slate-500">
                              부분선적 여부
                              <select
                                aria-label="부분선적 여부"
                                value={doc.partialShipment.value ?? "unknown"}
                                onChange={(event) =>
                                  updateDoc(doc.id, (current) => ({
                                    ...current,
                                    partialShipment: editField(
                                      current.partialShipment,
                                      event.target.value as
                                        | "yes"
                                        | "no"
                                        | "unknown",
                                    ),
                                  }))
                                }
                                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800"
                              >
                                <option value="unknown">원문 정보 부족</option>
                                <option value="yes">부분선적</option>
                                <option value="no">전체 선적</option>
                              </select>
                            </label>
                            <button
                              onClick={() =>
                                setSelection({
                                  field: doc.partialShipment,
                                  label: "부분선적 여부",
                                })
                              }
                              className={`rounded-md px-2 py-1 text-[10px] font-semibold ${statusColors[doc.partialShipment.status]}`}
                            >
                              {statusLabels[doc.partialShipment.status]} · 근거
                              보기
                            </button>
                          </div>
                        </div>
                        <div className="mt-7 border-t border-slate-100 pt-5">
                          <h3 className="mb-4 text-xs font-bold">
                            상품별 추출 정보{" "}
                            <span className="ml-1 font-normal text-slate-400">
                              {doc.items.length}개 품목
                            </span>
                          </h3>
                          {doc.items.length === 0 && (
                            <p className="py-4 text-xs text-slate-500">
                              상품 정보를 추출하지 못했습니다. 원문과 문서
                              유형을 확인해 주세요.
                            </p>
                          )}
                          {doc.items.map((item, i) => (
                            <div
                              key={i}
                              className="mb-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4"
                            >
                              <p className="mb-4 text-[10px] font-bold tracking-wider text-blue-600">
                                ITEM {String(i + 1).padStart(2, "0")}
                              </p>
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                {(
                                  [
                                    ["description", "품명"],
                                    ["quantity", "상품 수량"],
                                    ["unit", "상품 단위"],
                                    ["amount", "품목 금액"],
                                    ["netWeight", "순중량"],
                                    ["grossWeight", "총중량"],
                                    ["weightUnit", "중량 단위"],
                                  ] as const
                                ).map(([key, label]) => (
                                  <EditableField
                                    key={key}
                                    label={`${label} · 품목 ${i + 1}`}
                                    field={item[key]}
                                    numeric={[
                                      "quantity",
                                      "amount",
                                      "netWeight",
                                      "grossWeight",
                                    ].includes(key)}
                                    onEvidence={() =>
                                      setSelection({ field: item[key], label })
                                    }
                                    onChange={(value) =>
                                      updateDoc(doc.id, (current) => ({
                                        ...current,
                                        items: current.items.map(
                                          (row, index) =>
                                            index === i
                                              ? {
                                                  ...row,
                                                  [key]: editField(
                                                    row[key] as GroundedField<
                                                      string | number
                                                    >,
                                                    value,
                                                  ),
                                                }
                                              : row,
                                        ),
                                      }))
                                    }
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {result.pdf.pages.length > 0 && (
                      <details className="mt-4 rounded-lg border border-slate-200">
                        <summary className="cursor-pointer p-3 text-xs font-semibold text-slate-600">
                          페이지별 PDF 원문 보기
                        </summary>
                        <div className="max-h-96 space-y-4 overflow-auto border-t border-slate-100 p-4">
                          {result.pdf.pages.map((page) => (
                            <div key={page.page}>
                              <p className="mb-2 text-[10px] font-bold text-blue-600">
                                PAGE {page.page}
                              </p>
                              <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-6 text-slate-600">
                                {page.text ||
                                  "이 페이지에 추출 가능한 텍스트가 없습니다."}
                              </pre>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </section>
                );
              })}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] text-slate-500">
                  서류를 수정했나요? 새 PDF를 업로드하면 원문부터 다시
                  검증합니다.
                </p>
                <button
                  onClick={clearAll}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white"
                >
                  새 서류 검토
                  <ArrowRight size={14} />
                </button>
              </div>
            </>
          )}
          <footer
            id="scope"
            className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 text-[10px] leading-5 text-slate-400"
          >
            <p>
              분석은 의사결정 보조 자료입니다. 법률·통관 자문이나 서류 진위
              보증을 제공하지 않습니다.
            </p>
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={13} />
              Commercial Invoice · Packing List / PHASE 1
            </span>
          </footer>
        </main>
      </div>
      {selection && (
        <EvidenceDialog
          selection={selection}
          pageText={sourcePage?.text}
          onClose={() => setSelection(null)}
        />
      )}
    </div>
  );
}
