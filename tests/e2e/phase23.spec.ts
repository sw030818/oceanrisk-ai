import { test, expect, type Page } from "@playwright/test";
import { phase23Fixture } from "../fixtures/phase23";
async function analyzeMockPair(
  page: Page,
  options: Parameters<typeof phase23Fixture>[1] = {},
) {
  const fixtures = [
    await phase23Fixture("invoice"),
    await phase23Fixture("packing_list", options),
  ];
  await page.route("**/api/analyze", (route) =>
    route.fulfill({
      json: {
        mode: "test-synthetic-mock-ai",
        aiConfigured: true,
        results: fixtures.map((f, i) => ({
          pdf: f.pdf,
          document: f.document,
          error: null,
          uploadSlot: i ? "packing_list" : "invoice",
          typeMismatch: false,
        })),
      },
    }),
  );
  await page.goto("/");
  for (const [index, f] of fixtures.entries())
    await page
      .getByLabel(
        index
          ? "Packing List PDF 파일 선택"
          : "Commercial Invoice PDF 파일 선택",
      )
      .setInputFiles({
        name: f.pdf.fileName,
        mimeType: "application/pdf",
        buffer: Buffer.from(f.bytes),
      });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "서류 분석 시작" }).click();
  await expect(page.getByTestId("review-panel")).toBeVisible();
}
test("MOCKED AI: reported 600/400 table and semantic Invoice/PO mapping show verified quantities and accessible evidence", async ({
  page,
}) => {
  await analyzeMockPair(page, { reorder: true });
  await expect(page.getByTestId("check-quantity-0")).toHaveAttribute(
    "data-assessment",
    "confirmed_match",
  );
  await expect(page.getByTestId("check-quantity-1")).toHaveAttribute(
    "data-assessment",
    "confirmed_match",
  );
  await expect(
    page.getByText("실제 비교된 품목", { exact: true }),
  ).toBeVisible();
  await page
    .getByText("당사자·참조·품목·단위·중량·포장 교차검증", { exact: true })
    .click();
  await expect(
    page.getByTestId("check-reference-invoiceReference"),
  ).toHaveAttribute("data-assessment", "confirmed_match");
  await expect(
    page.getByTestId("check-reference-purchaseOrder"),
  ).toHaveAttribute("data-assessment", "confirmed_match");
  await page
    .getByTestId("check-quantity-0")
    .getByRole("button", { name: /Invoice 수량/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText("실제 PDF 블록 위치");
  await expect(page.getByRole("dialog")).toContainText("600");
  await page.keyboard.press("Escape");
});
test("MOCKED AI: missing references preserve provisional quantities, mobile evidence and user-edit recalculation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await analyzeMockPair(page, { missingReference: true });
  await expect(page.getByTestId("check-quantity-0")).toHaveAttribute(
    "data-assessment",
    "provisional_match",
  );
  await expect(
    page.getByRole("heading", {
      name: "교차검증 완료 · 일부 항목 확인 필요",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByLabel("상품 수량 · 품목 1", { exact: true })
    .first()
    .fill("599");
  await expect(page.getByTestId("check-quantity-0")).toHaveAttribute(
    "data-assessment",
    "provisional_mismatch",
  );
  await expect(
    page
      .getByTestId("check-quantity-0")
      .getByRole("button", { name: /사용자 수정/ }),
  ).toBeVisible();
  await page
    .getByTestId("check-quantity-0")
    .getByRole("button", { name: /사용자 수정/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText("사용자가 수정한 값");
  await page.keyboard.press("Escape");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("MOCKED AI: conflicting PO remains a separate warning with visible provisional differences", async ({
  page,
}) => {
  await analyzeMockPair(page, { conflictingPO: true, mismatch: true });
  await expect(
    page.getByRole("alert").filter({ hasText: "거래 참조 충돌 경고" }),
  ).toBeVisible();
  await expect(page.getByTestId("check-quantity-0")).toHaveAttribute(
    "data-assessment",
    "provisional_mismatch",
  );
  await expect(page.getByTestId("check-quantity-0")).toContainText("600");
  await expect(page.getByTestId("check-quantity-0")).toContainText("580");
  await expect(
    page.getByText("확인된 수량 불일치 0건", { exact: false }),
  ).toBeVisible();
});
