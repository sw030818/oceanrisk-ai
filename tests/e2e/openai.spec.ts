import { test, expect } from "@playwright/test";
import { choose, start } from "../fixtures/shipping-ui";
test("external OpenAI disclosure and explicit free PDF-only mode are explicit, without an access code", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText(/PDF에서 읽은 글자와 위치 정보를 OpenAI로/),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "서류 간 대조는 분석 후",
  );
  await expect(
    page.getByText(/PDF 원문만 보기.{0,2}는 OpenAI를 사용하지 않습니다/),
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
