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
      .min(1)
      .max(4)
      .parse(JSON.parse(raw));
    if (slots.length !== count) throw new Error();
    return slots;
  } catch {
    throw new AnalysisError(
      "INVALID_UPLOAD_SLOTS",
      "각 PDF의 업로드 영역 정보가 필요하며 파일 개수와 일치해야 합니다.",
      400,
    );
  }
}
export function parseShippingIds(
  raw: FormDataEntryValue | null,
  count: number,
): string[] | undefined {
  if (raw === null) return undefined;
  try {
    if (typeof raw !== "string" || raw.length > 512) throw new Error();
    const ids = z
      .array(z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/))
      .length(count)
      .parse(JSON.parse(raw));
    if (new Set(ids).size !== ids.length) throw new Error();
    return ids;
  } catch {
    throw new AnalysisError(
      "INVALID_DOCUMENT_IDS",
      "파일 식별자 정보가 올바르지 않습니다.",
      400,
    );
  }
}
