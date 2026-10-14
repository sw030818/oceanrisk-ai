import { test, expect } from "@playwright/test";
import { fixture35 } from "../fixtures/shipping35";
import { routeShipping } from "../fixtures/shipping-route";
import { emptyShippingField } from "../../src/modules/shipping/schema";
import { recoverNative } from "../../src/modules/shipping/recovery";
import {
  shippingLabels,
  shippingTypes,
} from "../../src/modules/shipping/catalog";
for (const width of [1440, 390])
  test(`PHASE36 recovered values retain initial history, source and free edit/restore ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    const fs = await Promise.all(shippingTypes.map((t) => fixture35(t)));
    fs[2].document.items[0].fields.quantity = emptyShippingField();
    fs[2].document.items[0].fields.quantityUnit = emptyShippingField();
    const results = fs.map((f) => ({
      pdf: f.pdf,
      document: recoverNative(f.document, f.pdf),
      uploadSlot: f.wire.type as "house_bl",
      detectedType: f.document.detectedType,
      typeMismatch: false,
      error: null,
    }));
    const counter = await routeShipping(page, results, "3.6");
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
    await page.getByLabel("검토 결과 필터").selectOption("all");
    await page
      .getByRole("button", { name: "기재 물품 수량 (합계/단일품목 범위) 상세 분석", exact: true })
      .click();
    const drawer = page.getByRole("dialog", { name: "상세 분석 패널" });
    await expect(drawer).toContainText("확인된 일치");
    const sections = drawer
      .locator("details")
      .filter({
        has: page
          .locator("summary")
          .filter({ hasText: "AI 추출값·원문 근거 확인 및 수정" }),
      });
    // The last comparison document is House Manifest.
    const manifest = sections.last();
    await manifest.locator("summary").first().click();
    await expect(manifest.getByTestId("recovery-summary")).toContainText(
      "PDF 구조 2개",
    );
    await manifest
      .locator("summary")
      .filter({ hasText: /^품목 1 ·/ })
      .click();
    const input = manifest.getByLabel("품목 1 · 물품 수량", { exact: true });
    await expect(input).toHaveValue("720");
    const history = manifest.getByTestId("recovery-history").first();
    await history.locator("summary").click();
    await expect(history).toContainText("최초 AI 후보: 미추출");
    await input.fill("700");
    await expect(drawer).toContainText("USER_EDITED");
    await expect(drawer).toContainText("잠정 불일치");
    await manifest
      .getByRole("button", { name: "검증된 복구값 복원", exact: true })
      .click();
    await expect(input).toHaveValue("720");
    await expect(drawer).toContainText("확인된 일치");
    expect(counter.calls()).toBe(2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
