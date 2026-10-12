import type { GroundedDocument, GroundedField } from "../documents/schema";
import {
  check,
  known,
  hasValue,
  canonicalUnit,
  packageUnit,
  type ReviewCheck,
} from "./model";
export function reviewDocument(doc: GroundedDocument): ReviewCheck[] {
  const checks: ReviewCheck[] = [];
  const precision: Record<string, number> = {
    USD: 2,
    EUR: 2,
    GBP: 2,
    CNY: 2,
    JPY: 0,
    KRW: 0,
  };
  const digits = doc.currency.value
    ? precision[doc.currency.value.toUpperCase()]
    : undefined;
  const tolerance = digits === undefined ? 0 : 0.5 * 10 ** -digits;
  const add = (
    id: string,
    title: string,
    left: GroundedField<number> | undefined,
    right: GroundedField<number> | undefined,
    valid: boolean,
    unit: string | null,
    contextValid = true,
  ) => {
    checks.push(
      check({
        id: `${doc.id}-${id}`,
        scope: "document",
        category: "weight",
        assessment:
          !hasValue(left) || !hasValue(right)
            ? "insufficient_information"
            : known(left) && known(right) && unit && contextValid
              ? valid
                ? "confirmed_match"
                : "confirmed_mismatch"
              : valid
                ? "provisional_match"
                : "provisional_mismatch",
        title,
        explanation:
          !hasValue(left) || !hasValue(right)
            ? "비교할 값이 명시되지 않았습니다. 값이나 중량 단위를 추정하지 않습니다."
            : "동일 문서·상품의 순중량과 총중량을 같은 단위로 대조합니다. 총중량은 순중량보다 작을 수 없습니다. 원문/단위가 미확인 또는 사용자 수정이면 잠정 결과입니다.",
        question:
          "같은 상품·단위의 순중량과 포장을 포함한 총중량인가요? 원문 또는 수정 서류를 확인해 주세요.",
        item: null,
        leftValue: left?.value,
        rightValue: right?.value,
        unit: unit ?? undefined,
        fields: [
          ...(left ? [{ label: `${doc.fileName} 순중량`, field: left }] : []),
          ...(right ? [{ label: `${doc.fileName} 총중량`, field: right }] : []),
        ],
      }),
    );
  };
  const number = (f: GroundedField<number> | undefined) => f?.value ?? NaN;
  doc.items.forEach((item, index) => {
    const weightUnit = canonicalUnit(item.weightUnit.value);
    const unitsAgree = [item.netWeight, item.grossWeight].every(
      (f) =>
        !f.source?.layout?.unit ||
        canonicalUnit(f.source.layout.unit) === weightUnit,
    );
    add(
      `weight-${index}`,
      `${item.description.value ?? `품목 ${index + 1}`} · 총중량 ≥ 순중량`,
      item.netWeight,
      item.grossWeight,
      number(item.grossWeight) >= number(item.netWeight),
      weightUnit,
      known(item.weightUnit) && unitsAgree,
    );
    if (doc.type === "invoice") {
      const a = item.quantity,
        b = item.unitPrice,
        c = item.amount;
      const expected = hasValue(a) && hasValue(b) ? number(a) * number(b) : NaN;
      const equal =
        hasValue(c) &&
        Number.isFinite(expected) &&
        Math.abs(expected - number(c)) <= tolerance;
      const fields = [
        { label: "상품 수량", field: a },
        ...(b ? [{ label: "단가", field: b }] : []),
        { label: "품목 금액", field: c },
        { label: "통화", field: doc.currency },
      ];
      checks.push(
        check({
          id: `${doc.id}-line-amount-${index}`,
          scope: "document",
          category: "arithmetic",
          assessment:
            !hasValue(a) || !hasValue(b) || !hasValue(c)
              ? "insufficient_information"
              : equal &&
                  digits !== undefined &&
                  [a, b, c, doc.currency].every(known)
                ? "confirmed_match"
                : equal
                  ? "provisional_match"
                  : "provisional_mismatch",
          title: `${item.description.value ?? `품목 ${index + 1}`} · 수량 × 단가`,
          explanation: !Number.isFinite(expected)
            ? "단가/수량/금액 중 명시되지 않은 항목이 있어 산술 검증하지 않았습니다."
            : `수량 × 단가 = ${expected.toLocaleString("en-US", { maximumFractionDigits: 6 })}. 할인·세금·가격 단위·반올림의 정의가 불명확한 차이는 확정 금액 오류로 판정하지 않습니다.`,
          question:
            "단가가 상품 수량 1단위 기준인가요? 품목 금액에 할인·세금·반올림이 포함되나요?",
          item: item.description.value,
          leftValue: Number.isFinite(expected) ? expected : null,
          rightValue: c.value,
          unit: doc.currency.value ?? undefined,
          fields,
        }),
      );
    }
    if (hasValue(item.packageQuantity))
      checks.push(
        check({
          id: `${doc.id}-packages-${index}`,
          category: "packaging",
          scope: "document",
          assessment:
            known(item.packageQuantity) &&
            known(item.packageUnit) &&
            packageUnit(item.packageUnit?.value)
              ? "confirmed_match"
              : "needs_review",
          title: `${item.description.value ?? `품목 ${index + 1}`} · 포장 수량/단위`,
          explanation:
            "포장 개수는 상품 PCS 수량과 별도로 검토합니다. 박스당 상품 수량을 추정하거나 CTNS를 PCS로 변환하지 않습니다.",
          question: "포장 개수와 포장 단위가 같은 항목에 기재되었나요?",
          item: item.description.value,
          leftValue: item.packageQuantity?.value,
          rightValue: item.packageUnit?.value,
          fields: [
            { label: "포장 수량", field: item.packageQuantity! },
            ...(item.packageUnit
              ? [{ label: "포장 단위", field: item.packageUnit }]
              : []),
          ],
        }),
      );
  });
  if (hasValue(doc.totalNetWeight) || hasValue(doc.totalGrossWeight))
    add(
      "total-weights",
      "문서 총중량 ≥ 총 순중량",
      doc.totalNetWeight,
      doc.totalGrossWeight,
      number(doc.totalGrossWeight) >= number(doc.totalNetWeight),
      canonicalUnit(doc.totalWeightUnit?.value),
      known(doc.totalWeightUnit),
    );
  if (doc.type === "invoice") {
    const amounts = doc.items.map((i) => i.amount),
      sum = amounts.reduce((n, f) => n + (f.value ?? 0), 0);
    const total = hasValue(doc.subtotalAmount)
      ? doc.subtotalAmount
      : doc.totalAmount;
    const complete =
      amounts.length > 0 && amounts.every(hasValue) && hasValue(total);
    const equal = complete && Math.abs(sum - number(total)) <= tolerance;
    const basisKnown =
      total === doc.subtotalAmount &&
      total?.source?.semanticRole === "subtotalAmount" &&
      [doc.discountAmount, doc.freightAmount, doc.taxAmount].every(
        (f) => known(f) && f?.value === 0,
      );
    checks.push(
      check({
        id: `${doc.id}-amount-total`,
        scope: "document",
        category: "arithmetic",
        assessment: !complete
          ? "insufficient_information"
          : amounts.every(known) &&
              known(total) &&
              known(doc.currency) &&
              digits !== undefined &&
              basisKnown
            ? equal
              ? "confirmed_match"
              : "provisional_mismatch"
            : equal
              ? "provisional_match"
              : "provisional_mismatch",
        title: "Invoice 품목 금액 합계 / 소계·총액",
        explanation: !complete
          ? "모든 품목 금액과 비교할 명시적 총액이 필요합니다. Packing List에 금액이 없는 것은 오류가 아닙니다."
          : `품목 금액 합계 ${sum.toLocaleString("en-US")}. 총액 정의·할인·운임·세금이 확인되지 않은 차이는 잠정 결과입니다. 소계와 최종 청구액을 섞지 않습니다.`,
        question:
          "비교한 총액은 상품 소계인가요, 할인·운임·세금을 포함한 청구 총액인가요?",
        item: null,
        leftValue: complete ? sum : null,
        rightValue: total?.value,
        unit: doc.currency.value ?? undefined,
        fields: [
          ...amounts.map((f, i) => ({ label: `품목 ${i + 1} 금액`, field: f })),
          ...(total ? [{ label: "소계/총액", field: total }] : []),
          { label: "통화", field: doc.currency },
        ],
      }),
    );
  }
  for (const [title, total, unit, rows] of [
    [
      "총 상품 수량",
      doc.totalQuantity,
      doc.totalQuantityUnit,
      doc.items.map((i) => ({ value: i.quantity, unit: i.unit })),
    ],
    [
      "총 포장 수량",
      doc.totalPackages,
      doc.packageUnit,
      doc.items.map((i) => ({ value: i.packageQuantity, unit: i.packageUnit })),
    ],
  ] as const)
    if (hasValue(total)) {
      const canonical = title === "총 상품 수량" ? canonicalUnit : packageUnit;
      const complete =
        rows.length > 0 &&
        rows.every(
          (r) =>
            hasValue(r.value) &&
            known(r.unit) &&
            canonical(r.unit?.value) === canonical(unit?.value),
        ) &&
        known(unit) &&
        !!canonical(unit?.value);
      const sum = rows.reduce((n, r) => n + (r.value?.value ?? 0), 0),
        equal = sum === total!.value;
      checks.push(
        check({
          id: `${doc.id}-${title}`,
          category: title === "총 상품 수량" ? "quantity" : "packaging",
          scope: "document",
          assessment: !complete
            ? "insufficient_information"
            : known(total) && rows.every((r) => known(r.value))
              ? equal
                ? "confirmed_match"
                : "confirmed_mismatch"
              : equal
                ? "provisional_match"
                : "provisional_mismatch",
          title: `문서별 ${title} 합계`,
          explanation:
            "각 품목과 문서 총계가 같은 단위·개념으로 명시된 경우만 합산합니다. 상품 수량과 포장 개수를 섞지 않습니다.",
          question:
            "이 총계는 모든 상품 행을 포함하나요? 추가 행·포장 단위가 있는지 확인해 주세요.",
          item: null,
          leftValue: complete ? sum : null,
          rightValue: total!.value,
          unit: unit?.value ?? undefined,
          fields: [
            { label: title, field: total! },
            ...rows
              .filter((r) => r.value)
              .map((r, i) => ({ label: `품목 ${i + 1}`, field: r.value! })),
          ],
        }),
      );
    }
  const required = [doc.seller, doc.buyer, doc.documentNumber];
  checks.push(
    check({
      id: `${doc.id}-required`,
      scope: "document",
      category: "required",
      assessment:
        required.every(known) && doc.items.length > 0
          ? "confirmed_match"
          : required.some((f) => !hasValue(f)) || !doc.items.length
            ? "insufficient_information"
            : "needs_review",
      title: `${doc.fileName} · 기본 정보 명시 여부`,
      explanation:
        "판매자·구매자·자체 문서번호·상품 행의 명시 여부를 확인합니다. 문서 유형별 정보 차이를 동일 필드 누락 오류로 취급하지 않습니다.",
      question:
        "없는 정보가 업무상 필요한 경우 발행자에게 보완을 요청해 주세요.",
      item: null,
      fields: [
        { label: "판매자", field: doc.seller },
        { label: "구매자", field: doc.buyer },
        { label: "문서 자체 번호", field: doc.documentNumber },
      ],
    }),
  );
  return checks;
}
