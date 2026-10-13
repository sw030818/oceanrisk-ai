// PHASE 3.0 only: deployed UI + actual PDF preparation, NEVER an AI test.
// Refuse to upload anything unless the exact release advertises AI disabled.
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { makePdf } from "../tests/fixtures/synthetic";
import { shippingTypes, shippingLabels } from "../src/modules/shipping/catalog";
const base = "https://oceanrisk-ai.vercel.app";
const sha = process.argv.find((a) => a.startsWith("--sha="))?.slice(6);
if (!sha || !/^[a-f0-9]{40}$/.test(sha))
  throw new Error("Exact deployed SHA required");
async function preflight() {
  const r = await fetch(base + "/api/status?phase30=" + Date.now(), {
    signal: AbortSignal.timeout(15000),
  });
  const s = await r.json();
  if (
    !r.ok ||
    s.deployment?.commitSha !== sha ||
    s.deployment?.environment !== "production" ||
    s.phase !== "3.0" ||
    s.capabilities?.pdfPreparation !== true ||
    s.capabilities?.aiExtraction !== false ||
    s.capabilities?.documentClassification !== false ||
    s.capabilities?.triangularComparison !== false
  )
    throw new Error(
      "PHASE 3.0 exact-SHA, AI-disabled Production required; no upload made",
    );
  return {
    sha,
    keyConfigured: s.aiConfigured === true,
    deploymentId: s.deployment.id,
  };
}
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  const deployment = await preflight();
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  let batches = 0,
    preparedDocuments = 0,
    aiCalled: boolean | null = null;
  await page.route("**/*", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (url.origin !== base) return route.abort();
    if (
      req.method() !== "GET" &&
      !(req.method() === "POST" && url.pathname === "/api/analyze")
    )
      return route.abort();
    const headers: Record<string, string> = {
      accept: req.headers().accept ?? "*/*",
    };
    let body: Uint8Array<ArrayBuffer> | undefined;
    if (req.method() === "POST") {
      if (++batches !== 1)
        throw new Error("Only one non-AI preparation batch allowed");
      await preflight();
      headers["content-type"] = req.headers()["content-type"];
      headers.origin = base;
      body = new Uint8Array(req.postDataBuffer()!);
    }
    const r = await fetch(url.href, {
      method: req.method(),
      body,
      headers,
      signal: AbortSignal.timeout(120000),
    });
    const bytes = Buffer.from(await r.arrayBuffer());
    if (req.method() === "POST") {
      const data = JSON.parse(bytes.toString());
      expect(r.ok).toBe(true);
      expect(data.mode).toBe("pdf-preparation");
      expect(data.aiCalled).toBe(false);
      expect(data.review).toEqual({ status: "not_performed", checks: [] });
      expect(data.summary.comparisonReadiness).toBe("ready_for_triangle");
      expect(data.results).toHaveLength(3);
      for (const result of data.results) {
        expect(result.error).toBeNull();
        expect(result.detectedType).toBeNull();
        expect(result.typeMismatch).toBeNull();
        expect(result.document.extractionStatus).toBe("not_performed");
        expect(
          Object.values(result.document.fields).every((f) => {
            const field = f as {
              original: { value: unknown };
              current: { value: unknown };
            };
            return (
              field.original.value === null && field.current.value === null
            );
          }),
        ).toBe(true);
        expect(result.pdf.pages[0].blocks.length).toBeGreaterThan(0);
      }
      preparedDocuments = data.results.length;
      aiCalled = data.aiCalled;
    }
    await route.fulfill({
      status: r.status,
      body: bytes,
      headers: Object.fromEntries(
        [...r.headers].filter(
          ([n]) =>
            ![
              "content-encoding",
              "content-length",
              "transfer-encoding",
              "connection",
            ].includes(n),
        ),
      ),
    });
  });
  await page.goto(base, { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", { name: "적하목록 신고 전, 원문부터 정확하게." }),
  ).toBeVisible();
  const boxes = await Promise.all(
    shippingTypes.map((type) =>
      page
        .getByRole("region", {
          name: shippingLabels[type].title + " 업로드 영역",
        })
        .boundingBox(),
    ),
  );
  expect(boxes.every((box) => box && box.y === boxes[0]!.y)).toBe(true);
  await page.screenshot({
    path: "test-results/phase30-production-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  for (const type of shippingTypes) {
    const bytes = await makePdf([
      [
        `SYNTHETIC ${type.toUpperCase()}`,
        "House B/L Reference: HB-001",
        "Packages: 20 CTNS",
        "Gross Weight: 300 KG",
        "Goods: Steel Bolts",
      ],
      ["Synthetic second page"],
    ]);
    await page
      .getByLabel(shippingLabels[type].title + " PDF 파일 선택")
      .setInputFiles({
        name: `synthetic-${type}.pdf`,
        mimeType: "application/pdf",
        buffer: Buffer.from(bytes),
      });
  }
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "비교 자료 준비", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "PDF 자료 준비 완료", exact: true }),
  ).toBeVisible({ timeout: 120000 });
  await expect(page.getByText("분석 미실시", { exact: true })).toBeVisible();
  await page
    .getByText("문서별 필드 확인·사용자 입력 (AI 추출 미실시)", { exact: true })
    .first()
    .click();
  await page.getByLabel("House B/L · 포장 개수", { exact: true }).fill("20");
  await page
    .getByRole("button", { name: "사용자 수정", exact: false })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toContainText("사용자가 수정한 값");
  await page.keyboard.press("Escape");
  await page
    .getByText("페이지별 PDF 원문 보기", { exact: true })
    .first()
    .click();
  await page
    .getByText("실제 텍스트 블록·위치 보기", { exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Packages: 20 CTNS", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toContainText("실제 PDF 블록 위치");
  await page.keyboard.press("Escape");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/phase30-production-mobile.png",
    fullPage: true,
  });
  await preflight();
  const report = {
    mode: "actual-production-pdf-preparation-not-ai",
    sourceSha: sha,
    passed: true,
    deployment,
    batchRequests: batches,
    preparedDocuments,
    aiCalled,
    paidProviderCalls: 0,
    automaticRetries: 0,
    desktopThreeColumns: true,
    mobileWidth: 390,
    mobileOverflow: false,
    userCorrectionDistinct: true,
    literalPdfBlocksVisible: true,
    comparisonStatus: "not_performed",
  };
  await mkdir("test-results", { recursive: true });
  await writeFile(
    "test-results/phase30-production-ui.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} catch {
  console.error(
    "PHASE30_PRODUCTION_UI_CHECK_FAILED. No retry and no AI analysis claimed.",
  );
  process.exitCode = 1;
} finally {
  await browser?.close();
}
