import { labelRole } from "../layout/relations";
import type { GroundedDocument, GroundedField } from "../documents/schema";
import { check, known, hasValue, sameText, type ReviewCheck } from "./model";
type ReferenceKind =
  | "invoiceReference"
  | "purchaseOrder"
  | "shipmentReference"
  | "bookingReference"
  | "transactionReference";
export function referenceKind(
  field: GroundedField<string> | undefined,
): ReferenceKind | null {
  if (!field?.source) return null;
  const allowed: ReferenceKind[] = [
    "invoiceReference",
    "purchaseOrder",
    "shipmentReference",
    "bookingReference",
    "transactionReference",
  ];
  if (allowed.includes(field.source.semanticRole as ReferenceKind))
    return field.source.semanticRole as ReferenceKind;
  const roles = new Set(
    (
      field.source.blocks?.map((b) => b.text) ??
      field.source.quote.split(/\r?\n/)
    )
      .map((t) => labelRole(t.split(":")[0]))
      .filter((r) => allowed.includes(r as ReferenceKind)),
  );
  return roles.size === 1 ? ([...roles][0] as ReferenceKind) : null;
}
export function reviewReferences(
  invoice: GroundedDocument,
  packing: GroundedDocument,
) {
  const checks: ReviewCheck[] = [];
  let conflict = false,
    supported = false,
    edited = false;
  const kinds: ReferenceKind[] = [
    "invoiceReference",
    "purchaseOrder",
    "shipmentReference",
    "bookingReference",
    "transactionReference",
  ];
  const labels = [
    "Invoice 참조번호",
    "Purchase Order 번호",
    "선적 참조번호",
    "Booking 참조번호",
    "기타 거래 참조",
  ];
  kinds.forEach((kind, index) => {
    const fields = (doc: GroundedDocument) => {
      const candidates = [
        kind === "transactionReference"
          ? referenceKind(doc.transactionReference) === kind
            ? doc.transactionReference
            : undefined
          : doc[kind],
        referenceKind(doc.transactionReference) === kind
          ? doc.transactionReference
          : undefined,
        kind === "invoiceReference" && doc.type === "invoice"
          ? doc.documentNumber
          : undefined,
      ].filter((f): f is GroundedField<string> => !!f && hasValue(f));
      // A typed field already passed its role-specific grounder. An ambiguous
      // generic reference never acquires a namespace just from its characters.
      const distinct = new Set(
        candidates
          .filter(known)
          .map((f) => f.value!.normalize("NFKC").trim().toLowerCase()),
      );
      if (distinct.size > 1) conflict = true;
      if (candidates.some((f) => f.status === "user_edited")) edited = true;
      return {
        field: candidates.find(known) ?? candidates[0],
        ambiguous: distinct.size > 1,
      };
    };
    const a = fields(invoice),
      b = fields(packing);
    if (
      kind === "transactionReference" &&
      !referenceKind(invoice.transactionReference) &&
      !referenceKind(packing.transactionReference)
    ) {
      if (
        hasValue(invoice.transactionReference) ||
        hasValue(packing.transactionReference)
      )
        checks.push(
          check({
            id: "reference-ambiguous",
            category: "reference",
            scope: "cross",
            assessment: "needs_review",
            title: "거래 참조의 의미 확인 필요",
            explanation:
              "참조 값은 있지만 원문 라벨의 의미가 명확하지 않아 PO나 Invoice 번호로 재분류하지 않았습니다.",
            question: "이 번호가 주문·송장·선적 중 무엇을 참조하나요?",
            item: null,
            fields: [
              {
                label: "Invoice 거래 참조",
                field: invoice.transactionReference,
              },
              {
                label: "Packing List 거래 참조",
                field: packing.transactionReference,
              },
            ],
          }),
        );
      return;
    }
    const both = known(a.field) && known(b.field);
    const equal =
      hasValue(a.field) &&
      hasValue(b.field) &&
      sameText(a.field!.value!, b.field!.value!);
    const collision = a.ambiguous || b.ambiguous || (both && !equal);
    if (collision) conflict = true;
    if (
      both &&
      equal &&
      !collision &&
      ["invoiceReference", "purchaseOrder"].includes(kind)
    )
      supported = true;
    checks.push(
      check({
        id: `reference-${kind}`,
        category: "reference",
        scope: "cross",
        assessment: collision
          ? "needs_review"
          : !hasValue(a.field) || !hasValue(b.field)
            ? "insufficient_information"
            : both
              ? "confirmed_match"
              : "needs_review",
        title: collision
          ? `${labels[index]} 충돌 · 거래 확인 필요`
          : `${labels[index]} 대조`,
        explanation: collision
          ? "같은 의미의 원문 참조 값이 충돌합니다. 서로 다른 거래·서류 버전일 수 있어 거래에 의존하는 판정은 잠정 결과로 보호합니다. 품목 비교는 계속합니다."
          : equal && both
            ? "같은 의미의 라벨과 번호가 양쪽 원문에서 확인됩니다."
            : "양쪽의 같은 의미 참조를 원문에서 모두 확인하지 못했습니다. 다른 의미의 번호끼리 비교하거나 누락을 오류로 처리하지 않습니다.",
        question: collision
          ? "같은 주문·Invoice·선적의 최종 문서인가요? 발행자에게 참조번호를 확인해 주세요."
          : "이 참조가 필요한 경우 같은 의미의 번호를 발행자에게 확인해 주세요.",
        item: null,
        leftValue: a.field?.value,
        rightValue: b.field?.value,
        referenceWarning: collision,
        fields: [
          ...(a.field
            ? [{ label: `Invoice ${labels[index]}`, field: a.field }]
            : []),
          ...(b.field
            ? [{ label: `Packing List ${labels[index]}`, field: b.field }]
            : []),
        ],
      }),
    );
  });
  return { checks, conflict, supported, edited };
}
