import type { AnalysisResult } from "../documents/schema";
export function summarizeAnalysis(results: AnalysisResult[]) {
  const analyzed = results.filter(
    (result) => result.document && !result.error,
  ).length;
  const readable = results.filter(
    (result) => result.pdf.pages.length > 0,
  ).length;
  if (results.length > 0 && analyzed === results.length)
    return {
      status: "success" as const,
      title: "분석 응답 완료",
      message: `${analyzed}개 문서의 AI 추출 응답을 받았습니다. 필드별 근거와 검증 불가 항목을 확인해 주세요.`,
    };
  if (readable > 0)
    return {
      status: "partial" as const,
      title: "부분 처리 완료",
      message: `원문 추출 ${readable}/${results.length}개 · AI 추출 ${analyzed}/${results.length}개. 완료되지 않은 파일의 오류를 확인해 주세요.`,
    };
  return {
    status: "failed" as const,
    title: "분석 실패",
    message:
      "읽을 수 있는 원문이나 AI 추출 결과를 얻지 못했습니다. 아래 파일별 오류를 확인해 주세요.",
  };
}
