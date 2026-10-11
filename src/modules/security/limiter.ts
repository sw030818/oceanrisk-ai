import { AnalysisError } from "../documents/errors";
// Per-instance safeguards; serverless instances do not share these counters.
// Production also requires an access token. Configure provider quotas for a hard global budget.
export function createAnalysisLimiter(now: () => number = Date.now) {
  let requests: number[] = [],
    calls: number[] = [],
    active = 0;
  return {
    checkRequest() {
      const time = now();
      requests = requests.filter((at) => time - at < 60000);
      if (requests.length >= 10)
        throw new AnalysisError(
          "REQUEST_RATE_LIMIT",
          "분석 요청이 많습니다. 1분 후 다시 시도해 주세요.",
          429,
        );
      requests.push(time);
    },
    reserve(files: number, usesAi: boolean) {
      const time = now();
      calls = calls.filter((at) => time - at < 3600000);
      if (active >= 2)
        throw new AnalysisError(
          "ANALYSIS_BUSY",
          "다른 분석을 처리 중입니다. 잠시 후 다시 시도해 주세요.",
          429,
        );
      if (usesAi && calls.length + files > 24)
        throw new AnalysisError(
          "AI_BUDGET_LIMIT",
          "이 서버의 시간당 AI 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.",
          429,
        );
      if (usesAi) for (let i = 0; i < files; i++) calls.push(time);
      active++;
      let released = false;
      return () => {
        if (!released) {
          active--;
          released = true;
        }
      };
    },
  };
}
const globalState = globalThis as typeof globalThis & {
  oceanRiskLimiter?: ReturnType<typeof createAnalysisLimiter>;
};
export const analysisLimiter = (globalState.oceanRiskLimiter ??=
  createAnalysisLimiter());
