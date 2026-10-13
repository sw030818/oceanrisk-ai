// Semantic labels, bilingual and relative layout only; no company coordinates.
const labels: Record<string, RegExp> = {
  houseBlNumber:
    /^(?:house\s*b\/?l(?:\s*(?:no\.?|number|#))?|house bill of lading(?:\s*(?:no\.?|number))?|h\.?b\.?l\.?(?:\s*(?:no\.?|number|#))?|하우스\s*(?:b\/?l|선하증권)(?:\s*번호)?)$/i,
  declarationNumber:
    /^(?:export declaration(?:\s*(?:no\.?|number|reference))?|declaration(?:\s*(?:no\.?|number))|수출신고번호|수출 신고번호|신고번호)$/i,
  declarationDate:
    /^(?:declaration date|date of declaration|신고일자|신고일)$/i,
  shipper: /^(?:shipper|송하인|송화인)$/i,
  consignee: /^(?:consignee|수하인|수화인)$/i,
  notifyParty: /^(?:notify party|notify|통지처|통지인)$/i,
  exporter: /^(?:exporter|수출자|수출화주)$/i,
  exporterIdentifier:
    /^(?:exporter id|exporter identification|수출자 식별정보|수출자 사업자등록번호)$/i,
  declarant: /^(?:declarant|신고인)$/i,
  vessel: /^(?:vessel|vessel name|선박명)$/i,
  voyage: /^(?:voyage|voyage no\.?|항차)$/i,
  goodsDescription:
    /^(?:description|goods description|description of goods|품명|신고 품명)$/i,
  tradeDescription:
    /^(?:trade description|commercial description|거래품명|거래 품명)$/i,
  hsCode: /^(?:hs code|hs|h\.?s\.? code|세번|세번부호|hs 부호)$/i,
  quantity:
    /^(?:qty\.?|quantity|declared quantity|신고수량|신고 수량|물품수량|수량)$/i,
  quantityUnit: /^(?:uom|unit|quantity unit|단위|수량단위|수량 단위)$/i,
  packageCount:
    /^(?:number of packages|no\.? of packages|packages|package count|ctns?|pkgs?|cartons?|포장개수|포장 개수|포장수|포장 수량)$/i,
  packageUnit: /^(?:package unit|packaging unit|포장단위|포장 단위)$/i,
  grossWeight: /^(?:gross weight|gross wt\.?|g\.?w\.?|총중량|총 중량)$/i,
  netWeight: /^(?:net weight|net wt\.?|n\.?w\.?|순중량|순 중량)$/i,
  declaredWeight: /^(?:declared weight|신고중량|신고 중량)$/i,
  grossWeightUnit: /^(?:gross weight unit|weight unit|중량단위|총중량 단위)$/i,
  netWeightUnit: /^(?:net weight unit|순중량 단위)$/i,
  declaredWeightUnit: /^(?:declared weight unit|신고중량 단위)$/i,
  containerNumber:
    /^(?:container(?:\s*(?:no\.?|number|#))?|컨테이너번호|컨테이너 번호)$/i,
  sealNumber: /^(?:seal(?:\s*(?:no\.?|number|#))?|봉인번호|봉인 번호)$/i,
  portOfLoading: /^(?:port of loading|pol|선적항|적재항)$/i,
  portOfDischarge: /^(?:port of discharge|pod|양하항|하역항)$/i,
  shipmentScope: /^(?:shipment scope|선적 범위)$/i,
  shipmentReference:
    /^(?:shipment ref(?:erence)?|shipment no\.?|선적 참조번호)$/i,
  bookingReference: /^(?:booking no\.?|booking ref(?:erence)?|예약 번호)$/i,
  otherReference: /^(?:reference|ref\.?|기타 참조)$/i,
  totalQuantity:
    /^(?:total quantity|total qty\.?|총 신고수량|총 수량|수량 합계)$/i,
  totalPackageCount:
    /^(?:total packages|total package count|total ctns|총 포장수|포장 합계)$/i,
  totalGrossWeight:
    /^(?:total gross weight|gross weight total|총중량 합계|총 총중량)$/i,
  totalNetWeight:
    /^(?:total net weight|net weight total|순중량 합계|총 순중량)$/i,
};
export function shippingRole(text: string): string | null {
  const label = text
    .normalize("NFKC")
    .trim()
    .replace(/\s*[:=#-]\s*$/, "")
    .replace(/\s*\((?:[A-Za-z.]+|개|톤)\)\s*$/, "")
    .replace(/\s+/g, " ");
  return (
    Object.entries(labels).find(([, pattern]) => pattern.test(label))?.[0] ??
    null
  );
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
