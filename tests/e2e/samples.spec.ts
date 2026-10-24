import { test, expect } from "@playwright/test";

// The sample buttons only load synthetic PDFs into the three slots; analysis
// still needs consent and an explicit click, so no AI request is made.
for (const [name, file] of [["정상 거래", "예시-정상-house-bl.pdf"], ["오류 포함 거래", "예시-오류포함-house-bl.pdf"]] as const)
  test(`sample button "${name}" fills all three slots without analysis`, async ({ page }) => {
    let analyze = 0;
    await page.route("**/api/analyze", (route) => { analyze++; return route.abort(); });
    await page.goto("/");
    await page.getByTestId("sample-loader").getByRole("button", { name, exact: true }).click();
    await expect(page.getByTestId("upload-file")).toHaveCount(3);
    await expect(page.getByTestId("upload-slots")).toContainText(file);
    await expect(page.getByRole("button", { name: "AI 서류 분석 시작", exact: true })).toBeDisabled();
    expect(analyze).toBe(0);
  });
