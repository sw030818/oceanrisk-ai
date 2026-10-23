"use client";
import { useRef, useState } from "react";
import { FileText, UploadCloud, X, RefreshCw } from "lucide-react";
import { shippingLabels, type ShippingType } from "@/modules/shipping/catalog";
export type UploadProgress = {
  state: "waiting" | "processing" | "complete" | "partial" | "failed";
  error?: string;
};
export function ShippingUploadCard({
  slot,
  files,
  disabled,
  idFor,
  progress,
  onSelect,
  onRemove,
  onReplace,
}: {
  slot: ShippingType;
  files: File[];
  disabled: boolean;
  idFor: (file: File) => string;
  progress: Record<string, UploadProgress>;
  onSelect: (files: File[]) => void;
  onRemove: (id: string) => void;
  onReplace: (id: string, file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null),
    replace = useRef<HTMLInputElement>(null),
    target = useRef<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const label = shippingLabels[slot];
  return (
    <section
      aria-label={`${label.title} 업로드 영역`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) onSelect(Array.from(e.dataTransfer.files));
      }}
      className={`min-w-0 rounded-xl border-2 border-dashed p-5 transition ${dragging ? "border-blue-500 bg-blue-50" : "border-blue-200/70 bg-[#f8faff]"}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white">
          <FileText
            data-testid={`${slot}-pdf-icon`}
            size={24}
            className="text-red-600"
          />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800">{label.title}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {label.subtitle} · {files.length}개
          </p>
        </div>
      </div>
      <p className="mt-5 text-xs leading-6 text-slate-500">
        여러 PDF를 함께 놓거나 추가하세요. 기존 파일은 유지됩니다.
      </p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-xs font-semibold text-blue-700 disabled:opacity-50"
      >
        <UploadCloud size={14} />
        {files.length ? "파일 추가" : "파일 선택"}
      </button>
      <input
        ref={input}
        type="file"
        multiple
        accept=".pdf,application/pdf"
        aria-label={`${label.title} PDF 파일 선택`}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          onSelect(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <input
        ref={replace}
        type="file"
        accept=".pdf,application/pdf"
        aria-label={`${label.title} 개별 PDF 교체`}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          if (target.current && e.target.files?.[0])
            onReplace(target.current, e.target.files[0]);
          e.target.value = "";
        }}
      />
      <div className="mt-4 space-y-2">
        {files.map((file, i) => {
          const id = idFor(file),
            p = progress[id];
          return (
            <div
              key={id}
              data-testid="upload-file"
              data-upload-id={id}
              className="flex min-w-0 items-start gap-2 rounded-lg border border-slate-200 bg-white p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="break-all text-xs font-medium">{file.name}</p>
                <p className="mt-1 text-[10px] text-slate-500">
                  {(file.size / 1024).toFixed(1)} KB ·{" "}
                  <span className="font-semibold text-red-600">PDF 파일</span>
                </p>
                <p
                  aria-live="polite"
                  className="mt-1 text-[10px] text-slate-500"
                >
                  {
                    {
                      waiting: "분석 대기",
                      processing: "처리 중",
                      complete: "완료",
                      partial: "완료 · 일부 값 원문 미확인",
                      failed: "실패",
                    }[p?.state ?? "waiting"]
                  }
                </p>
                {p?.error && (
                  <p className="mt-1 break-words text-[10px] text-red-700">
                    {p.error}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label={`${file.name} ${i + 1}번째 파일 교체`}
                disabled={disabled}
                onClick={() => {
                  target.current = id;
                  replace.current?.click();
                }}
                className="rounded p-1.5 text-slate-500"
              >
                <RefreshCw size={13} />
              </button>
              <button
                type="button"
                aria-label={`${file.name} 제거`}
                disabled={disabled}
                onClick={() => onRemove(id)}
                className="rounded p-1.5 text-slate-500"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-[10px] leading-5 text-slate-400">
        파일당 4 MB · 30페이지 · 전체 24개 / 64 MB
        <br />
        요청당 4 MB 이내로 자동 분할해 순서대로 분석합니다.
      </p>
    </section>
  );
}
