import { test, expect } from "@playwright/test";
import { layoutFixture } from "../fixtures/layouts";
import { groundDocument } from "../../src/modules/evidence/verify";
const invoiceLabel = "Commercial Invoice PDF 파일 선택",
  packingLabel = "Packing List PDF 파일 선택";
async function upload(
  page: import("@playwright/test").Page,
  label: string,
  name = "synthetic.pdf",
) {
  await page
    .getByLabel(label)
    .setInputFiles({
      name,
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-synthetic-ui-test"),
    });
}
test("independent slots, red PDF indicators, replace/remove, drag-drop and mobile stacking", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel(invoiceLabel)).toBeEnabled();
  await expect(page.getByLabel(packingLabel)).toBeEnabled();
  for (const slot of ["invoice", "packing_list"]) {
    const rgb = await page.getByTestId(slot + "-pdf-icon").evaluate((e) => {
      const canvas = document.createElement("canvas"),
        context = canvas.getContext("2d")!;
      context.fillStyle = getComputedStyle(e).color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    });
    expect(rgb[0]).toBeGreaterThan(180);
    expect(rgb[0]).toBeGreaterThan(rgb[1] * 2);
    expect(rgb[0]).toBeGreaterThan(rgb[2] * 2);
  }
  await upload(page, invoiceLabel, "one.pdf");
  await upload(page, invoiceLabel, "replacement.pdf");
  await expect(page.getByText("one.pdf", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "replacement.pdf 제거" }).click();
  await expect(page.getByText("replacement.pdf", { exact: true })).toHaveCount(
    0,
  );
  const transfer = await page.evaluateHandle(() => {
    const dt = new DataTransfer();
    dt.items.add(
      new File(["%PDF-synthetic"], "dropped.pdf", { type: "application/pdf" }),
    );
    return dt;
  });
  await page
    .getByRole("region", { name: "Packing List 업로드 영역" })
    .dispatchEvent("drop", { dataTransfer: transfer });
  await expect(page.getByText("dropped.pdf", { exact: true })).toBeVisible();
  const slots = page.getByTestId("upload-slots").locator("section");
  const desktop = await slots.evaluateAll((es) =>
    es.map((e) => ({
      x: e.getBoundingClientRect().x,
      y: e.getBoundingClientRect().y,
    })),
  );
  expect(desktop[0].y).toBe(desktop[1].y);
  expect(desktop[0].x).toBeLessThan(desktop[1].x);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await slots.evaluateAll((es) =>
    es.map((e) => e.getBoundingClientRect().y),
  );
  expect(mobile[1]).toBeGreaterThan(mobile[0]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("single document uses one request, preserves individual review and shows insufficient pair", async ({
  page,
}) => {
  const fixture = await layoutFixture("party-tables", "invoice");
  await page.route("**/api/analyze", async (route) => {
    expect(route.request().postData()).toContain('["invoice"]');
    await route.fulfill({
      json: {
        results: [
          {
            pdf: fixture.pdf,
            document: groundDocument(fixture.data, fixture.pdf),
            error: null,
            uploadSlot: "invoice",
            typeMismatch: false,
          },
        ],
        aiConfigured: true,
      },
    });
  });
  await page.goto("/");
  await upload(page, invoiceLabel);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "서류 분석 시작" }).click();
  await expect(page.getByText("대상 서류 부족", { exact: true })).toBeVisible();
  await expect(page.getByText("수량 차이", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("판매자", { exact: true })).toHaveValue(
    "Pacific Gateway Trading Co., Ltd.",
  );
  await page.getByRole("button", { name: "원문 대조 완료" }).first().click();
  await expect(page.getByRole("dialog")).toContainText("실제 PDF 블록 위치");
  await expect(
    page.getByRole("img", { name: "PDF 텍스트 블록과 근거 위치" }),
  ).toBeVisible();
});
test("two files send one request, type mismatch is based on AI, swapping corrects the selected slots", async ({
  page,
}) => {
  const fixtures = await Promise.all([
    layoutFixture("party-tables", "packing_list"),
    layoutFixture("party-tables", "invoice"),
  ]);
  let calls = 0;
  await page.route("**/api/analyze", async (route) => {
    calls++;
    expect(route.request().postData()).toContain('["invoice","packing_list"]');
    await route.fulfill({
      json: {
        results: fixtures.map((f, i) => ({
          pdf: f.pdf,
          document: groundDocument(f.data, f.pdf),
          error: null,
          uploadSlot: i ? "packing_list" : "invoice",
          typeMismatch: true,
        })),
        aiConfigured: true,
      },
    });
  });
  await page.goto("/");
  await upload(page, invoiceLabel, "looks-like-invoice.pdf");
  await upload(page, packingLabel, "looks-like-packing.pdf");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "서류 분석 시작" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "서류 종류 확인 필요" }),
  ).toBeVisible();
  expect(calls).toBe(1);
  await page.getByRole("button", { name: "두 업로드 칸 서로 바꾸기" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "서류 종류 확인 필요" }),
  ).toHaveCount(0);
  await expect(page.getByText("확인된 일치", { exact: true })).toBeVisible();
});
