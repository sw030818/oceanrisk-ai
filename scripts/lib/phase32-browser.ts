import { chromium, expect } from "@playwright/test";
import type { Fixture32 } from "./phase32-live";
export async function replayProduction32(
  fixtures: Fixture32[],
  body: unknown,
  stage: string,
) {
  const base = "https://oceanrisk-ai.vercel.app";
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
      headless: true,
    });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    let replayRequests = 0;
    const cache = new Map<
      string,
      { status: number; headers: Record<string, string>; body: Buffer }
    >();
    await page.route("**/*", async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      if (url.origin !== base) return route.abort();
      if (url.pathname === "/api/analyze") {
        replayRequests++;
        return route.fulfill({ json: body });
      }
      if (req.method() !== "GET") return route.abort();
      let asset = cache.get(req.url());
      if (!asset) {
        const r = await fetch(req.url(), {
          signal: AbortSignal.timeout(20000),
          headers: { accept: req.headers().accept ?? "*/*" },
        });
        asset = {
          status: r.status,
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
          body: Buffer.from(await r.arrayBuffer()),
        };
        cache.set(req.url(), asset);
      }
      return route.fulfill(asset);
    });
    await page.goto(base, { waitUntil: "networkidle" });
    const names = {
      house_bl: "House B/L",
      export_declaration: "수출신고필증",
      house_manifest: "House 적하목록",
    };
    for (const f of fixtures)
      await page
        .getByLabel(
          names[f.wire.type as keyof typeof names] + " PDF 파일 선택",
          { exact: true },
        )
        .setInputFiles({
          name: f.pdf.fileName,
          mimeType: "application/pdf",
          buffer: Buffer.from(f.bytes),
        });
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "서류 분석 시작", exact: true })
      .click();
    await expect(page.getByTestId("shipping-review")).toBeVisible();
    const panel = page.getByTestId("shipping-review");
    await expect(panel).toContainText("서류 간 대조 결과");
    const mismatches = page.locator(
      '[data-testid="shipping-check"][data-assessment="confirmed_mismatch"]',
    );
    if (stage === "mismatch")
      expect(await mismatches.count()).toBeGreaterThan(0);
    if (stage === "normal" || stage === "uncertain")
      expect(await mismatches.count()).toBe(0);
    await page.screenshot({
      path: `test-results/live-phase32/${stage}-production-desktop.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (stage === "normal")
      await expect(
        page.getByText("검증 범위 대조 실행", { exact: true }),
      ).toBeVisible();
    if (stage === "uncertain" && fixtures.length === 3)
      await expect(
        page.getByText("공통 연결 확인 필요", { exact: true }),
      ).toBeVisible();
    await page
      .getByRole("button", { name: "일치·정보 부족 포함 전체 보기" })
      .click();
    const source = page
      .getByTestId("shipping-check")
      .getByRole("button")
      .first();
    await source.click();
    await expect(page.getByRole("dialog")).toContainText("실제 PDF 블록 위치");
    await page.keyboard.press("Escape");
    await page
      .getByText("AI 추출값·원문 근거 확인 및 수정", { exact: true })
      .first()
      .click();
    await page.getByLabel("House B/L · 포장 개수", { exact: true }).fill("31");
    await expect(
      page.locator(
        '[data-testid="shipping-check"][data-assessment="provisional_mismatch"]',
      ),
    ).not.toHaveCount(0);
    await page
      .getByTestId("shipping-document")
      .first()
      .getByRole("button", { name: "원래 AI 추출값 복원" })
      .click();
    expect(replayRequests).toBe(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/live-phase32/${stage}-production-mobile.png`,
      fullPage: true,
    });
    return {
      passed: true,
      desktopWidth: 1440,
      mobileWidth: 390,
      pdfEvidence: true,
      editRestore: true,
      additionalPaidCalls: 0,
      responseReplay: true,
      reason: null,
    };
  } catch {
    return {
      passed: false,
      reason: "PRODUCTION_UI_TRANSPORT_OR_ASSERTION_FAILED",
      additionalPaidCalls: 0,
      responseReplay: true,
    };
  } finally {
    await browser?.close();
  }
}
