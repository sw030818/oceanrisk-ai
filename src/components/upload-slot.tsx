"use client";
import { useRef, useState } from "react";
import { FileText, UploadCloud, X } from "lucide-react";
import type { UploadSlot } from "@/modules/documents/schema";
export function UploadSlotCard({
  slot,
  file,
  disabled,
  onSelect,
  onRemove,
}: {
  slot: UploadSlot;
  file: File | null;
  disabled: boolean;
  onSelect: (files: File[]) => void;
  onRemove: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const title = slot === "invoice" ? "Commercial Invoice" : "Packing List";
  return (
    <section
      aria-label={`${title} 업로드 영역`}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled) onSelect(Array.from(event.dataTransfer.files));
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
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {slot === "invoice" ? "상업송장" : "포장명세서"}
          </p>
        </div>
      </div>
      <p className="mt-5 text-xs leading-6 text-slate-500">
        PDF를 여기에 놓거나 파일을 선택하세요.
      </p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-xs font-semibold text-blue-700 disabled:opacity-50"
      >
        <UploadCloud size={14} />
        {file ? "파일 교체" : "파일 선택"}
      </button>
      <input
        ref={input}
        type="file"
        accept=".pdf,application/pdf"
        aria-label={`${title} PDF 파일 선택`}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          onSelect(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      {file && (
        <div className="mt-4 flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
          <div className="min-w-0 flex-1">
            <p className="break-all text-xs font-medium">{file.name}</p>
            <p className="mt-1 text-[10px] text-slate-500">
              {(file.size / 1024).toFixed(1)} KB ·{" "}
              <span className="font-semibold text-red-600">PDF 파일</span>
            </p>
          </div>
          <button
            type="button"
            aria-label={`${file.name} 제거`}
            disabled={disabled}
            onClick={onRemove}
            className="shrink-0 rounded p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X size={15} />
          </button>
        </div>
      )}
      <p className="mt-4 text-[10px] leading-5 text-slate-400">
        이 영역에 PDF 1개 · 파일당 4 MB · 30페이지
      </p>
    </section>
  );
}
