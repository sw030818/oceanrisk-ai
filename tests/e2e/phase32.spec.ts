import { test, expect, type Page } from "@playwright/test";
import { shipping32Fixture, type Scenario32 } from "../fixtures/shipping32";
import {
  shippingTypes,
  shippingLabels,
  type ShippingType,
} from "../../src/modules/shipping/catalog";
import { reviewShipping } from "../../src/modules/shipping/review";
import { summarizeShipping } from "../../src/modules/shipping/summary";
import type { ShippingResult } from "../../src/modules/shipping/prepare";
async function mock32(
  page: Page,
  options: {
    two?: boolean;
    scenario?: Scenario32;
    partial?: boolean;
    extra?: boolean;
    mismatchSlots?: boolean;
  } = {},
) {
  const types: ShippingType[] = options.two
      ? ["house_bl", "house_manifest"]
      : [...shippingTypes],
    fixtures = await Promise.all(
      types.map((t) => shipping32Fixture(t, options.scenario ?? "normal")),
    );
  if (options.extra)
    fixtures.push(
      await shipping32Fixture("export_declaration", "normal", {
        id: "extra-declaration",
        declaration: "03000-26-0032002",
        roots: { packageCount: 20 },
      }),
    );
  const slots = options.mismatchSlots
    ? (["house_manifest", "export_declaration", "house_bl"] as ShippingType[])
    : [...types, ...(options.extra ? ["export_declaration" as const] : [])];
  const results: ShippingResult[] = fixtures.map((f, i) => ({
    pdf: f.pdf,
    uploadSlot: slots[i],
    document: { ...f.document, uploadType: slots[i] },
    detectedType: f.document.detectedType,
    typeMismatch: f.document.detectedType !== slots[i],
    error: null,
  }));
  if (options.partial) {
    results[1].document = null;
    results[1].error = {
      code: "API_AUTH_OR_CONFIG",
      message: "합성 API 인증 오류; 원문은 보존했습니다.",
    };
  }
  let calls = 0;
  await page.route("**/api/analyze", (route) => {
    calls++;
    if (options.extra)
      expect(route.request().postDataBuffer()!.toString()).toContain(
        '["house_bl","export_declaration","house_manifest","export_declaration"]',
      );
    const review = reviewShipping(
      results.flatMap((r) => (r.document ? [r.document] : [])),
    );
    return route.fulfill({
      json: {
        mode: "shipping-analysis",
        phase: "3.2",
        results,
        summary: summarizeShipping(results, review),
        review,
        capabilities: { pairComparison: true, triangularComparison: true },
      },
    });
  });
  await page.goto("/");
  for (const [i, f] of fixtures.entries()) {
    if (i === 3) {
      await page
        .getByRole("button", { name: "복수 신고·분할 자료 PDF 추가" })
        .click();
      await page.getByLabel("추가 수출신고필증 PDF 파일 선택").setInputFiles({
        name: f.pdf.fileName,
        mimeType: "application/pdf",
        buffer: Buffer.from(f.bytes),
      });
    } else
      await page
        .getByLabel(shippingLabels[slots[i]].title + " PDF 파일 선택", {
          exact: true,
        })
        .setInputFiles({
          name: f.pdf.fileName,
          mimeType: "application/pdf",
          buffer: Buffer.from(f.bytes),
        });
  }
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "서류 분석 시작", exact: true })
    .click();
  await expect(page.getByTestId("shipping-review")).toBeVisible();
  return { calls: () => calls, results };
}
test("MOCK AI + real PDF: two types run pair comparison and explicitly lack triangle targets", async ({
  page,
}) => {
  await mock32(page, { two: true });
  await expect(page.getByText("대상 3종 부족", { exact: true })).toBeVisible();
  await expect(page.getByTestId("shipping-review")).toContainText("양자 검사");
  await page
    .getByRole("button", { name: "일치·정보 부족 포함 전체 보기" })
    .click();
  await expect(
    page.locator(
      '[data-testid="shipping-check"][data-assessment="confirmed_match"]',
    ),
  ).not.toHaveCount(0);
  await expect(
    page.locator('[data-testid="shipping-check"][data-scope="triangle"]'),
  ).toHaveCount(0);
});
test("MOCK AI + real PDF: three normal documents show confirmed shared triangle with no false definitive warning", async ({
  page,
}) => {
  await mock32(page);
  await expect(
    page.getByText("검증 범위 대조 실행", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("shipping-review")).toContainText(
    "확정 불일치",
  );
  await page
    .getByRole("button", { name: "일치·정보 부족 포함 전체 보기" })
    .click();
  await expect(
    page.locator(
      '[data-testid="shipping-check"][data-scope="triangle"][data-assessment="confirmed_match"]',
    ),
  ).toHaveCount(3);
  await expect(
    page.locator(
      '[data-testid="shipping-check"][data-assessment="confirmed_mismatch"]',
    ),
  ).toHaveCount(0);
});
test("MOCK AI + real PDF: multiple actual differences expose file/page/blocks and follow-up action", async ({
  page,
}) => {
  await mock32(page, { scenario: "mismatch" });
  const errors = page.locator(
    '[data-testid="shipping-check"][data-assessment="confirmed_mismatch"]',
  );
  expect(await errors.count()).toBeGreaterThan(1);
  await expect(errors.first()).toContainText("다음 확인:");
  await errors.first().getByRole("button").first().click();
  await expect(page.getByRole("dialog")).toContainText("실제 PDF 블록 위치");
  await expect(page.getByRole("dialog")).toContainText("원문 대조 완료");
  await page.keyboard.press("Escape");
});
test("MOCK AI + real PDF: mobile edit/restore recalculates provisional result without another OpenAI request", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { calls } = await mock32(page);
  await page
    .getByText("AI 추출값·원문 근거 확인 및 수정", { exact: true })
    .first()
    .click();
  await page.getByLabel("House B/L · 포장 개수", { exact: true }).fill("31");
  await expect(
    page.locator(
      '[data-testid="shipping-check"][data-assessment="provisional_mismatch"]',
    ),
  ).not.toHaveCount(0);
  await page
    .getByTestId("shipping-document")
    .first()
    .getByRole("button", { name: "원래 AI 추출값 복원" })
    .click();
  await expect(
    page.locator(
      '[data-testid="shipping-check"][data-assessment="provisional_mismatch"]',
    ),
  ).toHaveCount(0);
  expect(calls()).toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("MOCK AI + real PDF: uncertain references retain candidates and never pretend to complete a triangle", async ({
  page,
}) => {
  await mock32(page, { scenario: "uncertain" });
  await expect(
    page.getByText("공통 연결 확인 필요", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("shipping-review")).toContainText("확인 필요");
  await page
    .getByRole("button", { name: "일치·정보 부족 포함 전체 보기" })
    .click();
  await expect(
    page.locator(
      '[data-testid="shipping-check"][data-assessment="confirmed_mismatch"]',
    ),
  ).toHaveCount(0);
  await expect(
    page.locator(
      '[data-testid="shipping-check"][data-assessment="provisional_match"]',
    ),
  ).not.toHaveCount(0);
});
test("MOCK AI + real PDF: one provider failure does not stop the remaining pair review", async ({
  page,
}) => {
  await mock32(page, { partial: true });
  await expect(page.getByText("오류 코드: API_AUTH_OR_CONFIG")).toBeVisible();
  await expect(page.getByText("대상 3종 부족", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "일치·정보 부족 포함 전체 보기" })
    .click();
  await expect(
    page.locator(
      '[data-testid="shipping-check"][data-assessment="confirmed_match"]',
    ),
  ).not.toHaveCount(0);
});
test("MOCK AI + real PDF: an extra declaration remains a fourth qualified document, without duplicate sums", async ({
  page,
}) => {
  await mock32(page, { extra: true });
  await expect(page.getByTestId("shipping-document")).toHaveCount(4);
  await expect(
    page.locator(
      '[data-testid="shipping-check"][data-category="packaging"][data-assessment="confirmed_mismatch"]',
    ),
  ).toHaveCount(0);
  await expect(page.getByTestId("shipping-review")).toContainText("복수 문서");
});
test("MOCK AI + real PDF: actual classification governs review despite wrong upload slots", async ({
  page,
}) => {
  await mock32(page, { mismatchSlots: true });
  await expect(
    page.getByRole("alert").filter({ hasText: "문서 유형 불일치" }),
  ).toHaveCount(2);
  await expect(
    page.getByText("검증 범위 대조 실행", { exact: true }),
  ).toBeVisible();
});
test("MOCK AI + real PDF: explicit user relationship confirmation remains provisional and costs no new request", async ({
  page,
}) => {
  const { calls } = await mock32(page, { scenario: "uncertain" });
  await page.getByText("선적 연결 근거와 범위 확인", { exact: true }).click();
  await page
    .getByRole("button", { name: "동일 선적 사용자 확인 (잠정)" })
    .first()
    .click();
  await expect(
    page.getByText("사용자 연결 확인 · 잠정", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(
      '[data-testid="shipping-check"][data-assessment="confirmed_mismatch"]',
    ),
  ).toHaveCount(0);
  expect(calls()).toBe(1);
});
