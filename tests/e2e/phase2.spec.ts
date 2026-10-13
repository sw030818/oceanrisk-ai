import { test, expect } from "@playwright/test";
import {
  blLabel,
  declarationLabel,
  manifestLabel,
  shippingPdf,
  choose,
  start,
} from "../fixtures/shipping-ui";
test("three independent red-PDF slots support replace, remove, drag-drop and desktop/mobile layout", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("house_bl-pdf-icon")).toHaveClass(
    /text-red-600/,
  );
  await expect(page.getByTestId("export_declaration-pdf-icon")).toHaveClass(
    /text-red-600/,
  );
  await expect(page.getByTestId("house_manifest-pdf-icon")).toHaveClass(
    /text-red-600/,
  );
  await choose(page);
  await page.getByLabel(blLabel).setInputFiles({
    name: "replacement.pdf",
    mimeType: "application/pdf",
    buffer: await shippingPdf(),
  });
  await expect(
    page.getByText("replacement.pdf", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "replacement.pdf 제거" }).click();
  const transfer = await page.evaluateHandle(() => {
    const d = new DataTransfer();
    d.items.add(
      new File(["%PDF-synthetic-ui"], "drop.pdf", { type: "application/pdf" }),
    );
    return d;
  });
  await page
    .getByRole("region", { name: "수출신고필증 업로드 영역" })
    .dispatchEvent("drop", { dataTransfer: transfer });
  await expect(page.getByText("drop.pdf", { exact: true })).toBeVisible();
  const desktop = await Promise.all(
    [blLabel, declarationLabel, manifestLabel].map((label) =>
      page.getByLabel(label).locator("..").boundingBox(),
    ),
  );
  expect(desktop.every((b) => b !== null)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("one file cannot start comparison preparation, even after consent", async ({
  page,
}) => {
  await page.goto("/");
  await choose(page, ["house_bl"]);
  await page.getByRole("checkbox").check();
  await expect(
    page.getByRole("button", { name: "비교 자료 준비", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("1종 선택 · 비교 자료 준비에 최소 2종이 필요합니다."),
  ).toBeVisible();
});
test("three documents form one multipart request and preserve selected types without claiming AI classification", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/api/analyze", async (route) => {
    requests++;
    const body = route.request().postDataBuffer()!.toString();
    expect(body).toContain(
      '["house_bl","export_declaration","house_manifest"]',
    );
    await route.continue();
  });
  await page.goto("/");
  await choose(page, ["house_bl", "export_declaration", "house_manifest"]);
  await start(page);
  await expect(
    page.getByRole("heading", { name: "PDF 자료 준비 완료", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("3종 삼각대조 자료 준비", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/실제 분류 미실시/)).toHaveCount(3);
  expect(requests).toBe(1);
});
