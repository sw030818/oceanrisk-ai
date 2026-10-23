// Value-shape contracts. A cited value must look like the field it claims,
// whatever the layout: position alone never proves meaning. These checks only
// reject; they never create, repair or reinterpret a value.
import { spanText } from "../layout/physical-spans";
import { normalizeText } from "../evidence/verify";
import type { PdfBlock, PdfPage } from "../documents/schema";
import { shippingRole, unitParents } from "./roles";

// Count/packaging/weight units and container-size words are not product names.
const unitWords = new Set([
  "pcs", "pc", "ea", "each", "piece", "pieces", "ctn", "ctns", "ct", "carton", "cartons",
  "pkg", "pkgs", "package", "packages", "pallet", "pallets", "plt", "plts", "box", "boxes",
  "bag", "bags", "roll", "rolls", "drum", "drums", "case", "cases", "bundle", "bundles",
  "set", "sets", "unit", "units", "kg", "kgs", "g", "mt", "ton", "tons", "lb", "lbs",
  "cbm", "m3", "gp", "hc", "dc", "rf", "teu", "feu", "개", "상자", "박스", "팔레트",
]);
// Label words that carry no product meaning on their own.
const labelWords = new Set(["total", "qty", "quantity", "no", "hs", "code", "of", "and", "the", "x", "합계", "총"]);

/** Letter runs that could name a product (not units, sizes or label words). */
export function productTokens(text: string): string[] {
  return [...normalizeText(text).matchAll(/[\p{L}][\p{L}\p{M}'-]*/gu)]
    .map((m) => m[0].toLowerCase())
    .filter((t) => (t.length >= 2 || /[가-힣]/.test(t)) && !unitWords.has(t) && !labelWords.has(t));
}

const identifierRoles = new Set([
  "houseBlNumber", "declarationNumber", "containerNumber", "sealNumber",
  "bookingReference", "shipmentReference", "otherReference",
]);
const nameRoles = new Set(["shipper", "consignee", "exporter", "notifyParty", "declarant", "portOfLoading", "portOfDischarge", "vessel"]);

/** Why this value cannot be the claimed field, or null when its shape fits. */
export function shapeProblem(role: string, value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (role === "goodsDescription" || role === "tradeDescription")
    return productTokens(v).length
      ? null
      : "숫자·수량·단위만 있는 값은 상품명으로 입증하지 않습니다.";
  if (identifierRoles.has(role))
    // A number carries a digit, or is one unbroken code ("OTHER-SEAL");
    // a phrase of plain words ("STRAIGHT / NON-NEGOTIABLE") is not a number.
    return v.replace(/[^\p{L}\p{N}]/gu, "").length >= 2 && (/\d/.test(v) || !/\s/.test(v))
      ? null
      : "식별번호에는 실제 번호 형태의 값이 필요합니다.";
  if (nameRoles.has(role))
    return /\p{L}{2,}/u.test(v) ? null : "명칭 필드에는 실제 문자 명칭이 필요합니다.";
  return null;
}

// A number printed right after an identifier word is part of that identifier
// (MODEL 10000, NO. 3, TYPE 40), not a count, package or weight.
const identifierPrefix = /(?:^|[\s(\/,])(?:model|mod\.|series|type|art\.?|item\s*no\.?|part\s*no\.?|p\/n|s\/n|ref\.?|#)\s*[:.]?\s*$/i;
export function numberIsIdentifier(text: string, value: number): boolean {
  for (const m of text.matchAll(/[-+]?\d+(?:[.,]\d+)*/g)) {
    const n = Number(m[0].replace(/,/g, ""));
    if (n === value && identifierPrefix.test(text.slice(0, m.index))) return true;
  }
  return false;
}

/**
 * A colon label printed earlier on the same physical line that names another
 * field ("TOTAL PACKAGES:", "SHIPPING MARK:") makes the line a labelled
 * statement, not a member of an item/container/cargo table row.
 */
export function foreignLineLabel(page: PdfPage, block: PdfBlock, role: string): string | null {
  // Only the continuous phrase that leads into the value counts: a label in a
  // separate column of the same table line (SEAL: in one cell, HS: in the
  // next) belongs to that other cell.
  const sorted = (page.blocks ?? [])
    .filter((b) => b.row === block.row && Math.abs(b.y + b.height - (block.y + block.height)) <= Math.max(b.height, block.height) * 0.6)
    .sort((a, b) => a.x - b.x);
  let i = sorted.findIndex((b) => b.id === block.id);
  const run: PdfBlock[] = [];
  while (i > 0) {
    const prev = sorted[i - 1], cur = sorted[i];
    if (cur.x - (prev.x + prev.width) > Math.max(prev.height, cur.height) * 2.5) break;
    run.unshift(prev);
    i--;
  }
  const own = block.text;
  const head = spanText(run) + " " + own.slice(0, Math.max(0, own.lastIndexOf(":") + 1));
  const allowed = new Set([role, ...(unitParents[role] ?? [])]);
  for (const m of head.matchAll(/([\p{L}][\p{L}\p{N} .&\/()-]{0,40}?)\s*:/gu)) {
    const label = m[1].trim();
    const labelRole = shippingRole(label);
    if (!labelRole || !allowed.has(labelRole)) return label;
  }
  return null;
}
