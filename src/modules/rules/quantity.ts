import { productQuantities } from "../evidence/quantity-evidence";
import type { GroundedDocument, GroundedField } from "../documents/schema";
import { normalizeText } from "../evidence/verify";
export type RuleStatus = "match" | "mismatch" | "unverifiable";
export interface QuantityCheck {
  id: string;
  status: RuleStatus;
  confidence?: "confirmed" | "candidate" | "unavailable";
  title: string;
  explanation: string;
  question: string;
  item: string | null;
  invoiceQuantity?: number;
  packingQuantity?: number;
  unit?: string;
  sources: GroundedField<string | number>["source"][];
}
const unitMap: Record<string, string> = {
  pc: "PCS",
  pcs: "PCS",
  piece: "PCS",
  pieces: "PCS",
  ea: "PCS",
  each: "PCS",
  개: "PCS",
  kg: "KG",
  kgs: "KG",
  kilogram: "KG",
  kilograms: "KG",
  ton: "TON",
  tons: "TON",
  m: "M",
  meter: "M",
  meters: "M",
};
function canonicalUnit(unit: string): string | null {
  return unitMap[normalizeText(unit).replace(/\.$/, "")] ?? null;
}
function known(field: GroundedField<unknown>): boolean {
  return field.status === "verified" && field.value !== null;
}
function result(
  id: string,
  explanation: string,
  item: string | null = null,
): QuantityCheck {
  return {
    id,
    status: "unverifiable",
    confidence: "unavailable",
    title: "수량 비교를 확정할 수 없습니다",
    explanation,
    question:
      "두 문서가 같은 거래와 선적 범위를 나타내는지, 상품 단위와 수량을 발행자에게 확인해 주세요.",
    item,
    sources: [],
  };
}
export function compareQuantities(
  documents: GroundedDocument[],
): QuantityCheck[] {
  const invoices = documents.filter((doc) => doc.type === "invoice");
  const packingLists = documents.filter((doc) => doc.type === "packing_list");
  if (invoices.length !== 1 || packingLists.length !== 1)
    return [
      result(
        "document-pair",
        "Invoice 1개와 Packing List 1개가 필요합니다. 여러 거래 문서가 섞인 경우 비교할 한 쌍만 선택해 주세요.",
      ),
    ];
  const invoice = invoices[0],
    packing = packingLists[0];
  for (const key of ["seller", "buyer"] as const) {
    if (
      !known(invoice[key]) ||
      !known(packing[key]) ||
      normalizeText(invoice[key].value!) !== normalizeText(packing[key].value!)
    )
      return [
        result(
          "parties",
          "판매자·구매자가 원문에서 동일하게 확인되지 않아 문서를 연결하지 않았습니다.",
        ),
      ];
  }
  const refs = [invoice.transactionReference, packing.transactionReference];
  if (
    refs.some((field) => field.status === "user_edited") ||
    (refs.every((field) => field.value) &&
      normalizeText(refs[0].value!) !== normalizeText(refs[1].value!))
  )
    return [
      result(
        "transaction-reference",
        "거래 참조가 다르거나 사용자가 수정했습니다. 서로 다른 거래를 비교하지 않습니다.",
      ),
    ];
  const scopes = [invoice.partialShipment, packing.partialShipment];
  if (
    scopes.some(
      (field) => field.value === "yes" || field.status === "user_edited",
    )
  )
    return [
      result(
        "shipment-scope",
        "부분선적이거나 선적 범위가 사용자 수정값입니다. 전체 거래 수량과 출하 수량을 오류로 비교하지 않습니다.",
      ),
    ];
  const referenceConfirmed =
    refs.every(known) &&
    normalizeText(refs[0].value!) === normalizeText(refs[1].value!);
  const scopeConfirmed = scopes.every(
    (field) => known(field) && field.value === "no",
  );
  const confirmed = referenceConfirmed && scopeConfirmed;
  if (!invoice.items.length || !packing.items.length)
    return [result("no-items", "비교할 상품 정보가 부족합니다.")];
  const results: QuantityCheck[] = [];
  const matched = new Set<number>();
  invoice.items.forEach((item, index) => {
    const id = `quantity-${index}`;
    const label = item.description.value;
    if (!known(item.description)) {
      results.push(result(id, "품명 근거가 검증되지 않았습니다.", label));
      return;
    }
    const name = normalizeText(label!);
    const duplicate =
      invoice.items.filter(
        (other) =>
          other.description.value &&
          normalizeText(other.description.value) === name,
      ).length > 1;
    const candidates = packing.items
      .map((other, i) => ({ other, i }))
      .filter(
        ({ other }) =>
          known(other.description) &&
          normalizeText(other.description.value!) === name,
      );
    if (duplicate || candidates.length !== 1) {
      results.push(
        result(
          id,
          "동일 품목을 유일하게 연결하지 못했습니다. 품명 차이·중복 행·품목 누락을 확인해 주세요.",
          label,
        ),
      );
      return;
    }
    const { other, i } = candidates[0];
    matched.add(i);
    if (![item.quantity, other.quantity, item.unit, other.unit].every(known)) {
      results.push(
        result(
          id,
          "수량 또는 단위의 원문 근거가 부족하거나 사용자가 수정한 값입니다. 확정 비교에서 제외했습니다.",
          label,
        ),
      );
      return;
    }
    const unit = canonicalUnit(item.unit.value!),
      otherUnit = canonicalUnit(other.unit.value!);
    if (!unit || unit !== otherUnit) {
      results.push(
        result(
          id,
          "상품 단위가 다르거나 포장 단위일 수 있습니다. 단위를 자동 변환하지 않았습니다.",
          label,
        ),
      );
      return;
    }
    const quantityUnitsLinked = [item, other].every(
      (row) =>
        row.quantity.source?.page === row.unit.source?.page &&
        row.quantity.source &&
        productQuantities(row.quantity.source.quote).some(
          (evidence) =>
            evidence.value === row.quantity.value &&
            evidence.unit &&
            canonicalUnit(evidence.unit) === canonicalUnit(row.unit.value!),
        ),
    );
    if (!quantityUnitsLinked) {
      results.push(
        result(
          id,
          "상품 수량 근거에서 해당 상품 단위를 함께 확인하지 못했습니다. 다른 행의 단위를 섞어 사용하지 않습니다.",
          label,
        ),
      );
      return;
    }
    const equal = item.quantity.value === other.quantity.value;
    results.push({
      id,
      status: confirmed ? (equal ? "match" : "mismatch") : "unverifiable",
      confidence: confirmed ? "confirmed" : "candidate",
      title: !confirmed
        ? "수량 비교 후보 · 확정 오류 아님"
        : equal
          ? "동일 품목의 수량이 일치합니다"
          : "동일 품목의 수량 차이를 확인했습니다",
      explanation: !confirmed
        ? "상품 수량과 단위는 원문에서 확인했지만 거래 참조 또는 전체 선적 범위가 부족합니다. 수치 차이를 참고하되 같은 거래·선적 범위인지 발행자에게 확인해야 합니다."
        : equal
          ? "원문과 대조된 상품 수량·단위가 두 문서에서 일치합니다. 전체 문서가 안전하다는 뜻은 아닙니다."
          : "동일 거래당사자·거래 참조·품명·단위·전체 선적 범위가 원문에서 확인된 문서 사이에 수량 차이가 있습니다. 발행자 확인이 필요합니다.",
      question: !confirmed
        ? "두 서류가 같은 주문 및 같은 선적 범위인가요? 부분선적이나 서류 버전 차이가 있는지 확인해 주세요."
        : equal
          ? "실제 출하 수량과 최종 발행 서류도 같은지 확인해 주세요."
          : "Invoice와 Packing List의 수량이 다릅니다. 실제 출하 수량은 무엇이며 어느 서류를 수정해야 하나요?",
      item: label,
      invoiceQuantity: item.quantity.value!,
      packingQuantity: other.quantity.value!,
      unit,
      sources: [
        item.quantity.source,
        other.quantity.source,
        item.unit.source,
        other.unit.source,
      ],
    });
  });
  packing.items.forEach((item, i) => {
    if (!matched.has(i))
      results.push(
        result(
          `packing-${i}`,
          "Packing List의 이 품목을 Invoice에서 유일하게 연결하지 못했습니다.",
          item.description.value,
        ),
      );
  });
  return results;
}
