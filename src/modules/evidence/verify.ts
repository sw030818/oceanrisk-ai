import { productQuantities } from "./quantity-evidence";
import { evidenceBlocks, relatedLabel, tableLink, type LayoutRole } from "../layout/relations";
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
  role?: LayoutRole,
): GroundedField<T> {
  const source: GroundedField<T>["source"] = field.evidence
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
  const blocks = page ? evidenceBlocks(field.evidence, page) : null;
  if (!page || !quote || (field.evidence.segments ? !blocks : !normalizeText(page.text).includes(quote)))
    return {
      ...base,
      status: "unverified",
      reason: "근거 문구가 해당 페이지 원문과 일치하지 않습니다.",
    };
  const layout = blocks && page ? tableLink(page, blocks) : null;
  const valuePresent =
    typeof field.value === "number"
      ? role === "quantity" && !layout
        ? productQuantities(field.evidence.quote).some(
            (item) => item.value === field.value,
          )
        : numericTokens(quote).includes(field.value)
      : quote.includes(normalizeText(field.value));
  if (!valuePresent)
    return {
      ...base,
      status: "unverified",
      reason: "원문 근거에서 추출값을 확인하지 못했습니다.",
    };
  if (blocks) {
    if (source) { source.blocks = blocks; if (layout) source.layout = layout; }
    if (layout && role && ["description", "unit", "amount", "netWeight", "grossWeight", "weightUnit"].includes(role) && layout.role !== role)
      return { ...base, status: "unverified", reason: "추출 필드의 의미가 실제 표 열의 제목과 맞지 않습니다." };
    if (role === "quantity" && layout) {
      const cells = blocks.filter(block => block.row > Number(layout.tableId.split(':t')[1]));
      const values = cells.flatMap(block => numericTokens(block.text));
      if (layout.role !== "quantity" || values.length !== 1 || values[0] !== field.value)
        return { ...base, status: "unverified", reason: "표의 상품 수량 열과 실제 데이터 셀을 유일하게 연결하지 못했습니다." };
      return { ...base, status: "verified", reason: "실제 PDF의 상품 수량 열·데이터 행·숫자를 대조했습니다." };
    }
    if (role && ["seller", "buyer", "transactionReference", "purchaseOrder", "invoiceReference", "documentNumber"].includes(role) && relatedLabel(page, blocks, field.value, role))
      return { ...base, status: "verified", reason: "실제 원문 블록과 인접 라벨의 행·열 위치 관계를 확인했습니다." };
    if (role && ["seller", "buyer", "transactionReference", "purchaseOrder", "invoiceReference", "documentNumber"].includes(role))
      return { ...base, status: "unverified", reason: "인용된 실제 블록의 필드 역할과 값의 위치 관계가 확인되지 않습니다." };
  }
  if (role === "quantity") {
    const quantities = productQuantities(field.evidence.quote);
    const quoteLines = field.evidence.quote.split(/\r?\n/).map(normalizeText);
    const context = page.text.split(/\r?\n/).filter(line => {
      const normalized = normalizeText(line);
      return normalized && quoteLines.some(quoted => quoted && (normalized.includes(quoted) || quoted.includes(normalized)));
    });
    const productContext = context.some(line => productQuantities(line).some(item => item.value === field.value));
    if (
      !quantities.length ||
      quantities.some((item) => item.value !== field.value) ||
      !productContext
    )
      return {
        ...base,
        status: "unverified",
        reason:
          "상품 수량 라벨의 수치를 명확히 확인하지 못했습니다. 포장 개수·다른 행 수량과 구분해 주세요.",
      };
  }
  if (role === "seller" || role === "buyer") {
    const label =
      role === "seller"
        ? /(?:seller|exporter|shipper|판매자|수출자)\s*[:=-]\s*/
        : /(?:buyer|importer|consignee|구매자|수입자)\s*[:=-]\s*/;
    const partyLine = field.evidence.quote
      .split(/\r?\n/)
      .map(normalizeText)
      .find((line) => label.test(line));
    const match = label.exec(partyLine ?? "");
    if (
      !match ||
      partyLine!.slice(match.index + match[0].length).trim() !==
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
    (role === "transactionReference" || role === "purchaseOrder" || role === "invoiceReference") &&
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
  if (role && ["seller", "buyer", "purchaseOrder", "invoiceReference", "documentNumber"].includes(role) && field.evidence.segments)
    return { ...base, status: "unverified", reason: "원문 블록은 존재하지만 필드 라벨과 값의 연결이 확인되지 않습니다." };
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
    const noLine = (line: string) =>
      /^(?:partial shipment\s*[:=-]\s*no[.]?|(?:full|complete) shipment(?:\s*[:=-]\s*yes)?[.]?|부분선적\s*[:=-]\s*(?:아니오|없음)|전량 선적)$/.test(
        normalizeText(line),
      );
    const yesLine = (line: string) =>
      /^(?:partial shipment\s*[:=-]\s*yes[.]?|부분선적\s*[:=-]\s*(?:예|있음))$/.test(
        normalizeText(line),
      );
    const sourceLines = partial.source.quote.split(/\r?\n/);
    const allLines = pdf.pages.flatMap((page) => page.text.split(/\r?\n/));
    const conflicting = allLines.some(noLine) && allLines.some(yesLine);
    const sourceInActualLine = (line: string) => normalizeText(line).includes(quote);
    const actualSourceLines = page?.text.split(/\r?\n/).filter(sourceInActualLine) ?? [];
    const explicit =
      !conflicting &&
      sourceLines.some(data.partialShipment.value === "no" ? noLine : yesLine) &&
      actualSourceLines.some(data.partialShipment.value === "no" ? noLine : yesLine);
    partial.status =
      page && (!partial.source.segments || evidenceBlocks(partial.source, page) !== null) && normalizeText(page.text).includes(quote) && explicit
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
    documentNumber: verifyField(data.documentNumber, pdf, "documentNumber"),
    transactionReference: verifyField(
      data.transactionReference,
      pdf,
      "transactionReference",
    ),
    purchaseOrder: verifyField(data.purchaseOrder ?? { value: null, evidence: null }, pdf, "purchaseOrder"),
    invoiceReference: verifyField(data.invoiceReference ?? { value: null, evidence: null }, pdf, "invoiceReference"),
    currency: verifyField(data.currency, pdf),
    totalAmount: verifyField(data.totalAmount, pdf),
    partialShipment: partial,
    items: data.items.map((item) => {
      const row = {
      description: verifyField(item.description, pdf, "description"),
      quantity: verifyField(item.quantity, pdf, "quantity"),
      unit: verifyField(item.unit, pdf, "unit"),
      netWeight: verifyField(item.netWeight, pdf, "netWeight"),
      grossWeight: verifyField(item.grossWeight, pdf, "grossWeight"),
      weightUnit: verifyField(item.weightUnit, pdf, "weightUnit"),
      amount: verifyField(item.amount, pdf, "amount"),
      };
      const quantityLayout = row.quantity.source?.layout;
      const descriptionLayout = row.description.source?.layout;
      const unitLayout = row.unit.source?.layout;
      if ((quantityLayout || descriptionLayout) && (!quantityLayout || quantityLayout.role !== "quantity" || descriptionLayout?.role !== "description" || descriptionLayout.rowId !== quantityLayout.rowId || descriptionLayout.tableId !== quantityLayout.tableId || (unitLayout && (unitLayout.rowId !== quantityLayout.rowId || unitLayout.tableId !== quantityLayout.tableId || unitLayout.role !== "unit")))) {
        row.quantity.status = "unverified";
        row.quantity.reason = "품명·상품 수량·단위가 같은 표의 동일 상품 행에 연결되지 않습니다.";
      }
      if (quantityLayout) for (const key of ["netWeight", "grossWeight", "weightUnit", "amount"] as const) {
        const location = row[key].source?.layout;
        if (location && (location.rowId !== quantityLayout.rowId || location.tableId !== quantityLayout.tableId)) {
          row[key].status = "unverified"; row[key].reason = "다른 상품 행의 값을 이 품목과 연결할 수 없습니다.";
        }
      }
      return row;
    }),
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
