import { test, expect } from "@playwright/test";
import {
  blLabel,
  choose,
  start,
  mockPreparation,
} from "../fixtures/shipping-ui";
test("shipping workspace validates formats, has three slots and fits mobile", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "PDF 원문만 확인" }).check();
  await expect(
    page.getByRole("heading", { name: "적하목록 신고 전, 원문부터 정확하게." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "비교 자료 준비", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("region", { name: /업로드 영역/ })).toHaveCount(
    3,
  );
  await page.getByLabel(blLabel).setInputFiles({
    name: "invalid.png",
    mimeType: "image/png",
    buffer: Buffer.from("bad"),
  });
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: /현재 단계와|합성 서버 오류|텍스트 기반 PDF/ }),
  ).toContainText("텍스트 기반 PDF");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("actual server PDF preparation reads pages and blocks without OpenAI, independently of key presence", async ({
  page,
}) => {
  await page.goto("/");
  await choose(page);
  await start(page);
  await expect(
    page.getByRole("heading", { name: "PDF 자료 준비 완료", exact: true }),
  ).toBeVisible({ timeout: 45000 });
  await expect(page.getByText("분석 미실시", { exact: true })).toBeVisible();
  await page
    .getByText("페이지별 PDF 원문 보기", { exact: true })
    .first()
    .click();
  await expect(page.getByText("PAGE 2", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Packages: 20 CTNS/).first()).toBeVisible();
  await page
    .getByText("실제 텍스트 블록·위치 보기", { exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Packages: 20 CTNS" }).click();
  await expect(page.getByRole("dialog")).toContainText("필드 의미 검증 미실시");
  await expect(page.getByRole("dialog")).toContainText("실제 PDF 블록 위치");
  await page.keyboard.press("Escape");
});
test("user input retains separate unverified provenance, restore and reset", async ({
  page,
}) => {
  await mockPreparation(page);
  await page
    .getByText("문서별 필드 확인·사용자 입력 (AI 추출 미실시)", { exact: true })
    .first()
    .click();
  await page.getByLabel("House B/L · 포장 개수", { exact: true }).fill("20");
  await page
    .getByRole("button", { name: "사용자 수정", exact: false })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toContainText("사용자가 수정한 값");
  await expect(page.getByRole("dialog")).toContainText(
    "원문 근거 후보가 없습니다",
  );
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() => !!document.activeElement?.closest("dialog")),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "사용자 입력 초기화" })
    .first()
    .click();
  await expect(
    page.getByLabel("House B/L · 포장 개수", { exact: true }),
  ).toHaveValue("");
  await page.getByRole("button", { name: "새 서류 검토" }).click();
  await expect(
    page.getByRole("button", { name: "비교 자료 준비", exact: true }),
  ).toBeDisabled();
});
