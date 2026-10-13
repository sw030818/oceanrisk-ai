import { test, expect, type Page } from "@playwright/test";
import { shipping31Fixture } from "../fixtures/shipping31";
import {
  shippingTypes,
  shippingLabels,
  type ShippingType,
} from "../../src/modules/shipping/catalog";
import { groundShipping } from "../../src/modules/shipping/ground";
import { summarizeShipping } from "../../src/modules/shipping/summary";
import type { ShippingResult } from "../../src/modules/shipping/prepare";
async function mockedAnalysis(
  page: Page,
  options: {
    mismatch?: boolean;
    badEvidence?: boolean;
    failure?: boolean;
    missing?: boolean;
  } = {},
) {
  const fixtures = await Promise.all(
      shippingTypes.map((t) =>
        shipping31Fixture(t, {
          badEvidence: options.badEvidence,
          missing: options.missing,
        }),
      ),
    ),
    slots: ShippingType[] = options.mismatch
      ? ["house_manifest", "export_declaration", "house_bl"]
      : [...shippingTypes];
  const results: ShippingResult[] = fixtures.map((f, i) => ({
    pdf: f.pdf,
    document: groundShipping(f.wire, f.pdf, slots[i]),
    uploadSlot: slots[i],
    originalUploadSlot: slots[i],
    detectedType: shippingTypes[i],
    typeMismatch: slots[i] !== shippingTypes[i],
    error: null,
    aiModel: "gpt-6-luna",
  }));
  if (options.failure) {
    results[0].error = {
      code: "API_RATE_LIMIT",
      message: "OpenAI 이용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.",
    };
    results[0].document = null;
  }
  let requests = 0;
  await page.route("**/api/analyze", async (route) => {
    requests++;
    expect(route.request().postDataBuffer()!.toString()).toContain("analyze");
    await route.fulfill({
      json: {
        mode: "shipping-analysis",
        phase: "3.1",
        results,
        summary: summarizeShipping(results),
        review: { status: "not_performed", checks: [] },
        capabilities: { aiExtraction: true, triangularComparison: false },
      },
    });
  });
  await page.goto("/");
  for (const [i, f] of fixtures.entries())
    await page
      .getByLabel(shippingLabels[slots[i]].title + " PDF 파일 선택")
      .setInputFiles({
        name: f.pdf.fileName,
        mimeType: "application/pdf",
        buffer: Buffer.from(f.bytes),
      });
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "서류 분석 시작", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /문서별 분석 완료|문서 분석 일부 성공/ }),
  ).toBeVisible();
  return { fixtures, results, requests: () => requests };
}
test("MOCKED AI: three actual synthetic PDF types expose multiple items, containers, cargo and declarations", async ({
  page,
}) => {
  await mockedAnalysis(page);
  await expect(page.getByText(/AI 분류: House B\/L/)).toBeVisible();
  await expect(page.getByText(/AI 분류: 수출신고필증/)).toBeVisible();
  await expect(page.getByText(/AI 분류: House 적하목록/)).toBeVisible();
  await expect(page.getByText("분석 미실시", { exact: true })).toBeVisible();
  await page
    .getByText("AI 추출값·원문 근거 확인 및 수정", { exact: true })
    .nth(1)
    .click();
  await page
    .getByTestId("shipping-document")
    .nth(1)
    .getByText("품목 1 · Steel Bolts Precision Grade", { exact: true })
    .click();
  await expect(
    page
      .getByTestId("shipping-document")
      .nth(1)
      .getByLabel("품목 1 · HS Code", { exact: true }),
  ).toHaveValue("0303890000");
  await expect(
    page
      .getByTestId("shipping-document")
      .nth(1)
      .getByLabel("품목 1 · 물품 수량", { exact: true }),
  ).toHaveValue("500");
  await expect(
    page
      .getByTestId("shipping-document")
      .nth(1)
      .getByLabel("품목 1 · 포장 개수", { exact: true }),
  ).toHaveValue("20");
  await page
    .getByTestId("shipping-document")
    .nth(1)
    .getByText("컨테이너 2 · EFGH7654321", { exact: true })
    .click();
  await expect(
    page
      .getByTestId("shipping-document")
      .nth(1)
      .getByLabel("컨테이너 2 · 총중량", { exact: true }),
  ).toHaveValue("340");
});
test("MOCKED AI: mobile source page/blocks, original/current correction and restore", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockedAnalysis(page);
  await page
    .getByText("AI 추출값·원문 근거 확인 및 수정", { exact: true })
    .nth(1)
    .click();
  await page
    .getByTestId("shipping-document")
    .nth(1)
    .getByText("품목 1 · Steel Bolts Precision Grade", { exact: true })
    .click();
  const input = page
    .getByTestId("shipping-document")
    .nth(1)
    .getByLabel("품목 1 · 물품 수량", { exact: true });
  await input.locator("..").locator("..").getByRole("button").click();
  await expect(page.getByRole("dialog")).toContainText("2페이지");
  await expect(page.getByRole("dialog")).toContainText("실제 PDF 블록 위치");
  await page.keyboard.press("Escape");
  await input.fill("510");
  await input.locator("..").locator("..").getByRole("button").click();
  await expect(page.getByRole("dialog")).toContainText("사용자가 수정한 값");
  await page.keyboard.press("Escape");
  await page
    .getByTestId("shipping-document")
    .nth(1)
    .getByRole("button", { name: "원래 AI 추출값 복원" })
    .click();
  await expect(input).toHaveValue("500");
  await expect(
    input.locator("..").locator("..").getByRole("button"),
  ).toContainText("원문 대조 완료");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("MOCKED AI: mismatched actual type displays actual fields, slot swap preserves original choice with no new API request", async ({
  page,
}) => {
  const { requests } = await mockedAnalysis(page, { mismatch: true });
  await expect(
    page.getByRole("alert").filter({ hasText: "문서 유형 불일치" }),
  ).toHaveCount(2);
  await page
    .getByText("AI 추출값·원문 근거 확인 및 수정", { exact: true })
    .first()
    .click();
  await expect(
    page.getByLabel("House B/L · Notify Party / 통지처", { exact: true }),
  ).toHaveValue("Notify Logistics Ltd.");
  await page
    .getByRole("button", {
      name: "분류된 유형으로 영역 변경 (기존 파일과 교환)",
    })
    .first()
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "문서 유형 불일치" }),
  ).toHaveCount(0);
  await expect(page.getByText(/최초 선택: House 적하목록/)).toBeVisible();
  expect(requests()).toBe(1);
});
test("MOCKED AI: wrong container row remains unverified, partial result does not hide independent fields", async ({
  page,
}) => {
  await mockedAnalysis(page, { badEvidence: true });
  await expect(
    page.getByRole("heading", { name: "문서 분석 일부 성공 · 확인 필요" }),
  ).toBeVisible();
  await page
    .getByText("AI 추출값·원문 근거 확인 및 수정", { exact: true })
    .first()
    .click();
  await page
    .getByText("컨테이너 1 · ABCD1234567", { exact: true })
    .first()
    .click();
  const input = page.getByLabel("컨테이너 1 · 총중량", { exact: true }).first();
  await expect(
    input.locator("..").locator("..").getByRole("button"),
  ).toContainText("근거 미확인");
  await expect(
    page.getByLabel("House B/L · 총중량", { exact: true }),
  ).toHaveValue("12340");
});
test("MOCKED AI: partial provider failure retains original PDF and clearly identifies quota error", async ({
  page,
}) => {
  await mockedAnalysis(page, { failure: true });
  await expect(page.getByText("오류 코드: API_RATE_LIMIT")).toBeVisible();
  await expect(
    page.getByText("AI 분석 실패 · PDF 보존", { exact: true }),
  ).toBeVisible();
  await page
    .getByText("페이지별 PDF 원문 보기", { exact: true })
    .first()
    .click();
  await expect(page.getByText("PAGE 2", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("분석 미실시", { exact: true })).toBeVisible();
});
test("ACTUAL LOCAL server without key: no provider request, readable PDF retained and later AI work stopped", async ({
  page,
}) => {
  const fixtures = await Promise.all(
    ["house_bl", "house_manifest"].map((t) =>
      shipping31Fixture(t as ShippingType),
    ),
  );
  await page.goto("/");
  for (const [i, f] of fixtures.entries())
    await page
      .getByLabel(
        shippingLabels[i ? "house_manifest" : "house_bl"].title +
          " PDF 파일 선택",
      )
      .setInputFiles({
        name: f.pdf.fileName,
        mimeType: "application/pdf",
        buffer: Buffer.from(f.bytes),
      });
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "서류 분석 시작", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "문서 분석 실패", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("오류 코드: API_NOT_CONFIGURED")).toBeVisible();
  await expect(page.getByText("오류 코드: BATCH_STOPPED")).toBeVisible();
  await expect(
    page.getByText("AI 분석 실패 · PDF 보존", { exact: true }),
  ).toHaveCount(2);
});
