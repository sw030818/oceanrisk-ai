import { test, expect } from "@playwright/test";
test("OpenAI disclosure and missing-key state preserve PDF-only analysis and mobile layout", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText(/추출 텍스트가 OpenAI로 전송됩니다/),
  ).toBeVisible();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "OpenAI API 키가 설정되지 않았습니다" }),
  ).toBeVisible();
  await expect(page.getByText(/Google Gemini로 전송/)).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("OpenAI provider 429 preserves readable PDF and shows quota message without a false match", async ({
  page,
}) => {
  await page.route("**/api/analyze", (route) =>
    route.fulfill({
      json: {
        aiConfigured: true,
        results: [
          {
            pdf: {
              id: "synthetic",
              fileName: "synthetic.pdf",
              pages: [{ page: 1, text: "Commercial Invoice" }],
            },
            document: null,
            error: {
              code: "API_RATE_LIMIT",
              message:
                "OpenAI API의 이용 한도 또는 결제 잔액이 부족합니다. 프로젝트 예산과 결제 설정을 확인해 주세요.",
            },
          },
        ],
      },
    }),
  );
  await page.goto("/");
  await page
    .getByLabel("Commercial Invoice PDF 파일 선택")
    .setInputFiles({
      name: "synthetic.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-synthetic-ui"),
    });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "서류 분석 시작" }).click();
  await expect(
    page.getByRole("heading", { name: "부분 처리 완료" }),
  ).toBeVisible();
  await expect(
    page.getByText(/OpenAI API의 이용 한도 또는 결제 잔액이 부족/),
  ).toBeVisible();
  await expect(page.getByText("오류 코드: API_RATE_LIMIT")).toBeVisible();
  await expect(page.getByText("확인된 일치", { exact: true })).toHaveCount(0);
  await expect(page.getByText("수량 차이", { exact: true })).toHaveCount(0);
});
