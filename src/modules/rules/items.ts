import type { GroundedItem } from "../documents/schema";
import { normalizeText } from "../evidence/verify";
import { known, canonicalUnit } from "./model";
export const productKey = (value: string | null) =>
  normalizeText(value ?? "")
    .replace(/(\d)(\p{L})/gu, "$1 $2")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const code = (item: GroundedItem) =>
  known(item.sku) ? normalizeText(item.sku!.value!) : null;
const similar = (a: string, b: string) => {
  const aa = new Set(a.split(" ")),
    bb = new Set(b.split(" "));
  const digits = (s: Set<string>) =>
    [...s]
      .filter((t) => /\d/.test(t))
      .sort()
      .join("|");
  if (aa.size < 4 || bb.size < 4 || digits(aa) !== digits(bb)) return 0;
  return [...aa].filter((t) => bb.has(t)).length / new Set([...aa, ...bb]).size;
};
export function matchItem(
  item: GroundedItem,
  left: GroundedItem[],
  right: GroundedItem[],
) {
  const sku = code(item),
    name = productKey(item.description.value);
  if (sku) {
    const a = left.filter((r) => code(r) === sku),
      b = right
        .map((row, index) => ({ row, index }))
        .filter((r) => code(r.row) === sku);
    if (a.length > 1 || b.length > 1)
      return {
        reason: "제품 식별자가 중복되어 일대일 대응을 확정할 수 없습니다.",
      };
    if (b.length === 1)
      return {
        ...b[0],
        tentative: productKey(b[0].row.description.value) !== name,
        reason: "원문 SKU / Item Code로 대응했습니다.",
      };
  }
  const a = left.filter((r) => productKey(r.description.value) === name);
  const b = right
    .map((row, index) => ({ row, index }))
    .filter((r) => name && productKey(r.row.description.value) === name);
  if (a.length > 1 || b.length > 1)
    return {
      reason:
        "중복 품명으로 일대일 대응이 불명확합니다. SKU 또는 품목 행을 확인해 주세요.",
    };
  if (b.length === 1) {
    if (sku && code(b[0].row) && sku !== code(b[0].row))
      return { reason: "같은 품명이지만 검증된 제품 식별자가 다릅니다." };
    return {
      ...b[0],
      tentative: !known(item.description) || !known(b[0].row.description),
      reason: "유일한 표준화 품명으로 대응했습니다.",
    };
  }
  const ranked = right
    .map((row, index) => ({
      row,
      index,
      score: similar(name, productKey(row.description.value)),
    }))
    .filter(
      (r) => canonicalUnit(r.row.unit.value) === canonicalUnit(item.unit.value),
    )
    .sort((a, b) => b.score - a.score);
  if (
    ranked[0]?.score >= 0.8 &&
    ranked[0].score - (ranked[1]?.score ?? 0) >= 0.15 &&
    a.length === 1
  )
    return {
      ...ranked[0],
      tentative: true,
      reason:
        "유사 품명만으로 연결한 잠정 대응입니다. SKU·규격을 확인해 주세요.",
    };
  return {
    reason:
      "대응 품목을 유일하게 찾지 못했습니다. 품명·SKU·누락 행을 확인해 주세요.",
  };
}
