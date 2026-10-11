import { test, expect } from "@playwright/test";
import { makePdf, syntheticDocument } from "../fixtures/synthetic";
test("upload workspace, validation and responsive layout", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByLabel("Commercial Invoice PDF 파일 선택"),
  ).toBeEnabled();
  await expect(
    page.getByRole("heading", { name: "서류 검토, 더 명확하게." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "서류 분석 시작" }),
  ).toBeDisabled();
  await page.getByLabel("Commercial Invoice PDF 파일 선택").setInputFiles({
    name: "invalid.png",
    mimeType: "image/png",
    buffer: Buffer.from("bad"),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "텍스트 기반 PDF" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "파일 선택", exact: true }).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("actual server PDF extraction with missing OpenAI key", async ({
  page,
  request,
}) => {
  const status = await (await request.get("/api/status")).json();
  test.skip(
    status.aiConfigured,
    "Missing-key test only applies when key is absent",
  );
  await page.goto("/");
  await expect(
    page.getByLabel("Commercial Invoice PDF 파일 선택"),
  ).toBeEnabled();
  const pdf = await makePdf([
    ["COMMERCIAL INVOICE", "Quantity: 100 PCS"],
    ["Second page evidence"],
  ]);
  await page.getByLabel("Commercial Invoice PDF 파일 선택").setInputFiles({
    name: "real-generated-synthetic.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(pdf),
  });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "서류 분석 시작" }).click();
  await expect(page.getByText("오류 코드: API_NOT_CONFIGURED")).toBeVisible({
    timeout: 45000,
  });
  await page.getByText("페이지별 PDF 원문 보기").click();
  await expect(
    page.getByText("Quantity: 100 PCS", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("PAGE 2", { exact: true })).toBeVisible();
  await expect(
    page.getByText("정보 부족", { exact: false }).first(),
  ).toBeVisible();
});
test("synthetic mocked analysis: mismatch evidence, edits and revalidation", async ({
  page,
}) => {
  // Explicit test-only mock. This is not a real OpenAI success.
  const pair = [
    syntheticDocument("invoice", 100),
    syntheticDocument("packing_list", 90),
  ];
  await page.route("**/api/analyze", (route) =>
    route.fulfill({
      json: {
        results: pair.map((fixture) => ({
          pdf: fixture.pdf,
          document: fixture.document,
          error: null,
        })),
        mode: "live",
        aiConfigured: true,
      },
    }),
  );
  await page.goto("/");
  await expect(
    page.getByLabel("Commercial Invoice PDF 파일 선택"),
  ).toBeEnabled();
  for (const [index, fixture] of pair.entries())
    await page
      .getByLabel(
        index
          ? "Packing List PDF 파일 선택"
          : "Commercial Invoice PDF 파일 선택",
      )
      .setInputFiles({
        name: fixture.pdf.fileName,
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-synthetic-ui-test"),
      });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "서류 분석 시작" }).click();
  await expect(
    page.getByText("Steel Bolts · 동일 품목의 수량 차이를 확인했습니다"),
  ).toBeVisible();
  await page
    .getByLabel("상품 수량 · 품목 1", { exact: true })
    .first()
    .fill("95");
  await expect(page.getByTestId("check-quantity-0")).toHaveAttribute(
    "data-assessment",
    "provisional_mismatch",
  );
  await expect(
    page.getByRole("button", { name: "사용자 수정" }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "사용자 수정" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("원문 근거");
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() =>
      Boolean(document.activeElement?.closest("dialog")),
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "AI 추출값 복원" }).first().click();
  await expect(
    page.getByText("Steel Bolts · 동일 품목의 수량 차이를 확인했습니다"),
  ).toBeVisible();
  await page.getByRole("button", { name: "새 서류 검토" }).click();
  await expect(
    page.getByRole("heading", { name: "서류 검토, 더 명확하게." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "서류 분석 시작" }),
  ).toBeDisabled();
});
