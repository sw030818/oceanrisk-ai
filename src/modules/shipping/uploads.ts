import { z } from "zod";
import { AnalysisError } from "../documents/errors";
import { shippingTypeSchema } from "./schema";
import type { ShippingType } from "./catalog";
export function parseShippingSlots(
  raw: FormDataEntryValue | null,
  count: number,
): ShippingType[] {
  if (typeof raw === "string" && /"(?:invoice|packing_list)"/.test(raw))
    throw new AnalysisError(
      "LEGACY_ANALYSIS_DISABLED",
      "Invoice·Packing List 분석 경로는 종료되었습니다. 화면을 새로고침한 뒤 House B/L·수출신고필증·House 적하목록을 선택해 주세요.",
      409,
    );
  try {
    if (typeof raw !== "string" || raw.length > 256) throw new Error();
    const slots = z
      .array(shippingTypeSchema)
      .min(2)
      .max(4)
      .parse(JSON.parse(raw));
    if (slots.length !== count || new Set(slots).size < 2) throw new Error();
    return slots;
  } catch {
    throw new AnalysisError(
      "INVALID_UPLOAD_SLOTS",
      "서로 다른 종류의 선적서류를 최소 2개 선택해 주세요. 업로드 영역 정보는 파일 개수와 일치해야 합니다.",
      400,
    );
  }
}
