import { z } from 'zod';
import { AnalysisError } from '../documents/errors';
import type { UploadSlot } from '../documents/schema';
export function parseUploadSlots(raw: FormDataEntryValue | null, count: number): UploadSlot[] | undefined {
  if (raw === null) return undefined; // Legacy multipart clients remain supported.
  try {
    if (typeof raw !== 'string' || raw.length > 256) throw new Error();
    const values = z.array(z.enum(['invoice','packing_list'])).max(4).parse(JSON.parse(raw));
    if (values.length !== count) throw new Error();
    return values;
  } catch { throw new AnalysisError('INVALID_UPLOAD_SLOTS', '업로드 영역 정보가 파일 개수 또는 지원 유형과 맞지 않습니다.',400); }
}
