import { expect, type Page } from "@playwright/test";
import { makePdf } from "./synthetic";
import { prepareShippingFile } from "../../src/modules/shipping/prepare";
import { summarizeShipping } from "../../src/modules/shipping/summary";
import {
  shippingTypes,
  shippingLabels,
  type ShippingType,
} from "../../src/modules/shipping/catalog";
export const blLabel = "House B/L PDF 파일 선택",
  declarationLabel = "수출신고필증 PDF 파일 선택",
  manifestLabel = "House 적하목록 PDF 파일 선택";
export async function shippingPdf() {
  return Buffer.from(
    await makePdf([
      [
        "SYNTHETIC HOUSE B/L",
        "House B/L No: HB-001",
        "Packages: 20 CTNS",
        "Gross Weight: 300 KG",
        "Goods: Steel Bolts",
      ],
      ["Synthetic page two"],
    ]),
  );
}
export async function choose(
  page: Page,
  types: ShippingType[] = ["house_bl", "house_manifest"],
) {
  await page.getByRole("radio", { name: "PDF 원문만 확인" }).check();
  const bytes = await shippingPdf();
  for (const [i, type] of types.entries())
    await page
      .getByLabel(shippingLabels[type].title + " PDF 파일 선택")
      .setInputFiles({
        name: `synthetic-${i}.pdf`,
        mimeType: "application/pdf",
        buffer: bytes,
      });
}
export async function start(page: Page) {
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "비교 자료 준비", exact: true })
    .click();
}
export async function mockPreparation(
  page: Page,
  options: { broken?: boolean; allBroken?: boolean; three?: boolean } = {},
) {
  const bytes = await shippingPdf(),
    types = options.three
      ? [...shippingTypes]
      : (["house_bl", "house_manifest"] as ShippingType[]);
  const results = await Promise.all(
    types.map((type, i) =>
      prepareShippingFile(
        new File(
          [
            options.allBroken || (options.broken && i === 0)
              ? "bad"
              : new Uint8Array(bytes),
          ],
          `synthetic-${i}.pdf`,
          { type: "application/pdf" },
        ),
        type,
      ),
    ),
  );
  await page.route("**/api/analyze", (route) =>
    route.fulfill({
      json: {
        mode: "pdf-preparation",
        phase: "3.0",
        results,
        summary: summarizeShipping(results),
        aiCalled: false,
        capabilities: { aiExtraction: false, triangularComparison: false },
      },
    }),
  );
  await page.goto("/");
  await choose(page, types);
  await start(page);
  await expect(
    page.getByRole("heading", {
      name: /PDF 자료 준비 완료|자료 준비 일부 완료|자료 준비 실패/,
    }),
  ).toBeVisible();
  return results;
}
