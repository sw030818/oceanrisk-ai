import type {
  Evidence,
  ExtractedDocument,
  GroundedDocument,
  GroundedField,
  PdfDocument,
} from "../documents/schema";
export function normalizeText(text: string): string {
  return text.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}
function numericTokens(text: string): number[] {
  // Decimal-comma and irregular grouping are deliberately ambiguous, never guessed.
  return (text.match(/(?<![\w.])[-+]?\d+(?:[.,]\d+)*(?![\w.])/g) ?? [])
    .filter((token) =>
      /^[-+]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(token),
    )
    .map((token) => Number(token.replaceAll(",", "")));
}
export function verifyField<T extends string | number>(
  field: { value: T | null; evidence: Evidence | null },
  pdf: PdfDocument,
  role?: "quantity" | "seller" | "buyer" | "transactionReference",
): GroundedField<T> {
  const source = field.evidence
    ? { fileId: pdf.id, fileName: pdf.fileName, ...field.evidence }
    : null;
  const base = { value: field.value, source };
  if (field.value === null || field.value === "")
    return {
      ...base,
      status: "missing",
      reason: "문서에서 확인할 수 없는 값입니다.",
    };
  if (!field.evidence)
    return {
      ...base,
      status: "unverified",
      reason: "원문 근거 후보가 없습니다.",
    };
  const page = pdf.pages.find((page) => page.page === field.evidence!.page);
  const quote = normalizeText(field.evidence.quote);
  if (!page || !quote || !normalizeText(page.text).includes(quote))
    return {
      ...base,
      status: "unverified",
      reason: "근거 문구가 해당 페이지 원문과 일치하지 않습니다.",
    };
  const valuePresent =
    typeof field.value === "number"
      ? numericTokens(quote).includes(field.value)
      : quote.includes(normalizeText(field.value));
  if (!valuePresent)
    return {
      ...base,
      status: "unverified",
      reason: "원문 근거에서 추출값을 확인하지 못했습니다.",
    };
  if (
    role === "quantity" &&
    (!/(?:quantity|qty|수량)/i.test(quote) ||
      /(?:cartons?|ctns?|packages?|no\.? of packs|포장|박스|상자|중량|weight|amount)/i.test(
        quote,
      ))
  )
    return {
      ...base,
      status: "unverified",
      reason:
        "상품 수량 근거인지 명확하지 않습니다. 포장 개수·중량과 구분해 주세요.",
    };
  if (role === "quantity") {
    const values = [
      ...quote.matchAll(/(?:quantity|qty|수량)\s*[:=-]?\s*([-+]?\d[\d.,]*)/g),
    ].flatMap((match) => numericTokens(match[1]));
    if (!values.length || values.some((value) => value !== field.value))
      return {
        ...base,
        status: "unverified",
        reason:
          "수량 라벨 바로 옆의 수치와 추출값이 명확하게 일치하지 않습니다.",
      };
  }
  if (role === "seller" || role === "buyer") {
    const label =
      role === "seller"
        ? /(?:seller|exporter|shipper|판매자|수출자)\s*[:=-]\s*/
        : /(?:buyer|importer|consignee|구매자|수입자)\s*[:=-]\s*/;
    const match = label.exec(quote);
    if (
      !match ||
      quote.slice(match.index + match[0].length).trim() !==
        normalizeText(String(field.value))
    )
      return {
        ...base,
        status: "unverified",
        reason:
          "거래당사자 역할과 값을 원문 라벨에서 명확하게 확인하지 못했습니다.",
      };
  }
  if (
    role === "transactionReference" &&
    !/(?:order reference|purchase order|order no|p\.?o\.?\s*(?:no|number|#)|invoice reference|invoice no|주문 번호|거래 참조)\s*[:=#-]/.test(
      quote,
    )
  )
    return {
      ...base,
      status: "unverified",
      reason:
        "같은 거래를 연결하는 주문/Invoice 참조 근거가 명확하지 않습니다.",
    };
  return {
    ...base,
    status: "verified",
    reason:
      "원문 위치와 값이 대조되었습니다. 문서 자체의 진실성을 보증하지는 않습니다.",
  };
}
export function groundDocument(
  data: ExtractedDocument,
  pdf: PdfDocument,
): GroundedDocument {
  const partial = verifyField(data.partialShipment, pdf);
  if (data.partialShipment.value === "unknown") {
    partial.status = "missing";
    partial.reason = "부분선적 여부가 원문에 명시되지 않았습니다.";
  } else if (partial.source) {
    const page = pdf.pages.find((page) => page.page === partial.source!.page);
    const quote = normalizeText(partial.source.quote);
    const explicit =
      data.partialShipment.value === "no"
        ? /(?:full shipment|complete shipment|partial shipment\s*[:=-]\s*no|부분선적\s*[:=-]\s*(?:아니오|없음)|전량 선적)/.test(
            quote,
          )
        : /(?:partial shipment\s*[:=-]\s*yes|부분선적\s*[:=-]\s*(?:예|있음))/.test(
            quote,
          );
    partial.status =
      page && normalizeText(page.text).includes(quote) && explicit
        ? "verified"
        : "unverified";
    partial.reason =
      partial.status === "verified"
        ? "원문의 명시적 선적 범위를 확인했습니다."
        : "부분선적 여부를 원문의 명시적 표현으로 확인하지 못했습니다.";
  }
  return {
    id: pdf.id,
    fileName: pdf.fileName,
    type: data.type,
    seller: verifyField(data.seller, pdf, "seller"),
    buyer: verifyField(data.buyer, pdf, "buyer"),
    documentNumber: verifyField(data.documentNumber, pdf),
    transactionReference: verifyField(
      data.transactionReference,
      pdf,
      "transactionReference",
    ),
    currency: verifyField(data.currency, pdf),
    totalAmount: verifyField(data.totalAmount, pdf),
    partialShipment: partial,
    items: data.items.map((item) => ({
      description: verifyField(item.description, pdf),
      quantity: verifyField(item.quantity, pdf, "quantity"),
      unit: verifyField(item.unit, pdf),
      netWeight: verifyField(item.netWeight, pdf),
      grossWeight: verifyField(item.grossWeight, pdf),
      weightUnit: verifyField(item.weightUnit, pdf),
      amount: verifyField(item.amount, pdf),
    })),
  };
}
export function editField<T>(
  field: GroundedField<T>,
  value: T | null,
): GroundedField<T> {
  return {
    ...field,
    value,
    status: "user_edited",
    reason: "사용자가 수정한 값입니다. 기존 원문 근거로 재확정하지 않았습니다.",
  };
}
