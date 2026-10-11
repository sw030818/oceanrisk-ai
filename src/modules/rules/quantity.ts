import type { GroundedDocument, GroundedItem } from "../documents/schema";
import { productQuantities } from "../evidence/quantity-evidence";
import {
  check,
  known,
  hasValue,
  sameText,
  canonicalUnit,
  type ReviewCheck,
} from "./model";
import { reviewReferences } from "./references";
import { matchItem } from "./items";
export type RuleStatus = ReviewCheck["status"];
export interface QuantityCheck extends ReviewCheck {
  invoiceQuantity?: number;
  packingQuantity?: number;
}
export interface PairSelection {
  invoiceId: string;
  packingId: string;
}
export function selectPair(
  documents: GroundedDocument[],
  selection?: PairSelection,
) {
  const invoices = documents.filter((d) => d.type === "invoice"),
    packing = documents.filter((d) => d.type === "packing_list");
  const a = selection
    ? documents.find((d) => d.id === selection.invoiceId)
    : invoices.length === 1
      ? invoices[0]
      : undefined;
  const b = selection
    ? documents.find((d) => d.id === selection.packingId)
    : packing.length === 1
      ? packing[0]
      : undefined;
  return a && b && a.id !== b.id ? { invoice: a, packing: b } : null;
}
export function pairContext(
  invoice: GroundedDocument,
  packing: GroundedDocument,
) {
  const references = reviewReferences(invoice, packing);
  const parties = ["seller", "buyer"] as const;
  const partiesConfirmed = parties.every(
    (k) =>
      known(invoice[k]) &&
      known(packing[k]) &&
      sameText(invoice[k].value!, packing[k].value!),
  );
  const scopes = [invoice.partialShipment, packing.partialShipment];
  const blockers: string[] = [];
  if (invoice.type !== "invoice" || packing.type !== "packing_list")
    blockers.push("선택 영역과 판독 문서 유형 확인 필요");
  if (!partiesConfirmed) blockers.push("거래당사자의 동일성 미확인 또는 충돌");
  if (references.conflict) blockers.push("같은 의미의 거래 참조 충돌");
  if (!references.supported)
    blockers.push("동일 거래의 Invoice / PO 참조 부족");
  if (references.edited) blockers.push("사용자가 수정한 거래 참조");
  if (!scopes.every((f) => known(f) && f.value === "no"))
    blockers.push(
      scopes.some((f) => f.value === "yes")
        ? "부분선적·백오더 등 선적 범위 확인 필요"
        : "전체 선적 범위 미확인 또는 사용자 수정",
    );
  return { references, partiesConfirmed, blockers };
}
function linkedUnit(row: GroundedItem) {
  if (
    !row.quantity.source ||
    !row.unit.source ||
    row.quantity.source.page !== row.unit.source.page
  )
    return false;
  const layout = row.quantity.source.layout;
  return layout?.role === "quantity" && layout.unit
    ? canonicalUnit(layout.unit) === canonicalUnit(row.unit.value)
    : productQuantities(row.quantity.source.quote).some(
        (e) =>
          e.value === row.quantity.value &&
          canonicalUnit(e.unit) === canonicalUnit(row.unit.value),
      );
}
function unavailable(
  id: string,
  explanation: string,
  item: string | null = null,
  fields: ReviewCheck["fields"] = [],
  missing = false,
): QuantityCheck {
  return check({
    id,
    category: "quantity",
    scope: "cross",
    assessment: missing ? "insufficient_information" : "needs_review",
    title: missing ? "비교 정보 부족" : "품목 수량 확인 필요",
    explanation,
    question:
      "품목·상품 단위·원문 근거와 같은 선적 범위인지 발행자에게 확인해 주세요.",
    item,
    fields,
  });
}
export function compareQuantities(
  documents: GroundedDocument[],
  selection?: PairSelection,
): QuantityCheck[] {
  const pair = selectPair(documents, selection);
  if (!pair)
    return [
      unavailable(
        "document-pair",
        "대상 서류 부족 또는 문서 유형 확인 필요: 비교할 Invoice와 Packing List 한 쌍을 선택해 주세요.",
        null,
        [],
        true,
      ),
    ];
  const { invoice, packing } = pair,
    context = pairContext(invoice, packing);
  if (!invoice.items.length || !packing.items.length)
    return [
      unavailable("no-items", "비교할 품목 정보가 없습니다.", null, [], true),
    ];
  const matches = invoice.items.map((row) =>
    matchItem(row, invoice.items, packing.items),
  );
  const used = new Set<number>();
  const checks: QuantityCheck[] = invoice.items.map((row, index) => {
    const match = matches[index],
      id = `quantity-${index}`,
      label = row.description.value;
    if (!("row" in match) || !match.row || match.index === undefined)
      return unavailable(id, match.reason, label);
    if (
      matches.filter((m) => "index" in m && m.index === match.index).length !==
      1
    )
      return unavailable(
        id,
        "여러 Invoice 행이 같은 Packing List 행에 대응하여 임의 연결하지 않았습니다.",
        label,
      );
    used.add(match.index);
    const other = match.row;
    const fields = [
      { label: "Invoice 수량", field: row.quantity },
      { label: "Packing List 수량", field: other.quantity },
      { label: "Invoice 단위", field: row.unit },
      { label: "Packing List 단위", field: other.unit },
    ];
    if (!hasValue(row.quantity) || !hasValue(other.quantity))
      return unavailable(
        id,
        "한쪽 상품 수량이 없어수치 비교를 실행하지 못했습니다.",
        label,
        fields,
        true,
      );
    const unit = canonicalUnit(row.unit.value),
      otherUnit = canonicalUnit(other.unit.value);
    if (!unit || unit !== otherUnit)
      return {
        ...unavailable(
          id,
          "상품 단위가 다르거나 포장 단위입니다. PCS·CTNS·중량을 자동 변환하지 않았습니다.",
          label,
          fields,
        ),
        invoiceQuantity: row.quantity.value!,
        packingQuantity: other.quantity.value!,
        leftValue: row.quantity.value,
        rightValue: other.quantity.value,
      };
    const blockers = [...context.blockers];
    if (match.tentative) blockers.push(match.reason);
    if (![row.quantity, other.quantity, row.unit, other.unit].every(known))
      blockers.push("수량·단위의 근거 미확인 또는 사용자 수정값");
    if (![row, other].every(linkedUnit))
      blockers.push("해당 상품 행의 수량·단위 연결 미확인");
    const equal = row.quantity.value === other.quantity.value;
    const assessment = blockers.length
      ? equal
        ? "provisional_match"
        : "provisional_mismatch"
      : equal
        ? "confirmed_match"
        : "confirmed_mismatch";
    return {
      ...check({
        id,
        category: "quantity",
        scope: "cross",
        assessment,
        title: blockers.length
          ? "수량 비교 후보 · 확정 오류 아님"
          : equal
            ? "동일 품목의 수량이 일치합니다"
            : "동일 품목의 수량 차이를 확인했습니다",
        explanation: blockers.length
          ? `선택한 두 문서의 수치 비교는 수행했습니다. ${[...new Set(blockers)].join(" · ")}. 잠정 결과를 확정 오류 건수에 포함하지 않습니다.`
          : equal
            ? "같은 의미의 상품 수량·단위·행과 거래·전체 선적 범위가 원문에서 확인됩니다."
            : "검증된 동일 품목·단위·거래·선적 범위의 상품 수량이 다릅니다. 실제 출하 수량과 수정할 서류를 확인해 주세요.",
        question: blockers.length
          ? "같은 주문·상품 규격·선적 범위인가요? 근거 미확인이나 사용자 수정 항목은 원문 또는 수정 PDF로 다시 확인해 주세요."
          : equal
            ? "실제 출하 수량과 최종 문서도 같은지 확인해 주세요."
            : "실제 출하 수량은 무엇이며 어느 서류를 수정해야 하나요?",
        item: label,
        leftValue: row.quantity.value,
        rightValue: other.quantity.value,
        unit,
        fields,
      }),
      invoiceQuantity: row.quantity.value!,
      packingQuantity: other.quantity.value!,
    };
  });
  packing.items.forEach((row, index) => {
    if (!used.has(index))
      checks.push(
        unavailable(
          `packing-${index}`,
          "Packing List의 이 품목을 Invoice에서 유일하게 연결하지 못했습니다.",
          row.description.value,
        ),
      );
  });
  return checks;
}
