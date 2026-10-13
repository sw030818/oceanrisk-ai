import { test, expect } from "@playwright/test";
import { choose, start, mockPreparation } from "../fixtures/shipping-ui";
test("pending comparison is explicit and mobile results do not overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockPreparation(page);
  await expect(page.getByText("분석 미실시", { exact: true })).toBeVisible();
  await expect(
    page.getByText("확인된 수량 불일치 0건", { exact: false }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("partial preparation preserves readable PDF and reports the failed file", async ({
  page,
}) => {
  await mockPreparation(page, { broken: true });
  await expect(
    page.getByRole("heading", { name: "자료 준비 일부 완료" }),
  ).toBeVisible();
  await expect(page.getByText("오류 코드: INVALID_PDF")).toBeVisible();
  await expect(page.getByText("대상 서류 부족", { exact: true })).toBeVisible();
  await page.getByText("페이지별 PDF 원문 보기").click();
  await expect(page.getByText(/Goods: Steel Bolts/).first()).toBeVisible();
});
test("loading, no bearer header, server error and retry stay clear", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route("**/api/analyze", async (route) => {
    expect(route.request().headers().authorization).toBeUndefined();
    await gate;
    await route.fulfill({
      status: 503,
      json: { error: { message: "합성 서버 오류" } },
    });
  });
  await page.goto("/");
  await choose(page);
  await start(page);
  await expect(
    page.getByRole("button", { name: "문서 처리 중" }),
  ).toBeVisible();
  release();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: /분석 응답 형식|합성 서버 오류|PDF 파일만/ })
      .first(),
  ).toContainText("합성 서버 오류");
  await expect(
    page.getByRole("button", { name: "새 서류 검토", exact: true }),
  ).toBeEnabled();
});
test("all unreadable PDFs produce failure, never an AI success", async ({
  page,
}) => {
  await mockPreparation(page, { allBroken: true });
  await expect(
    page.getByRole("heading", { name: "자료 준비 실패", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("오류 코드: INVALID_PDF")).toHaveCount(2);
  await expect(page.getByText("확인된 일치", { exact: true })).toHaveCount(0);
});
