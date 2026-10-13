"use client";
import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import type { GroundedField, PdfPage } from "@/modules/documents/schema";
import { statusColors, statusLabels } from "./field-status";
export function EvidenceDialog({
  selection,
  pageText,
  page,
  onClose,
  candidateLabel = "AI가 제시한 근거 후보 (수정값의 새 근거가 아닙니다)",
}: {
  selection: { field: GroundedField<string | number>; label: string };
  pageText?: string;
  page?: PdfPage;
  onClose: () => void;
  candidateLabel?: string;
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
              {candidateLabel}
            </p>
            <blockquote className="mt-2 break-words rounded-lg border-l-2 border-blue-500 bg-blue-50 p-3 text-sm leading-6">
              {selection.field.source.quote}
            </blockquote>
            {selection.field.source.blocks?.length ? (
              <div className="mt-4 rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-semibold">실제 PDF 블록 위치</p>
                {selection.field.source.blocks.map((block) => (
                  <p
                    key={block.id}
                    className="mt-2 break-words text-[11px] leading-5 text-slate-600"
                  >
                    “{block.text}” · 원문 {block.row + 1}행 · x{" "}
                    {block.x.toFixed(1)}, y {block.y.toFixed(1)}
                  </p>
                ))}
                {selection.field.source.layout && (
                  <p className="mt-3 text-[11px] text-blue-700">
                    동일 표의 상품 행 연결 ·{" "}
                    {selection.field.source.layout.role === "quantity"
                      ? "상품 수량 열"
                      : selection.field.source.layout.role === "description"
                        ? "품명 열"
                        : "단위 열"}
                    {selection.field.source.layout.unit
                      ? ` · ${selection.field.source.layout.unit}`
                      : ""}
                  </p>
                )}
              </div>
            ) : null}
            {page?.blocks && page.width && page.height ? (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold">원문 위치 미리보기</p>
                <svg
                  role="img"
                  aria-label="PDF 텍스트 블록과 근거 위치"
                  viewBox={`0 0 ${page.width} ${page.height}`}
                  className="max-h-96 w-full rounded-lg border border-slate-200 bg-white"
                >
                  {page.blocks.slice(0, 2000).map((block) => {
                    const highlighted = selection.field.source?.blocks?.some(
                      (b) => b.id === block.id,
                    );
                    return (
                      <g key={block.id}>
                        <rect
                          x={block.x}
                          y={block.y}
                          width={block.width}
                          height={block.height}
                          fill={highlighted ? "#dbeafe" : "transparent"}
                          stroke={highlighted ? "#2563eb" : "none"}
                        />
                        <text
                          x={block.x}
                          y={block.y + block.height * 0.85}
                          fontSize={block.height * 0.8}
                          fill={highlighted ? "#1e40af" : "#64748b"}
                        >
                          {block.text}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                {page.blocks.length > 2000 && (
                  <p className="mt-2 text-[10px] text-slate-500">
                    미리보기는 처음 2,000개 블록만 표시합니다. 아래 원문에서
                    전체를 확인하세요.
                  </p>
                )}
              </div>
            ) : null}
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
