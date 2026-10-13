"use client";
import { Check, Info, ChevronRight } from "lucide-react";
import type { GroundedField } from "@/modules/documents/schema";
import { statusColors, statusLabels } from "./field-status";
export function EditableField({
  label,
  field,
  numeric = false,
  onChange,
  onEvidence,
  missingLabel,
}: {
  label: string;
  field: GroundedField<string | number>;
  numeric?: boolean;
  onChange: (value: string | number | null) => void;
  onEvidence: () => void;
  missingLabel?: string;
}) {
  return (
    <div className="min-w-0">
      <label className="mb-2 block text-xs font-medium text-slate-500">
        {label}
        <input
          aria-label={label}
          type={numeric ? "number" : "text"}
          min={numeric ? 0 : undefined}
          step={numeric ? "any" : undefined}
          value={field.value ?? ""}
          placeholder="정보 없음"
          onChange={(event) => {
            const raw = event.target.value;
            const value = raw === "" ? null : numeric ? Number(raw) : raw;
            if (
              typeof value !== "number" ||
              (Number.isFinite(value) && value >= 0)
            )
              onChange(value);
          }}
          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 transition focus:border-blue-500 focus:outline-2 focus:outline-blue-100"
        />
      </label>
      <button
        type="button"
        onClick={onEvidence}
        className={`inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold ${statusColors[field.status]}`}
        title="근거 후보와 PDF 원문 보기"
      >
        {field.status === "verified" ? <Check size={11} /> : <Info size={11} />}
        {field.status === "missing" && missingLabel
          ? missingLabel
          : statusLabels[field.status]}
        <ChevronRight size={11} />
      </button>
    </div>
  );
}
