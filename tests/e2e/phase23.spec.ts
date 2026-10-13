// UI contract intentionally changed: previous quantitative conclusions remain
// covered by all legacy unit regressions; PHASE 3.0 must not expose them here.
import { test, expect } from "@playwright/test";
import { mockPreparation } from "../fixtures/shipping-ui";
test("shipping field names distinguish declared goods quantity from package count", async ({
  page,
}) => {
  await mockPreparation(page, { three: true });
  await page
    .getByText("문서별 필드 확인·사용자 입력 (AI 추출 미실시)", { exact: true })
    .nth(1)
    .click();
  await expect(
    page.getByLabel("수출신고필증 · 물품 수량", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("수출신고필증 · 포장 개수", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("수출신고필증 · 신고 중량", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("수출신고필증 · 물품 수량", { exact: true })
    .fill("500");
  await page.getByLabel("수출신고필증 · 포장 개수", { exact: true }).fill("20");
  await expect(page.getByText("분석 미실시", { exact: true })).toBeVisible();
  await expect(page.getByText("확인된 불일치", { exact: true })).toHaveCount(0);
});
test("misleading filenames do not become an AI document-type verdict", async ({
  page,
}) => {
  await mockPreparation(page);
  await expect(
    page.getByText(/선택 영역: House B\/L · 실제 분류 미실시/),
  ).toBeVisible();
  await expect(
    page.getByText("서류 종류 확인 필요", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Commercial Invoice", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Packing List", { exact: true })).toHaveCount(0);
});
test("original PDF evidence and manual corrections remain inspectable on mobile with no quantitative claim", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockPreparation(page);
  await page
    .getByText("문서별 필드 확인·사용자 입력 (AI 추출 미실시)", { exact: true })
    .first()
    .click();
  await page.getByLabel("House B/L · 총중량", { exact: true }).fill("320");
  await page
    .getByRole("button", { name: "사용자 수정", exact: false })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toContainText("사용자가 수정한 값");
  await page.keyboard.press("Escape");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.getByText("분석 미실시", { exact: true })).toBeVisible();
});
