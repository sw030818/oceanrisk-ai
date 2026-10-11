import { AnalysisError } from "../documents/errors";
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
