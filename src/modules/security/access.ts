import { createHash, timingSafeEqual } from "node:crypto";
import { AnalysisError } from "../documents/errors";
const usableToken = (token?: string) =>
  Boolean(token && /^[A-Za-z0-9_-]{32,256}$/.test(token));
export function accessSettings() {
  const token = process.env.ANALYSIS_ACCESS_TOKEN;
  return {
    required: process.env.NODE_ENV === "production" || Boolean(token),
    configured: usableToken(token),
  };
}
export function requireAnalysisAccess(
  request: Request,
  options = {
    required: accessSettings().required,
    token: process.env.ANALYSIS_ACCESS_TOKEN,
  },
) {
  if (!options.required) return;
  if (!options.token || !usableToken(options.token))
    throw new AnalysisError(
      "ACCESS_NOT_CONFIGURED",
      "분석 접근 제한이 설정되지 않았습니다. 운영자가 서버의 접근 코드를 설정해야 합니다.",
      503,
    );
  const supplied = /^Bearer ([^\r\n]{1,256})$/.exec(
    request.headers.get("authorization") ?? "",
  )?.[1];
  const hash = (value: string) => createHash("sha256").update(value).digest();
  if (!supplied || !timingSafeEqual(hash(supplied), hash(options.token)))
    throw new AnalysisError(
      "ACCESS_DENIED",
      "분석 접근 코드가 없거나 올바르지 않습니다. 운영자에게 받은 접근 코드를 확인해 주세요.",
      401,
    );
}
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin && request.headers.get("sec-fetch-site") !== "cross-site") return;
  let matches = false;
  try {
    const target = new URL(request.url);
    // Next may normalize request.url to localhost behind its server/proxy.
    // Host is the browser's destination; do not trust arbitrary forwarded-host values.
    const host = request.headers.get("host") ?? target.host;
    const protocol =
      request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ??
      target.protocol.slice(0, -1);
    const expected = new URL(`${protocol}://${host}`).origin;
    matches = Boolean(
      origin &&
        new URL(origin).origin === expected &&
        request.headers.get("sec-fetch-site") !== "cross-site",
    );
  } catch {
    /* Malformed/null browser origins are denied. */
  }
  if (!matches)
    throw new AnalysisError(
      "CROSS_ORIGIN_DENIED",
      "다른 사이트에서 시작한 분석 요청은 허용되지 않습니다.",
      403,
    );
}
