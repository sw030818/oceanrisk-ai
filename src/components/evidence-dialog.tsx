"use client";
import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import type { GroundedField } from "@/modules/documents/schema";
import { statusColors, statusLabels } from "./field-status";
export function EvidenceDialog({
  selection,
  pageText,
  onClose,
}: {
  selection: { field: GroundedField<string | number>; label: string };
  pageText?: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={onClose}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const elements = event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
        );
        const first = elements[0],
          last = elements[elements.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border-0 bg-white p-0 text-slate-800 shadow-xl backdrop:bg-slate-900/40"
    >
      <div className="p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-sm font-bold">
            {selection.label} · 원문 근거 확인
          </h2>
          <button
            autoFocus
            aria-label="근거 창 닫기"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>
        <p
          className={`mt-4 inline-block rounded-md px-2 py-1 text-[11px] font-semibold ${statusColors[selection.field.status]}`}
        >
          {statusLabels[selection.field.status]}
        </p>
        <p className="mt-3 text-xs leading-6 text-slate-600">
          {selection.field.reason}
        </p>
        <p className="mt-3 text-sm font-semibold">
          현재 값: {selection.field.value ?? "정보 없음"}
        </p>
        {selection.field.source ? (
          <>
            <p className="mt-5 break-all text-xs font-semibold text-blue-700">
              {selection.field.source.fileName} · {selection.field.source.page}
              페이지
            </p>
            <p className="mt-2 text-[10px] text-slate-400">
              AI가 제시한 근거 후보 (수정값의 새 근거가 아닙니다)
            </p>
            <blockquote className="mt-2 break-words rounded-lg border-l-2 border-blue-500 bg-blue-50 p-3 text-sm leading-6">
              {selection.field.source.quote}
            </blockquote>
            <p className="mt-5 text-xs font-bold">
              해당 페이지의 실제 추출 원문
            </p>
            <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-4 font-mono text-xs leading-6">
              {pageText ?? "해당 페이지를 찾을 수 없습니다."}
            </pre>
          </>
        ) : (
          <p className="mt-5 rounded-lg bg-slate-50 p-4 text-xs text-slate-500">
            원문 근거 후보가 없습니다. 페이지별 원문에서 직접 확인해 주세요.
          </p>
        )}
      </div>
    </dialog>
  );
}
