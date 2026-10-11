"use client";
import type {
  GroundedDocument,
  GroundedField,
} from "@/modules/documents/schema";
import { EditableField } from "./editable-field";
import { editField } from "@/modules/evidence/verify";
const extras = [
  ["subtotalAmount", "상품 소계"],
  ["discountAmount", "할인 금액"],
  ["freightAmount", "운임"],
  ["taxAmount", "세금"],
  ["totalNetWeight", "문서 총 순중량"],
  ["totalGrossWeight", "문서 총중량"],
  ["totalWeightUnit", "총 중량 단위"],
  ["totalPackages", "총 포장 개수"],
  ["packageUnit", "총 포장 단위"],
  ["totalQuantity", "총 상품 수량"],
  ["totalQuantityUnit", "총 상품 단위"],
] as const;
export function DocumentExtras({
  doc,
  onChange,
  onEvidence,
}: {
  doc: GroundedDocument;
  onChange: (update: (current: GroundedDocument) => GroundedDocument) => void;
  onEvidence: (field: GroundedField<string | number>, label: string) => void;
}) {
  return (
    <details className="mt-5 rounded-xl border border-slate-200 p-4">
      <summary className="cursor-pointer text-xs font-semibold text-slate-600">
        문서 총계·할인·운임·세금 확인 및 수정
      </summary>
      <p className="mt-3 text-[11px] leading-5 text-slate-500">
        명시된 필드만 확인합니다. 없는 항목은 정보 부족이며 0으로 추정하지
        않습니다. 사용자 입력은 원문 검증 성공으로 표시하지 않습니다.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {extras.map(([key, label]) => {
          const field = doc[key] ?? {
            value: null,
            status: "missing" as const,
            source: null,
            reason: "문서에 명시된 값 없음",
          };
          return (
            <EditableField
              key={key}
              label={label}
              field={field}
              numeric={
                ![
                  "totalWeightUnit",
                  "packageUnit",
                  "totalQuantityUnit",
                ].includes(key)
              }
              onEvidence={() => onEvidence(field, label)}
              onChange={(value) =>
                onChange((current) => ({
                  ...current,
                  [key]: editField<string | number>(
                    current[key] ?? field,
                    value,
                  ),
                }))
              }
            />
          );
        })}
      </div>
    </details>
  );
}
