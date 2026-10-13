import { test, expect } from "@playwright/test";
import { choose, start } from "../fixtures/shipping-ui";
test("external OpenAI disclosure and explicit free PDF-only mode are explicit, without an access code", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText(
      /AI 분석에서는 추출 텍스트·위치 정보가 외부 OpenAI API로 전송/,
    ),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "삼각대조는 아직 실행하지 않습니다",
  );
  await expect(
    page.getByText(/PDF 원문만 확인을 선택하면 OpenAI로 전송하지 않습니다/),
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
      .filter({ hasText: /현재 단계와|합성 서버 오류|텍스트 기반 PDF/ }),
  ).toContainText("현재 단계와 맞지 않는 분석 응답");
  await expect(page.getByText("확인된 일치", { exact: true })).toHaveCount(0);
});
