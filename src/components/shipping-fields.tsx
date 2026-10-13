"use client";
import { EditableField } from "./editable-field";
import {
  editShippingField,
  restoreShippingField,
} from "@/modules/shipping/edit";
import type {
  ShippingDocument,
  ShippingField,
} from "@/modules/shipping/schema";
import {
  shippingLabels,
  shippingFieldLabels,
} from "@/modules/shipping/catalog";
import type { GroundedField } from "@/modules/documents/schema";
export function ShippingFields({
  document: doc,
  onUpdate,
  onEvidence,
}: {
  document: ShippingDocument;
  onUpdate: (doc: ShippingDocument) => void;
  onEvidence: (field: GroundedField<string | number>, label: string) => void;
}) {
  const title =
    doc.fieldType === null
      ? "분류 미확인 문서"
      : shippingLabels[doc.fieldType ?? doc.uploadType].title;
  function restore() {
    onUpdate({
      ...doc,
      fields: Object.fromEntries(
        Object.entries(doc.fields).map(([k, f]) => [
          k,
          restoreShippingField(f),
        ]),
      ),
      items: doc.items.map((i) => ({
        ...i,
        fields: Object.fromEntries(
          Object.entries(i.fields).map(([k, f]) => [
            k,
            restoreShippingField(f),
          ]),
        ),
      })),
      cargoRecords: doc.cargoRecords.map((i) => ({
        ...i,
        fields: Object.fromEntries(
          Object.entries(i.fields).map(([k, f]) => [
            k,
            restoreShippingField(f),
          ]),
        ),
      })),
      containers: doc.containers.map((c) => ({
        ...c,
        ...Object.fromEntries(
          Object.entries(c)
            .filter(([k]) => !["id", "sealNumbers"].includes(k))
            .map(([k, f]) => [k, restoreShippingField(f as ShippingField)]),
        ),
        sealNumbers: c.sealNumbers?.map(restoreShippingField),
      })),
      references: doc.references.map((r) => ({
        ...r,
        number: restoreShippingField(r.number),
      })),
      additionalFields: doc.additionalFields.map((f) => ({
        ...f,
        field: restoreShippingField(f.field),
      })),
    });
  }
  const group = (
    label: string,
    fields: Record<string, ShippingField>,
    update: (key: string, field: ShippingField) => void,
  ) => (
    <div key={label} className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Object.entries(fields).map(([key, f]) => (
        <EditableField
          key={key}
          label={`${label} · ${shippingFieldLabels[key as keyof typeof shippingFieldLabels] ?? (key === "weightUnit" ? "중량 단위" : key)}`}
          field={f.current}
          numeric={
            typeof f.original.value === "number" ||
            [
              "quantity",
              "packageCount",
              "grossWeight",
              "netWeight",
              "declaredWeight",
            ].includes(key)
          }
          missingLabel={
            doc.extractionStatus === "not_performed" ? "AI 미추출" : undefined
          }
          onChange={(value) => update(key, editShippingField(f, value))}
          onEvidence={() =>
            onEvidence(
              f.current,
              `${label} · ${shippingFieldLabels[key as keyof typeof shippingFieldLabels] ?? (key === "weightUnit" ? "중량 단위" : key)}`,
            )
          }
        />
      ))}
    </div>
  );
  return (
    <details className="mt-5 rounded-xl border border-slate-200 p-4">
      <summary className="cursor-pointer text-xs font-semibold">
        {doc.extractionStatus === "not_performed"
          ? "문서별 필드 확인·사용자 입력 (AI 추출 미실시)"
          : "AI 추출값·원문 근거 확인 및 수정"}
      </summary>
      <p className="mt-3 text-xs leading-6 text-slate-500">
        {doc.extractionStatus === "not_performed"
          ? "아직 추출된 AI 값이 없습니다. "
          : ""}
        AI 추출값은 후보입니다. 사용자 수정값은 원래 값과 분리하며 수정값의 원문
        검증 성공이나 서류 간 대조 완료로 표시하지 않습니다.
      </p>
      {doc.classification && (
        <button
          className="mt-4 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700"
          onClick={() =>
            onEvidence(doc.classification!.current, "문서 유형 분류 근거")
          }
        >
          문서 분류의 원문 근거 보기
        </button>
      )}
      {doc.informationWarnings.length > 0 && (
        <ul className="mt-4 rounded-lg bg-amber-50 p-4 text-xs leading-6 text-amber-800">
          {doc.informationWarnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      {group(title, doc.fields, (key, field) =>
        onUpdate({ ...doc, fields: { ...doc.fields, [key]: field } }),
      )}
      {doc.items.map((item, i) => (
        <details
          key={item.id}
          className="mt-4 rounded-lg border border-slate-200 p-3"
        >
          <summary className="cursor-pointer text-xs font-semibold">
            품목 {i + 1} ·{" "}
            {item.fields.goodsDescription.current.value ??
              item.fields.tradeDescription?.current.value ??
              "품명 미확인"}
          </summary>
          {group(`품목 ${i + 1}`, item.fields, (key, field) =>
            onUpdate({
              ...doc,
              items: doc.items.map((row) =>
                row.id === item.id
                  ? { ...row, fields: { ...row.fields, [key]: field } }
                  : row,
              ),
            }),
          )}
        </details>
      ))}
      {doc.containers.map((container, i) => (
        <details
          key={container.id}
          className="mt-4 rounded-lg border border-slate-200 p-3"
        >
          <summary className="cursor-pointer text-xs font-semibold">
            컨테이너 {i + 1} ·{" "}
            {container.containerNumber.current.value ?? "번호 미확인"}
          </summary>
          {group(
            `컨테이너 ${i + 1}`,
            Object.fromEntries(
              Object.entries(container).filter(
                ([key]) => !["id", "sealNumbers"].includes(key),
              ),
            ) as Record<string, ShippingField>,
            (key, field) =>
              onUpdate({
                ...doc,
                containers: doc.containers.map((c) =>
                  c.id === container.id ? { ...c, [key]: field } : c,
                ),
              }),
          )}
          {container.sealNumbers?.map((seal, n) =>
            group(
              `컨테이너 ${i + 1} · Seal ${n + 1}`,
              { sealNumber: seal },
              (_, field) =>
                onUpdate({
                  ...doc,
                  containers: doc.containers.map((c) =>
                    c.id === container.id
                      ? {
                          ...c,
                          sealNumbers: c.sealNumbers?.map((s, j) =>
                            j === n ? field : s,
                          ),
                        }
                      : c,
                  ),
                }),
            ),
          )}
        </details>
      ))}
      {doc.cargoRecords.map((record, i) => (
        <details
          key={record.id}
          className="mt-4 rounded-lg border border-slate-200 p-3"
        >
          <summary className="cursor-pointer text-xs font-semibold">
            화물 기록 {i + 1} ·{" "}
            {record.fields.houseBlNumber.current.value ?? "House B/L 미확인"}
          </summary>
          {group(`화물 ${i + 1}`, record.fields, (key, field) =>
            onUpdate({
              ...doc,
              cargoRecords: doc.cargoRecords.map((row) =>
                row.id === record.id
                  ? { ...row, fields: { ...row.fields, [key]: field } }
                  : row,
              ),
            }),
          )}
        </details>
      ))}
      {doc.references.map((r, i) =>
        group(`참조 ${i + 1} (${r.kind})`, { 참조번호: r.number }, (_, field) =>
          onUpdate({
            ...doc,
            references: doc.references.map((ref) =>
              ref.id === r.id ? { ...ref, number: field } : ref,
            ),
          }),
        ),
      )}
      {doc.additionalFields.map((extra) =>
        group(
          `추가 필드 · ${extra.label}`,
          { [extra.meaning]: extra.field },
          (_, field) =>
            onUpdate({
              ...doc,
              additionalFields: doc.additionalFields.map((e) =>
                e.id === extra.id ? { ...e, field } : e,
              ),
            }),
        ),
      )}
      <button
        onClick={restore}
        className="mt-5 rounded-lg border border-slate-200 px-3 py-2 text-xs"
      >
        {doc.extractionStatus === "not_performed"
          ? "사용자 입력 초기화"
          : "원래 AI 추출값 복원"}
      </button>
    </details>
  );
}
