import { test, expect } from "@playwright/test";
import { shipping34Fixture } from "../fixtures/shipping34";
import { routeShipping } from "../fixtures/shipping-route";
import {
  shippingTypes,
  shippingLabels,
} from "../../src/modules/shipping/catalog";
import { recoverNative } from "../../src/modules/shipping/recovery";
for (const width of [1440, 390])
  test(`PHASE38 current evidence summary, compact values and report ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    const fs = await Promise.all(
      shippingTypes.map((t) => shipping34Fixture(t)),
    );
    const results = fs.map((f) => ({
      pdf: f.pdf,
      document: recoverNative(f.document, f.pdf),
      uploadSlot: f.wire.type as "house_bl",
      detectedType: f.document.detectedType,
      typeMismatch: false,
      error: null,
    }));
    // A truly unresolved independent field must remain visible in current counts.
    const field = results[0].document.fields.grossWeight;
    field.current.status = "unverified";
    field.current.reason = "시뮬레이션: 해당 총중량의 원문 근거 확인 필요";
    const calls = await routeShipping(page, results, "3.8");
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
    await expect(page.getByTestId("review-kpis")).toContainText(
      "원문 근거 미확인 값",
    );
    await expect(page.getByTestId("review-incomplete")).toContainText(
      "검토 미완료",
    );
    await expect(page.getByTestId("review-issue").first()).toContainText(
      "관련 검사",
    );
    await page.getByTestId("review-issue").first().getByRole("button").click();
    const panel = page.getByRole("dialog", { name: "상세 분석 패널" });
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("원문값 · 정규화 · 근거 위치");
    await page.keyboard.press("Escape");
    const compact = await page.getByTestId("comparison-row").count();
    await page.getByLabel("검토 결과 필터").selectOption("all");
    expect(await page.getByTestId("comparison-row").count()).toBeGreaterThan(
      compact,
    );
    await expect(page.getByTestId("shipping-review")).toContainText(
      "640.000 KG",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/phase38-result-${width}.png`,
      fullPage: true,
    });
    await page.emulateMedia({ media: "print" });
    const report = page.locator("#shipping-print-report");
    await expect(report).toBeVisible();
    await expect(report).toContainText("검토 미완료");
    await expect(report).toContainText("원본 검사 기록 (보존)");
    await expect(report).toContainText("640.000 KG");
    expect(calls.calls()).toBe(2);
  });
