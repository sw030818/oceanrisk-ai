import { test, expect, type Page } from "@playwright/test";
import { shipping34Fixture } from "../fixtures/shipping34";
import { fixture33, evaluation33 } from "../fixtures/shipping33";
import {
  shippingTypes,
  shippingLabels,
} from "../../src/modules/shipping/catalog";
import { routeShipping } from "../fixtures/shipping-route";
import type { ShippingResult } from "../../src/modules/shipping/prepare";
async function setup(page: Page, scenario = "normal") {
  const fs =
    scenario === "complex"
      ? await Promise.all(evaluation33("complex").map(fixture33))
      : await Promise.all(
          shippingTypes.map((t) =>
            shipping34Fixture(
              t,
              scenario === "mismatch" && t === "house_manifest"
                ? { packages: 54, weight: 610, seal: "OTHER-SEAL" }
                : {},
            ),
          ),
        );
  const results: ShippingResult[] = fs.map((f) => ({
    pdf: f.pdf,
    document: f.document,
    uploadSlot: f.wire.type as "house_bl",
    detectedType: f.document.detectedType,
    typeMismatch: false,
    error: null,
  }));
  if (scenario === "partial") {
    results[1].document = null;
    results[1].error = {
      code: "API_UNAVAILABLE",
      message: "합성 부분 실패. 다른 결과 보존",
    };
  }
  if (scenario === "uncertain")
    results[1].document = {
      ...results[1].document!,
      classificationStatus: "needs_review",
    };
  const transport = await routeShipping(page, results, "3.4");
  await page.goto("/");
  for (const t of shippingTypes)
    await page
      .getByLabel(shippingLabels[t].title + " PDF 파일 선택", { exact: true })
      .setInputFiles(
        fs
          .filter((f) => f.wire.type === t)
          .map((f) => ({
            name: f.pdf.fileName,
            mimeType: "application/pdf",
            buffer: Buffer.from(f.bytes),
          })),
      );
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "AI 서류 분석 시작", exact: true })
    .click();
  await expect(page.getByTestId("shipping-review")).toBeVisible();
  return transport;
}
for (const width of [1440, 390])
  test(`compact comparison, evidence drawer and navigation ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const calls = await setup(page);
    await page.getByLabel("검토 결과 필터").selectOption("all");
    await page.getByTestId("shipping-review").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/phase34-normal-${width}.png` });
    await expect(page.getByRole("table").first()).toBeVisible();
    expect(await page.getByTestId("comparison-row").count()).toBeLessThan(
      await page.getByTestId("shipping-check").count(),
    );
    await page
      .getByRole("button", { name: /상세 분석/ })
      .first()
      .click();
    const drawer = page.getByRole("dialog", { name: "상세 분석 패널" });
    await expect(drawer).toContainText("다음 확인:");
    await expect(drawer).toContainText("원문값 · 정규화 · 근거 위치");
    await drawer.getByRole("button").nth(1).click();
    await expect(page.getByRole("dialog").last()).toContainText(
      "실제 PDF 블록 위치",
    );
    await page.keyboard.press("Escape");
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(calls.calls()).toBe(2);
    await page.getByRole("button", { name: "새 서류 검토" }).click();
    await expect(
      page.getByRole("button", { name: "AI 서류 분석 시작", exact: true }),
    ).toBeVisible();
  });
for (const width of [1440, 390])
  test(`mismatch filter and grouped warning detail ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page, "mismatch");
    await page.getByLabel("검토 결과 필터").selectOption("mismatch");
    await page.getByTestId("shipping-review").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `test-results/phase34-mismatch-${width}.png`,
    });
    await expect(
      page.locator('[data-assessment="confirmed_mismatch"]'),
    ).not.toHaveCount(0);
    await page
      .getByRole("button", { name: /상세 분석/ })
      .first()
      .click();
    await expect(
      page.getByRole("dialog", { name: "상세 분석 패널" }),
    ).toContainText("확인된 불일치");
  });
test("six documents remain distinct and can select verified shipment groups", async ({
  page,
}) => {
  const calls = await setup(page, "complex");
  await expect(page.getByTestId("shipping-document")).toHaveCount(6);
  await expect(page.getByLabel("선적 그룹 선택")).toBeVisible();
  const choices = await page
    .getByLabel("선적 그룹 선택")
    .locator("option")
    .allTextContents();
  expect(choices.length).toBeGreaterThan(2);
  await page.getByLabel("선적 그룹 선택").selectOption({ index: 1 });
  await page.getByLabel("검토 결과 필터").selectOption("all");
  await expect(page.getByTestId("comparison-row")).not.toHaveCount(0);
  expect(calls.calls()).toBe(3);
});
test("partial and unconfirmed classification explain actual stage failure", async ({
  page,
}) => {
  await setup(page, "partial");
  await expect(page.getByText("합성 부분 실패. 다른 결과 보존")).toBeVisible();
  await expect(page.getByTestId("shipping-document")).toHaveCount(3);
});
test("classification uncertainty is distinct from upload count", async ({
  page,
}) => {
  await setup(page, "uncertain");
  await expect(
    page.getByText(/3개 파일 중 1개는 문서 제목으로 서류 종류를 확인하지 못했습니다/),
  ).toBeVisible();
  await expect(page.getByRole("table").first()).toBeVisible();
});
test("drawer editing/restoring recalculates free and keeps original source", async ({
  page,
}) => {
  const calls = await setup(page);
  await page.getByLabel("검토 결과 필터").selectOption("all");
  await page
    .getByRole("button", { name: "포장 개수 (서류 전체) 상세 분석" })
    .click();
  const drawer = page.getByRole("dialog", { name: "상세 분석 패널" });
  await drawer
    .getByText("AI 추출값·원문 근거 확인 및 수정", { exact: true })
    .first()
    .click();
  await drawer.getByLabel("House B/L · 포장 개수", { exact: true }).fill("54");
  await expect(drawer).toContainText("사용자 수정");
  await expect(drawer).toContainText("잠정");
  await drawer
    .getByRole("button", { name: "원래 AI 추출값 복원" })
    .first()
    .click();
  await expect(
    drawer.getByLabel("House B/L · 포장 개수", { exact: true }),
  ).toHaveValue("60");
  expect(calls.calls()).toBe(2);
});
test("print report has grouped comparison, source references and explicit limits", async ({
  page,
}) => {
  await setup(page, "mismatch");
  await page.emulateMedia({ media: "print" });
  const report = page.locator("#shipping-print-report");
  await expect(report).toBeVisible();
  await expect(report).toContainText("서류별 통합 비교표");
  await expect(report).toContainText("불일치 및 확인 필요 사항");
  await expect(report).toContainText("분석 제한 사항");
  await expect(report.getByRole("table")).toHaveCount(1);
});
