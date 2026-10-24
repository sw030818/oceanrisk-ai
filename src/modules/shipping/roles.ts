// Semantic labels, bilingual and relative layout only; no company coordinates.
const labels: Record<string, RegExp> = {
  houseBlNumber:
    /^(?:house\s*b\/?l(?:\s*(?:no\.?|number|#|번호))?|b\/l(?:\s*(?:no\.?|number))|house bill of lading(?:\s*(?:no\.?|number))?|h\.?b\.?l\.?(?:\s*(?:no\.?|number|#))?|h\s*b\/l(?:\s*no\.?)?|하우스\s*(?:b\/?l|선하증권)(?:\s*번호)?|선하증권번호\s*\(\s*h\.?\s*b\/?l(?:\s*no\.?)?\s*\))$/i,
  // Official consolidated manifests print the carrier's Master B/L beside the
  // House B/L. It is a different reference and is never a House B/L number.
  masterBlNumber:
    /^(?:master\s*b\/?l(?:\s*(?:no\.?|number))?|m\.?\s*b\/l(?:\s*no\.?)?|선하증권번호\s*\(\s*m\.?\s*b\/?l(?:\s*no\.?)?\s*\)|마스터\s*(?:b\/?l|선하증권)(?:\s*번호)?)$/i,
  cargoClassification: /^(?:화물구분(?:\s*\(\s*e\s*\/\s*r\s*\))?|cargo classification)$/i,
  declarationNumber:
    /^(?:export declaration(?:\s*(?:no\.?|number|reference))?|declaration(?:\s*(?:no\.?|number))|수출신고번호|수출 신고번호|신고번호)$/i,
  declarationDate:
    /^(?:declaration date|date of declaration|신고일자|신고일)$/i,
  shipper: /^(?:shipper|shipper\s*\/\s*exporter|송하인|송화인)$/i,
  consignee: /^(?:consignee|수하인|수화인)$/i,
  notifyParty: /^(?:notify party|notify|통지처|통지인)$/i,
  exporter: /^(?:exporter|수출자(?:\s*\/\s*상호)?|수출화주(?:\s*영문명)?|수출대행자\s*\/\s*수출화주)$/i,
  exporterIdentifier:
    /^(?:exporter id|exporter identification|수출자 식별정보|수출자 사업자등록번호)$/i,
  declarant: /^(?:declarant|신고인(?:\s*\/\s*관세사)?|신고자)$/i,
  vessel: /^(?:vessel|ocean vessel|vessel name|선박명)$/i,
  voyage: /^(?:voyage|voyage no\.?|항차)$/i,
  goodsDescription:
    /^(?:description|goods description|description of goods|화물명세|품명(?:\s*및\s*규격|\s*\(영문\))?|신고 품명)$/i,
  tradeDescription:
    /^(?:trade description|commercial description|거래품명|거래 품명)$/i,
  hsCode:
    /^(?:hs code|hs|h\.?s\.? code|세번|세번부호|hs 부호|세번부호\s*\(HS\))$/i,
  // Recognize boundaries even for monetary fields outside the extraction model;
  // their closed cells must not inherit a distant quantity column heading.
  monetaryAmount: /^(?:신고가격(?:\s*\(FOB\))?|신고금액|총금액|총 금액|declared value(?:\s*\(FOB\))?|total amount|total value|FOB value)$/i,
  exchangeRate: /^(?:적용환율|환율|exchange rate)$/i,
  quantity:
    /^(?:qty\.?|quantity|declared quantity|신고수량|신고 수량|물품수량|수량(?:\s*\/\s*단위)?)$/i,
  quantityUnit: /^(?:uom|unit|quantity unit|단위|수량단위|수량 단위)$/i,
  packageCount:
    /^(?:number of packages|no\.? of packages|packages|package count|ctns?|pkgs?|cartons?|포장개수|포장 개수|포장수|포장\s*수량|포장\s*갯수|no\.?\s*\/\s*kind\s*of packages|no\.?\s*(?:&|and)\s*kinds?\s*of\s*(?:containers\s*or\s*)?packages)$/i,
  packageUnit: /^(?:package unit|packaging unit|포장단위|포장 단위)$/i,
  grossWeight: /^(?:gross weight|gross wt\.?|g\.?w\.?|총중량|총 중량)$/i,
  netWeight: /^(?:net weight|net wt\.?|n\.?w\.?|순중량|순 중량)$/i,
  declaredWeight: /^(?:declared weight|신고중량|신고 중량)$/i,
  grossWeightUnit: /^(?:gross weight unit|weight unit|중량단위|총중량 단위)$/i,
  netWeightUnit: /^(?:net weight unit|순중량 단위)$/i,
  declaredWeightUnit: /^(?:declared weight unit|신고중량 단위)$/i,
  containerNumber:
    /^(?:container(?:\s*(?:no\.?|number|#))?|컨테이너번호|컨테이너 번호)$/i,
  sealNumber:
    /^(?:seal(?:\s*(?:no\.?|number|#|번호))?|봉인번호|봉인 번호|봉인번호\s*\(SEAL\))$/i,
  destinationCountry: /^(?:destination country|country of destination|목적국|도착국)$/i,
  portOfLoading: /^(?:port of loading|pol|선적항|적재항)$/i,
  portOfDischarge: /^(?:port of discharge|pod|양하항|양륙항|하역항)$/i,
  // Distinct places printed beside the ports; never a port of discharge.
  placeOfReceipt: /^(?:place of receipt|수탁지)$/i,
  placeOfDelivery: /^(?:place of delivery|인도지)$/i,
  finalDestination: /^(?:final destination(?:\s*\(?for the merchant'?s? ref\.?\)?)?|최종\s*목적지)$/i,
  measurement: /^(?:measurement|총용적|용적|cbm)$/i,
  // Other boxes of official customs forms. They are never compared, but they
  // are labels: their text is not a value of the neighbouring box.
  formField: /^(?:적재장소|place of loading|화물특성(?:부호)?|화물고유식별번호|unique consignment reference|적하목록관리번호|manifest reference no\.?|선박회사(?:명)?|name of carrier|국내화물운송주선업자(?:명)?|consolidator|출항(?:예정)?일자|date of departure|통관고유부호|거래구분|종류|결제방법|운송형태|검사희망일|물품소재지|원산지|상표명|모델\s*[·.]\s*규격|성분|단가(?:\s*\(\w+\))?|금액(?:\s*\(\w+\))?|결제금액|운임(?:\s*\(.\))?|보험료(?:\s*\(.\))?|송품장(?:부호|번호)|수입신고번호|수입화물관리번호|적재예정보세구역|제조자|구매자|l\/c\s*번호|물품상태|c\/s\s*구분|신고구분|세관\s*[.·]\s*과|flag|pre-?carriage by|freight and charges|no\.? of original b\/l|place and date of issue|laden on board(?: the)? vessel)$/i,
  shipmentScope: /^(?:shipment scope|선적 범위)$/i,
  shipmentReference:
    /^(?:shipment ref(?:erence)?|shipment no\.?|선적 참조번호)$/i,
  bookingReference: /^(?:booking no\.?|booking ref(?:erence)?|예약 번호)$/i,
  otherReference: /^(?:reference|ref\.?|기타 참조)$/i,
  totalQuantity:
    /^(?:total quantity|total qty\.?|총 신고수량|총 수량|수량 합계)$/i,
  totalPackageCount:
    /^(?:total packages|total package count|total ctns|총\s*포장\s*(?:수|개수|갯수)|포장 합계|합계 포장|total no\.? of (?:containers or )?packages)$/i,
  totalGrossWeight:
    /^(?:total gross weight|gross weight total|총중량 합계|총 총중량)$/i,
  totalNetWeight:
    /^(?:total net weight|net weight total|순중량 합계|총\s*순중량)$/i,
};
// Static label patterns are immutable and contain no uploaded document data.
// Rebuilding this array for every native cell/field caused large short-lived
// allocations during parsing and recovery.
const labelPatterns = Object.entries(labels);
// One compiled alternative matcher preserves the ordered, anchored patterns
// while avoiding dozens of separate RegExp calls for every non-label value.
const combinedLabels=new RegExp(labelPatterns.map(([role,re])=>`(?<${role}>${re.source})`).join('|'),'i');
function directRole(label:string){
  const match=combinedLabels.exec(label);if(!match?.groups)return null;
  return labelPatterns.find(([role])=>match.groups![role]!==undefined)?.[0]??null;
}
// Official forms number their boxes: ⑤ (NFKC "5"), "(31)", "13." and item
// tags such as "[란 001]". English translations or units follow in brackets:
// "선박명(Name Of Vessel)", "총중량(KGS)". None of these change the meaning.
function labelForms(text: string): string[] {
  const base = text
    .normalize("NFKC")
    .trim()
    .replace(/^(?:\(\d{1,3}\)|\d{1,3}[.)]|\d{1,3}(?=\s*[가-힣]))\s*(?=[A-Za-z가-힣])/, "")
    .replace(/\s*\[[^\]]{0,20}\]\s*$/, "")
    .replace(/\s*[:=#-]\s*$/, "")
    .replace(/\s+/g, " ");
  const bare = base
    .replace(/\s*\((?:[A-Za-z][A-Za-z .,'&\/-]{0,40}|[가-힣]{1,5}|개|톤)\)\s*$/, "")
    .replace(/\s*\((?:[A-Za-z][A-Za-z .,'&\/-]{0,40}|[가-힣]{1,5})\)\s*$/, "")
    .trim();
  return bare && bare !== base ? [base, bare] : [base];
}
export function shippingRole(text: string): string | null {
  const forms = labelForms(text);
  for (const label of forms) {
    const role = roleOfLabel(label);
    if (role) return role;
  }
  return null;
}
function roleOfLabel(label: string): string | null {
  // A document TITLE is not an identifier field label. Otherwise the caption
  // below a B/L title can be falsely recovered as a House B/L number.
  if (/^(?:house bill of lading|export declaration(?: certificate)?|house manifest|수출신고필증)$/i.test(label)) return null;
  const direct = directRole(label);
  if (direct) return direct;
  // Every bilingual fragment must identify the same role; QTY / Packages is ambiguous.
  const parts = label.split(/\s+\/\s+/);
  if (parts.length > 1) {
    const roles = parts.map(
      (part) =>
        directRole(part),
    );
    if (roles.every(Boolean)) {
      if (new Set(roles).size === 1) return roles[0]!;
      const totals = roles.map((r) => rootTotalRole[r!] ?? r);
      if (new Set(totals).size === 1) return totals[0]!;
    }
  }
  // The identical whole label already failed the direct scan above. Patterns
  // have no global/sticky flags, so repeating it cannot yield another result.
  return null;
}
export const unitParents: Record<string, string[]> = {
  quantityUnit: ["quantity", "totalQuantity"],
  packageUnit: ["packageCount", "totalPackageCount"],
  grossWeightUnit: ["grossWeight", "totalGrossWeight"],
  netWeightUnit: ["netWeight", "totalNetWeight"],
  declaredWeightUnit: ["declaredWeight"],
  weightUnit: [
    "grossWeight",
    "netWeight",
    "declaredWeight",
    "grossWeightUnit",
    "netWeightUnit",
    "declaredWeightUnit",
  ],
};
export const rootTotalRole: Record<string, string> = {
  quantity: "totalQuantity",
  packageCount: "totalPackageCount",
  grossWeight: "totalGrossWeight",
  netWeight: "totalNetWeight",
};

// Official forms print several fields in one column and tell the lines apart
// with markers: "S)송하인 C)수하인 N)통지처", "1)총중량(KGS) 2)총용적(CBM)",
// "컨테이너번호/봉인번호" (seal lines start with "/"), or two numbered labels
// stacked in one header ("7. 화물구분 / 8. 선하증권번호(H B/L No)").
export type CompoundLabel = {
  kind: "marker" | "slash" | "ordered";
  /** unit: a trailing printed unit of that part, e.g. "총중량(KGS)" → KGS. */
  parts: { marker: string; role: string | null; x?: number; unit?: string }[];
};
const partUnit = (text: string) => {
  const u = text.trim().match(/\(([A-Za-z]{1,6})\)$/)?.[1];
  return u ? { unit: u.toUpperCase() } : {};
};
export function compoundLabel(text: string): CompoundLabel | null {
  const t = text.normalize("NFKC").replace(/\s+/g, " ").trim()
    .replace(/^(?:\(\d{1,3}\)|\d{1,3}[.)])\s*(?=[A-Za-z가-힣0-9])/, "");
  if (shippingRole(t)) return null;
  const markers = [...t.matchAll(/(?:^|\s)([A-Z]|\d)\)\s*(?=[A-Za-z가-힣])/g)];
  if (markers.length >= 2) {
    const parts = markers.map((m, i) => {
      const part = t.slice(m.index! + m[0].length, markers[i + 1]?.index ?? t.length);
      return { marker: m[1], role: shippingRole(part), ...partUnit(part) };
    });
    if (parts.some((p) => p.role) && new Set(parts.map((p) => p.marker)).size === parts.length)
      return { kind: "marker", parts };
  }
  const numbered = t.split(/\s*(?:\/\s*)?(?=(?:\(\d{1,3}\)|\d{1,3}\.)\s*[A-Za-z가-힣])/).filter(Boolean);
  if (numbered.length >= 2) {
    const parts = numbered.map((p, i) => ({ marker: "#" + i, role: shippingRole(p.replace(/\s*\/\s*$/, "")), ...partUnit(p.replace(/\s*\/\s*$/, "")) }));
    if (parts.every((p) => p.role)) return { kind: "ordered", parts };
  }
  // Only identifier columns joined by an unspaced slash; "QTY / Packages"
  // stays ambiguous because its unmarked lines could be either measure.
  const slash = t.split(/(?<=\S)\/(?=\S)/);
  const ids = ["containerNumber", "sealNumber", "houseBlNumber", "masterBlNumber", "declarationNumber"];
  if (slash.length === 2) {
    const parts = [{ marker: "", role: shippingRole(slash[0]) }, { marker: "/", role: shippingRole(slash[1]) }];
    if (parts.every((p) => p.role && ids.includes(p.role)) && parts[0].role !== parts[1].role) return { kind: "slash", parts };
  }
  return null;
}
/** Leading sub-field marker of a value line inside a compound column. */
export function subfieldMarker(text: string): string | null {
  const t = text.normalize("NFKC").trimStart();
  if (t.startsWith("/")) return "/";
  return t.match(/^([A-Z]|\d)\)\s*/)?.[1] ?? null;
}
export function withoutSubfieldMarker(text: string): string {
  return text.normalize("NFKC").replace(/^\s*(?:\/|(?:[A-Z]|\d)\))\s*/, "");
}
/**
 * Role of one value line inside a compound column. Explicit markers decide;
 * an ordered header assigns the n-th printed line; a slash column assigns
 * unmarked lines to its first part. Unknown markers never guess.
 */
export function subfieldRole(label: CompoundLabel, text: string, lineIndex: number): string | null {
  const m = subfieldMarker(text);
  if (label.kind === "marker") return m && m !== "/" ? label.parts.find((p) => p.marker === m)?.role ?? null : null;
  if (label.kind === "slash") return m === "/" ? label.parts[1].role : m ? null : label.parts[0].role;
  return m ? null : label.parts[lineIndex]?.role ?? null;
}
