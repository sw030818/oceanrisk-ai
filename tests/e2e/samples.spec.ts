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

// The download buttons hand out one of the pre-stored synthetic ZIPs (three
// PDFs each); nothing is generated at click time and no analysis starts.
for (const [name, pattern] of [["같은 거래 서류 3장", /^oceanrisk-same-shipment-[1-7]\.zip$/], ["서로 다른 거래 서류 3장", /^oceanrisk-mixed-shipments-[1-3]\.zip$/]] as const)
  test(`sample download "${name}" saves a stored ZIP of three PDFs`, async ({ page }) => {
    let analyze = 0;
    await page.route("**/api/analyze", (route) => { analyze++; return route.abort(); });
    await page.goto("/");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("sample-download").getByRole("button", { name, exact: true }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(pattern);
    const { readFile } = await import("node:fs/promises");
    const bytes = await readFile((await download.path())!);
    expect(bytes.subarray(0, 2).toString("latin1")).toBe("PK");
    for (const entry of ["1_House_BL.pdf", "2_Export_Declaration.pdf", "3_House_Manifest.pdf"])
      expect(bytes.includes(Buffer.from(entry))).toBe(true);
    await expect(page.getByTestId("upload-file")).toHaveCount(0);
    expect(analyze).toBe(0);
  });
