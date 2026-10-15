import { test, expect } from "@playwright/test";
import { scenario37 } from "../fixtures/phase37/cases";
import { development37 } from "../fixtures/phase37/development";
import { recoverNative } from "../../src/modules/shipping/recovery";
import { routeShipping } from "../fixtures/shipping-route";
import {
  shippingTypes,
  shippingLabels,
} from "../../src/modules/shipping/catalog";
for (const width of [1440, 390])
  test(`PHASE37 attention-first preserves all checks, evidence and issue detail ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    const { fixtures } = await scenario37(development37[10]);
    const results = fixtures.map((f) => ({
      pdf: f.pdf,
      document: recoverNative(f.document, f.pdf),
      uploadSlot: f.wire.type as "house_bl",
      detectedType: f.document.detectedType,
      typeMismatch: false,
      error: null,
    }));
    const count = await routeShipping(page, results, "3.7");
    await page.goto("/");
    for (const [i, t] of shippingTypes.entries())
      await page
        .getByLabel(shippingLabels[t].title + " PDF 파일 선택", { exact: true })
        .setInputFiles({
          name: fixtures[i].pdf.fileName,
          mimeType: "application/pdf",
          buffer: Buffer.from(fixtures[i].bytes),
        });
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "AI 서류 분석 시작", exact: true })
      .click();
    const review = page.getByTestId("shipping-review");
    await expect(review).toBeVisible();
    await expect(page.getByLabel("검토 결과 필터")).toHaveValue("attention");
    await expect(page.getByTestId("review-issue").first()).toBeVisible();
    await expect(review).toContainText("확인된 불일치");
    const before = await page.getByTestId("comparison-row").count();
    await page
      .getByTestId("review-issue")
      .first()
      .getByRole("button", { name: "판정·원문 근거 확인" })
      .click();
    await expect(
      page.getByRole("dialog", { name: "상세 분석 패널" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByLabel("검토 결과 필터").selectOption("all");
    expect(await page.getByTestId("comparison-row").count()).toBeGreaterThan(
      before,
    );
    await expect(review).toContainText("확인된 일치");
    expect(count.calls()).toBe(2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
for (const missing of [false, true])
  test(`PHASE37 ${missing ? "mandatory missing field stays visible with document identity" : "normal verified summary is distinct from optional inapplicability"}`, async ({
    page,
  }) => {
    const { fixtures } = await scenario37(development37[0]);
    const results = fixtures.map((f) => ({
      pdf: f.pdf,
      document: recoverNative(f.document, f.pdf),
      uploadSlot: f.wire.type as "house_bl",
      detectedType: f.document.detectedType,
      typeMismatch: false,
      error: null,
    }));
    if (missing) {
      const { emptyShippingField } =
        await import("../../src/modules/shipping/schema");
      results[1].document.fields.exporter = emptyShippingField();
    }
    await routeShipping(page, results, "3.7");
    await page.goto("/");
    for (const [i, t] of shippingTypes.entries())
      await page
        .getByLabel(shippingLabels[t].title + " PDF 파일 선택", { exact: true })
        .setInputFiles({
          name: fixtures[i].pdf.fileName,
          mimeType: "application/pdf",
          buffer: Buffer.from(fixtures[i].bytes),
        });
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "AI 서류 분석 시작", exact: true })
      .click();
    if (missing) {
      await expect(page.getByTestId("review-issue").first()).toContainText(
        "문서 필수정보",
      );
      await expect(page.getByTestId("review-issue").first()).toContainText(
        fixtures[1].pdf.fileName,
      );
      await expect(page.getByTestId("normal-review-summary")).toHaveCount(0);
    } else {
      await expect(page.getByTestId("normal-review-summary")).toBeVisible();
      await expect(page.getByTestId("review-issue")).toHaveCount(0);
      await page.getByLabel("검토 결과 필터").selectOption("all");
      await expect(page.getByTestId("comparison-row")).not.toHaveCount(0);
    }
  });

// Actual live failure reconstructed locally; this route is mocked, not a new paid extraction.
test("PHASE37 Korean manifest misclassification recovers from the cited title and exposes initial AI history", async ({
  page,
}) => {
  const { groundShipping } = await import("../../src/modules/shipping/ground");
  const { fixtures } = await scenario37(development37[1]);
  const wrong = structuredClone(fixtures[2].wire);
  wrong.type = "house_bl";
  const results = fixtures.map((f, i) => ({
    pdf: f.pdf,
    document: recoverNative(
      i === 2 ? groundShipping(wrong, f.pdf, "house_manifest") : f.document,
      f.pdf,
    ),
    uploadSlot: f.wire.type as "house_bl",
    detectedType:
      i === 2 ? ("house_manifest" as const) : f.document.detectedType,
    typeMismatch: false,
    error: null,
  }));
  await routeShipping(page, results, "3.7");
  await page.goto("/");
  for (const [i, t] of shippingTypes.entries())
    await page
      .getByLabel(shippingLabels[t].title + " PDF 파일 선택", { exact: true })
      .setInputFiles({
        name: fixtures[i].pdf.fileName,
        mimeType: "application/pdf",
        buffer: Buffer.from(fixtures[i].bytes),
      });
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "AI 서류 분석 시작", exact: true })
    .click();
  await expect(page.getByTestId("normal-review-summary")).toBeVisible();
  const doc = page.getByTestId("shipping-document").filter({
    has: page.getByRole("heading", {
      name: fixtures[2].pdf.fileName,
      exact: true,
    }),
  });
  await doc
    .getByText("AI 추출값·원문 근거 확인 및 수정", { exact: true })
    .click();
  await expect(doc).toContainText("최초 AI 유형: House B/L");
  await expect(doc).toContainText("현재 유형: House 적하목록");
});

test("PHASE37 mobile multi-declaration replaces whole-vs-subset checks but retains the allocation problem and all evidence", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 950 });
  const { fixtures } = await scenario37(development37[20]);
  await routeShipping(
    page,
    fixtures.map((f) => ({
      pdf: f.pdf,
      document: recoverNative(f.document, f.pdf),
      uploadSlot: f.wire.type as "house_bl",
      detectedType: f.document.detectedType,
      typeMismatch: false,
      error: null,
    })),
    "3.7",
  );
  await page.goto("/");
  for (const type of shippingTypes) {
    await page
      .getByLabel(shippingLabels[type].title + " PDF 파일 선택", {
        exact: true,
      })
      .setInputFiles(
        fixtures
          .filter((f) => f.wire.type === type)
          .map((f) => ({
            name: f.pdf.fileName,
            mimeType: "application/pdf",
            buffer: Buffer.from(f.bytes),
          })),
      );
  }
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "AI 서류 분석 시작", exact: true })
    .click();
  await expect(page.getByTestId("review-issue")).toHaveCount(1);
  await expect(page.getByTestId("review-issue")).toContainText(
    "복수 신고 포장·중량 배분 확인",
  );
  await page
    .getByTestId("review-issue")
    .getByRole("button", { name: "판정·원문 근거 확인" })
    .click();
  const panel = page.getByRole("dialog", { name: "상세 분석 패널" });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("원문");
  await page.keyboard.press("Escape");
  await page.getByLabel("검토 결과 필터").selectOption("all");
  expect(await page.getByTestId("comparison-row").count()).toBeGreaterThan(20);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
