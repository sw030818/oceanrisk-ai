import type { GroundedDocument, GroundedField } from "../documents/schema";
import { normalizeText } from "../evidence/verify";
export type RuleStatus = "match" | "mismatch" | "unverifiable";
export interface QuantityCheck {
  id: string;
  status: RuleStatus;
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
  for (const key of ["seller", "buyer", "transactionReference"] as const) {
    if (
      !known(invoice[key]) ||
      !known(packing[key]) ||
      normalizeText(invoice[key].value!) !== normalizeText(packing[key].value!)
    )
      return [
        result(
          "parties",
          "판매자·구매자·거래 참조가 두 문서의 원문에서 동일하게 확인되지 않아 같은 거래로 확정할 수 없습니다.",
        ),
      ];
  }
  if (
    ![invoice.partialShipment, packing.partialShipment].every(
      (field) => known(field) && field.value === "no",
    )
  )
    return [
      result(
        "shipment-scope",
        "부분선적 가능성이 있거나 전체 선적 여부가 명시되지 않았습니다. 수량 차이가 실제 오류인지 확정할 수 없습니다.",
      ),
    ];
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
        row.unit.value &&
        normalizeText(row.quantity.source.quote)
          .split(/[^\p{L}\p{N}]+/u)
          .includes(normalizeText(row.unit.value).replace(/\.$/, "")),
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
      status: equal ? "match" : "mismatch",
      title: equal
        ? "동일 품목의 수량이 일치합니다"
        : "동일 품목의 수량 차이를 확인했습니다",
      explanation: equal
        ? "원문과 대조된 상품 수량·단위가 두 문서에서 일치합니다. 전체 문서가 안전하다는 뜻은 아닙니다."
        : "동일 거래당사자·거래 참조·품명·단위·전체 선적 범위가 원문에서 확인된 문서 사이에 수량 차이가 있습니다. 발행자 확인이 필요합니다.",
      question: equal
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
