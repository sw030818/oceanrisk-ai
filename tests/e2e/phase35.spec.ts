import { test, expect, type Page } from "@playwright/test";
import { fixture35 } from "../fixtures/shipping35";
import {
  shippingTypes,
  shippingLabels,
} from "../../src/modules/shipping/catalog";
import { routeShipping } from "../fixtures/shipping-route";
async function setup(page: Page, changed = false) {
  const fs = await Promise.all(
    shippingTypes.map((t) =>
      fixture35(
        t,
        t === "house_bl"
          ? {}
          : {
              totals: {
                quantity: 720,
                packageCount: changed && t === "house_manifest" ? 54 : 60,
                grossWeight: 640,
              },
              rows: [
                {
                  name: "SYNTHETIC METAL BOTTLE 600ML",
                  hs: "7323.93-0000",
                  qty: 720,
                  packages: changed && t === "house_manifest" ? 54 : 60,
                  gross: 640,
                },
              ],
            },
      ),
    ),
  );
  const calls = await routeShipping(
    page,
    fs.map((f) => ({
      pdf: f.pdf,
      document: f.document,
      uploadSlot: f.wire.type as "house_bl",
      detectedType: f.document.detectedType,
      typeMismatch: false,
      error: null,
    })),
    "3.5",
  );
  await page.goto("/");
  for (const [i, t] of shippingTypes.entries())
    await page
      .getByLabel(shippingLabels[t].title + " PDF 파일 선택", { exact: true })
      .setInputFiles({
        name: fs[i].pdf.fileName,
        mimeType: "application/pdf",
        buffer: Buffer.from(fs[i].bytes),
      });
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "AI 서류 분석 시작", exact: true })
    .click();
  await expect(page.getByTestId("shipping-review")).toBeVisible();
  // These legacy checks inspect verified matches and optional diagnostics.
  // PHASE37 starts at attention; explicitly open the preserved full table.
  await page.getByLabel("검토 결과 필터").selectOption("all");
  return calls;
}
for (const width of [1440, 390])
  test(`PHASE35 native single-row HBL scope and neutral inapplicable fields ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await setup(page);
    await page
      .getByRole("button", {
        name: "포장 개수 (서류 전체) 상세 분석",
        exact: true,
      })
      .click();
    const drawer = page.getByRole("dialog", { name: "상세 분석 패널" });
    await expect(drawer).toContainText("확인된 일치");
    await expect(drawer).toContainText("검증된 단일 행 연결");
    await expect(drawer).toContainText("hbl_total");
    await expect(drawer).toContainText("판정 코드: VERIFIED");
    await drawer
      .getByText(/원본 검사 진단/)
      .first()
      .click();
    await expect(drawer).toContainText("포장 개수 (서류 전체)");
    await page.keyboard.press("Escape");
    await page.getByLabel("검토 결과 필터").selectOption("not_applicable");
    await expect(page.getByTestId("comparison-row").first()).toContainText(
      "대조 대상 없음",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByLabel("검토 결과 필터").selectOption("all");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `test-results/phase35-${width}.png` });
  });
test("PHASE35 root correction on previously missing AI aggregate recomputes without approving source or calling AI", async ({
  page,
}) => {
  const calls = await setup(page);
  await page
    .getByRole("button", { name: "포장 개수 (서류 전체) 상세 분석", exact: true })
    .click();
  const drawer = page.getByRole("dialog", { name: "상세 분석 패널" });
  await drawer
    .getByText("AI 추출값·원문 근거 확인 및 수정", { exact: true })
    .first()
    .click();
  const input = drawer.getByLabel("House B/L · 포장 개수", { exact: true });
  await expect(input).toHaveValue("");
  await input.fill("54");
  await expect(drawer).toContainText("USER_EDITED");
  await expect(drawer).toContainText("잠정 불일치");
  await expect(drawer).toContainText("사용자 수정");
  await drawer
    .getByRole("button", { name: "원래 AI 추출값 복원" })
    .first()
    .click();
  await expect(input).toHaveValue("");
  await expect(drawer).toContainText("판정 코드: VERIFIED");
  expect(calls.calls()).toBe(2);
});
test("PHASE35 independent mismatch and print summary preserve source diagnostics", async ({
  page,
}) => {
  await setup(page, true);
  await page.getByLabel("검토 결과 필터").selectOption("mismatch");
  await expect(page.getByTestId("comparison-row")).toHaveCount(1);
  await page
    .getByRole("button", { name: "포장 개수 (서류 전체) 상세 분석", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "상세 분석 패널" }),
  ).toContainText("확인된 불일치");
  await page.keyboard.press("Escape");
  await page.emulateMedia({ media: "print" });
  const report = page.locator("#shipping-print-report");
  await expect(report).toContainText("의미·범위별 독립 판정 기준");
  await expect(report).toContainText("대조 대상 없음");
  await expect(report).toContainText("원본 검사");
});
