import type { GroundedDocument } from "../documents/schema";
import {
  compareQuantities,
  selectPair,
  pairContext,
  type PairSelection,
} from "./quantity";
import {
  check,
  known,
  hasValue,
  sameText,
  canonicalUnit,
  packageUnit,
  assessPair,
  type ReviewCheck,
} from "./model";
import { matchItem } from "./items";
import { reviewDocument } from "./document";
export function reviewDocuments(
  documents: GroundedDocument[],
  selection?: PairSelection,
) {
  const pair = selectPair(documents, selection);
  const quantity = compareQuantities(documents, selection);
  const checks: ReviewCheck[] = [];
  if (pair) {
    const { invoice, packing } = pair,
      context = pairContext(invoice, packing);
    checks.push(...context.references.checks);
    for (const key of ["seller", "buyer"] as const) {
      const a = invoice[key],
        b = packing[key],
        equal = hasValue(a) && hasValue(b) && sameText(a.value!, b.value!);
      const collision = known(a) && known(b) && !equal;
      checks.push(
        check({
          id: `party-${key}`,
          category: "party",
          scope: "cross",
          assessment: collision ? "needs_review" : assessPair(a, b, !!equal),
          title: `${key === "seller" ? "판매자" : "구매자"} 대조${collision ? " · 서로 다른 거래 가능성" : ""}`,
          explanation: collision
            ? "원문 당사자 이름이 다릅니다. 선택 의도는 수락하지만 실제 동일 거래로 확정하지 않습니다. 품목 수치는 잠정 비교합니다."
            : "같은 당사자 필드끼리 비교합니다. 미확인·수정값은 확정된 동일성을 입증하지 않습니다.",
          question: "동일한 거래당사자의 최종 문서인지 확인해 주세요.",
          item: null,
          leftValue: a.value,
          rightValue: b.value,
          fields: [
            { label: "Invoice", field: a },
            { label: "Packing List", field: b },
          ],
        }),
      );
    }
    const matches = invoice.items.map((row) =>
      matchItem(row, invoice.items, packing.items),
    );
    matches.forEach((m, index) => {
      if (
        !("row" in m) ||
        !m.row ||
        matches.filter((n) => "index" in n && n.index === m.index).length !== 1
      )
        return;
      const a = invoice.items[index],
        b = m.row;
      const safe = !m.tentative && [a.description, b.description].every(known);
      checks.push(
        check({
          id: `product-${index}`,
          category: "product",
          scope: "cross",
          assessment: safe ? "confirmed_match" : "needs_review",
          title: `${a.description.value} · 품목 대응`,
          explanation: m.reason,
          question:
            "동일한 SKU·규격·상품인가요? 중복 품명은 임의 연결하지 않습니다.",
          item: a.description.value,
          leftValue: a.sku?.value ?? a.description.value,
          rightValue: b.sku?.value ?? b.description.value,
          fields: [
            { label: "Invoice 품명", field: a.description },
            { label: "Packing List 품명", field: b.description },
            ...(a.sku ? [{ label: "Invoice SKU", field: a.sku }] : []),
            ...(b.sku ? [{ label: "Packing List SKU", field: b.sku }] : []),
          ],
        }),
      );
      const ua = canonicalUnit(a.unit.value),
        ub = canonicalUnit(b.unit.value);
      checks.push(
        check({
          id: `unit-${index}`,
          category: "unit",
          scope: "cross",
          assessment:
            !hasValue(a.unit) || !hasValue(b.unit)
              ? "insufficient_information"
              : !ua || ua !== ub
                ? "needs_review"
                : assessPair(a.unit, b.unit, true),
          title: `${a.description.value} · 상품 수량 단위`,
          explanation:
            "PCS/EA의 명시적 상품 단위만 동의어로 정규화합니다. CTNS·KG를 PCS로 환산하지 않습니다.",
          question: "수량 단위가 상품 개수인지 포장·중량인지 확인해 주세요.",
          item: a.description.value,
          leftValue: a.unit.value,
          rightValue: b.unit.value,
          fields: [
            { label: "Invoice 단위", field: a.unit },
            { label: "Packing List 단위", field: b.unit },
          ],
        }),
      );
      for (const key of [
        "netWeight",
        "grossWeight",
        "packageQuantity",
      ] as const) {
        const left = a[key],
          right = b[key];
        if (!hasValue(left) && !hasValue(right)) continue;
        const unit =
          key === "packageQuantity"
            ? packageUnit(a.packageUnit?.value)
            : canonicalUnit(a.weightUnit.value);
        const otherUnit =
          key === "packageQuantity"
            ? packageUnit(b.packageUnit?.value)
            : canonicalUnit(b.weightUnit.value);
        const unitsKnown =
          key === "packageQuantity"
            ? known(a.packageUnit) && known(b.packageUnit)
            : known(a.weightUnit) && known(b.weightUnit);
        const blockers = [
          ...context.blockers,
          ...(!safe ? ["품목 대응 미확인"] : []),
          ...(!unitsKnown ? ["단위 근거 미확인"] : []),
        ];
        checks.push(
          check({
            id: `${key}-${index}`,
            category: key === "packageQuantity" ? "packaging" : "weight",
            scope: "cross",
            assessment:
              !hasValue(left) || !hasValue(right)
                ? "insufficient_information"
                : !unit || unit !== otherUnit
                  ? "needs_review"
                  : assessPair(
                      left,
                      right,
                      left!.value === right!.value,
                      blockers,
                    ),
            title: `${a.description.value} · ${key === "netWeight" ? "순중량" : key === "grossWeight" ? "총중량" : "포장 개수"} 대조`,
            explanation: blockers.length
              ? blockers.join(" · ")
              : "동일 품목·단위·선적 범위의 같은 의미 항목을 비교합니다.",
            question: "동일한 상품·포장·선적 범위의 값인가요?",
            item: a.description.value,
            leftValue: left?.value,
            rightValue: right?.value,
            unit: unit ?? undefined,
            fields: [
              ...(left ? [{ label: "Invoice", field: left }] : []),
              ...(right ? [{ label: "Packing List", field: right }] : []),
            ],
          }),
        );
      }
    });
  }
  checks.push(...quantity, ...documents.flatMap(reviewDocument));
  const summary = {
    analyzedDocuments: documents.length,
    comparedItems: quantity.filter(
      (c) =>
        c.invoiceQuantity !== undefined &&
        c.packingQuantity !== undefined &&
        !!c.unit,
    ).length,
    confirmedMatches: checks.filter((c) => c.assessment === "confirmed_match")
      .length,
    confirmedMismatches: checks.filter(
      (c) => c.assessment === "confirmed_mismatch",
    ).length,
    provisionalOrReview: checks.filter(
      (c) =>
        c.assessment.startsWith("provisional_") ||
        c.assessment === "needs_review",
    ).length,
    insufficientInformation: checks.filter(
      (c) => c.assessment === "insufficient_information",
    ).length,
    referenceWarning: checks.some((c) => c.referenceWarning),
    confirmedQuantityMatches: quantity.filter(
      (c) => c.assessment === "confirmed_match",
    ).length,
    confirmedQuantityMismatches: quantity.filter(
      (c) => c.assessment === "confirmed_mismatch",
    ).length,
  };
  return {
    checks,
    quantityChecks: quantity,
    summary,
    status: !documents.length
      ? ("not_started" as const)
      : !pair
        ? ("insufficient_documents" as const)
        : quantity.some((c) => c.assessment === "insufficient_information") ||
            checks.some(
              (c) =>
                c.scope === "cross" &&
                (c.assessment.startsWith("provisional_") ||
                  c.assessment === "needs_review"),
            )
          ? ("needs_review" as const)
          : ("complete" as const),
    selection: selection ? ("user_selected" as const) : ("classified" as const),
  };
}
