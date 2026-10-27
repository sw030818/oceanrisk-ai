import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { officialFormOracle } from "../fixtures/official-forms";
import { shippingTypes, shippingLabels, type ShippingType } from "../../src/modules/shipping/catalog";

// Sample panel (UI contract changed 2026-10-27 at the user's request: ten
// normal and ten abnormal pre-stored synthetic sets, received either attached
// to the slots or as a ZIP). Nothing is generated at click time and taking a
// sample never starts AI analysis.
for (const kind of ["normal", "abnormal"] as const)
  test(`sample "${kind}" attaches one stored set's three PDFs without analysis`, async ({ page }) => {
    let analyze = 0;
    await page.route("**/api/analyze", (route) => { analyze++; return route.abort(); });
    await page.goto("/");
    await expect(page.getByTestId("sample-sources")).toContainText("국가관세종합정보시스템");
    await page.getByTestId("sample-loader").getByRole("button", { name: kind === "normal" ? "정상 거래" : "비정상 거래", exact: true }).click();
    await expect(page.getByTestId("upload-file")).toHaveCount(3);
    await expect(page.getByTestId("upload-slots")).toContainText(new RegExp(`샘플-${kind}-(0[1-9]|10)-house-bl\\.pdf`));
    await expect(page.getByRole("button", { name: "AI 서류 분석 시작", exact: true })).toBeDisabled();
    expect(analyze).toBe(0);
  });

for (const kind of ["normal", "abnormal"] as const)
  test(`sample "${kind}" downloads one stored ZIP of three PDFs`, async ({ page }) => {
    let analyze = 0;
    await page.route("**/api/analyze", (route) => { analyze++; return route.abort(); });
    await page.goto("/");
    await page.getByRole("button", { name: "ZIP 다운로드", exact: true }).click();
    await expect(page.getByRole("button", { name: "ZIP 다운로드", exact: true })).toHaveAttribute("aria-pressed", "true");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("sample-loader").getByRole("button", { name: kind === "normal" ? "정상 거래" : "비정상 거래", exact: true }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(new RegExp(`^oceanrisk-sample-${kind}-(0[1-9]|10)\\.zip$`));
    const bytes = await readFile((await download.path())!);
    expect(bytes.subarray(0, 2).toString("latin1")).toBe("PK");
    for (const entry of ["1_House_BL.pdf", "2_Export_Declaration.pdf", "3_House_Manifest.pdf"])
      expect(bytes.includes(Buffer.from(entry))).toBe(true);
    await expect(page.getByTestId("upload-file")).toHaveCount(0);
    expect(analyze).toBe(0);
  });

// MOCK analysis responses built from the official-form oracle (no AI).
async function analyzeOfficial(page: Page, kinds: Record<ShippingType, "normal" | "mismatch">) {
  const names: Record<ShippingType, string> = { house_bl: "house-bl", export_declaration: "export-declaration", house_manifest: "house-manifest" };
  const fs = await Promise.all(shippingTypes.map((t) => officialFormOracle(kinds[t], t)));
  await page.route("**/api/analyze", async (route) => {
    const form = await new Response(new Uint8Array(route.request().postDataBuffer()!), { headers: { "Content-Type": route.request().headers()["content-type"] } }).formData();
    const ids = JSON.parse(String(form.get("documentIds"))), analyze = form.get("operation") === "analyze";
    const results = form.getAll("files").map((file, i) => {
      const f = fs.find((f) => f.pdf.fileName === (file as File).name)!, doc = structuredClone(f.document), old = doc.id;
      doc.id = ids[i];
      const retag = (x: unknown) => { if (!x || typeof x !== "object") return; for (const [k, v] of Object.entries(x)) { if (k === "fileId" && v === old) (x as Record<string, unknown>)[k] = ids[i]; else retag(v); } };
      retag(doc);
      return { pdf: { ...f.pdf, id: ids[i] }, document: doc, uploadSlot: doc.uploadType, detectedType: doc.detectedType, typeMismatch: false, error: null };
    });
    await route.fulfill({ json: { phase: "3.8", mode: analyze ? "shipping-analysis" : "pdf-preparation", results, capabilities: { pairComparison: analyze, aiExtraction: analyze, semanticAnalysis: false }, aiCalled: analyze } });
  });
  await page.route("**/api/semantic", (route) => route.fulfill({ status: 502, json: { error: { code: "API_UNAVAILABLE", message: "모의 의미 분석 미실행" } } }));
  await page.goto("/");
  for (const t of shippingTypes)
    await page.getByLabel(shippingLabels[t].title + " PDF 파일 선택", { exact: true }).setInputFiles({ name: `${names[t]}.pdf`, mimeType: "application/pdf", buffer: await readFile(`public/samples/${kinds[t]}/${names[t]}.pdf`) });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "AI 서류 분석 시작", exact: true }).click();
  await expect(page.getByTestId("shipping-document")).toHaveCount(3);
}
test("MOCK results show the three original PDFs side by side and no different-shipment notice for one shipment", async ({ page }) => {
  await analyzeOfficial(page, { house_bl: "normal", export_declaration: "normal", house_manifest: "normal" });
  await expect(page.getByTestId("document-preview")).toHaveCount(3);
  await expect(page.getByTestId("document-previews").locator("iframe")).toHaveCount(3);
  await expect(page.getByTestId("document-preview").first()).toContainText("House B/L");
  await expect(page.getByTestId("different-shipments")).toHaveCount(0);
});
test("MOCK documents of different shipments show the different-shipment notice without a confirmed error", async ({ page }) => {
  await analyzeOfficial(page, { house_bl: "normal", export_declaration: "normal", house_manifest: "mismatch" });
  await expect(page.getByTestId("different-shipments")).toContainText("서로 다른 화물로 보입니다");
  await expect(page.getByTestId("document-preview")).toHaveCount(3);
});
