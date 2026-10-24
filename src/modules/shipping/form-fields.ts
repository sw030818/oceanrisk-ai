// Fields each document type's standard form actually prints. Official export
// forms differ: a 수출신고필증 has 적재항 and 목적국 but no House B/L number,
// port of discharge or Seal; a 혼재화물적하목록(별지 제4호) has no ports. A field
// that a form never prints is "not applicable" for that document, not missing.
const all = ["houseBlNumber", "declarationNumber", "containerNumber", "sealNumber", "portOfLoading", "portOfDischarge", "shipper", "consignee", "goodsDescription", "hsCode"];
const omitted: Record<string, string[]> = {
  export_declaration: ["houseBlNumber", "portOfDischarge", "sealNumber", "consignee", "shipper"],
  house_manifest: ["portOfLoading", "portOfDischarge"],
  house_bl: ["declarationNumber"],
};
export function formPrints(type: string | null | undefined, role: string): boolean {
  if (!type) return true;
  return !all.includes(role) || !(omitted[type] ?? []).includes(role);
}
export const requiredFields: Record<string, string[]> = {
  export_declaration: ["declarationNumber", "exporter", "goodsDescription", "hsCode", "quantity", "quantityUnit"],
  house_manifest: ["houseBlNumber", "shipper", "consignee", "goodsDescription", "packageCount", "grossWeight"],
  house_bl: ["houseBlNumber", "shipper", "consignee", "goodsDescription", "packageCount", "grossWeight", "portOfLoading", "portOfDischarge"],
};
