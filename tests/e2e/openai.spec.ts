import { test, expect } from "@playwright/test";
import { choose, start } from "../fixtures/shipping-ui";
test("external OpenAI disclosure and explicit free PDF-only mode are explicit, without an access code", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText(/AI 분석은 추출 텍스트·위치 정보를 OpenAI에 전송/),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "삼각대조는 아직 실행하지 않습니다",
  );
  await expect(
    page.getByText(/PDF 원문만 보기는 OpenAI를 호출하지 않습니다/),
  ).toBeVisible();
  await expect(page.getByLabel(/접근 코드/)).toHaveCount(0);
  await expect(page.getByText(/Google Gemini로 전송/)).toHaveCount(0);
});
test("an old live AI response is rejected rather than shown as shipping verification", async ({
  page,
}) => {
  await page.route("**/api/analyze", (route) =>
    route.fulfill({ json: { mode: "live", aiConfigured: true, results: [] } }),
  );
  await page.goto("/");
  await choose(page);
  await start(page);
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: /분석 응답 형식|합성 서버 오류|PDF 파일만/ })
      .first(),
  ).toContainText("분석 응답 형식이 올바르지 않습니다");
  await expect(page.getByText("확인된 일치", { exact: true })).toHaveCount(0);
});
