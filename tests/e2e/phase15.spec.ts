import { test, expect } from "@playwright/test";
import { phase15Scenario } from "../fixtures/phase15";
import { groundDocument } from "../../src/modules/evidence/verify";
import { makePdf } from "../fixtures/synthetic";

async function uploadSynthetic(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.getByLabel("Commercial Invoice PDF 파일 선택")).toBeEnabled();
  await page
    .getByLabel("Commercial Invoice PDF 파일 선택")
    .setInputFiles({
      name: "synthetic.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-synthetic-mock"),
    });
  await page.getByRole("checkbox").check();
}
function syntheticResults(id: "A" | "D") {
  return phase15Scenario(id).documents.map((doc) => ({
    pdf: doc.pdf,
    document: groundDocument(doc.data, doc.pdf),
    error: null,
  }));
}

test("candidate comparison remains amber and mobile results do not overflow", async ({
  page,
}) => {
  await page.route("**/api/analyze", (route) =>
    route.fulfill({
      json: { results: syntheticResults("D"), aiConfigured: true },
    }),
  );
  await uploadSynthetic(page);
  await page.getByRole("button", { name: "서류 분석 시작" }).click();
  await expect(page.getByText("비교 후보", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Steel Bolts · 수량 비교 후보 · 확정 오류 아님"),
  ).toBeVisible();
  await expect(
    page.getByText("동일 품목의 수량 차이를 확인했습니다", { exact: false }),
  ).not.toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("partial success preserves successful fields and shows the failed file", async ({
  page,
}) => {
  const good = syntheticResults("A")[0];
  const bad = {
    pdf: { id: "failed", fileName: "unreadable-synthetic.pdf", pages: [] },
    document: null,
    error: {
      code: "NO_READABLE_TEXT",
      message: "읽을 수 있는 텍스트가 없습니다. 스캔 문서는 지원하지 않습니다.",
    },
  };
  await page.route("**/api/analyze", (route) =>
    route.fulfill({ json: { results: [good, bad], aiConfigured: true } }),
  );
  await uploadSynthetic(page);
  await page.getByRole("button", { name: "서류 분석 시작" }).click();
  await expect(
    page.getByRole("heading", { name: "부분 처리 완료" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("상품 수량 · 품목 1", { exact: true }),
  ).toHaveValue("500");
  await expect(page.getByText("오류 코드: NO_READABLE_TEXT")).toBeVisible();
});

test("no access code or bearer header; provider failure and actual waiting state", async ({
  page,
}) => {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { aiConfigured: true } }),
  );
  let attempts = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/analyze", async (route) => {
    expect(route.request().headers().authorization).toBeUndefined();
    attempts++;
    if (attempts === 1) {
      await route.fulfill({
        status: 502,
        json: { error: { code: "API_AUTH_OR_CONFIG", message: "OpenAI 키·모델·접근 권한 설정을 확인해 주세요." } },
      });
      return;
    }
    await pending;
    await route.fulfill({ json: { results: syntheticResults("A"), aiConfigured: true } });
  });
  await uploadSynthetic(page);
  await expect(page.getByLabel("분석 접근 코드")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "서류 분석 시작" })).toBeEnabled();
  await page.getByRole("button", { name: "서류 분석 시작" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "OpenAI 키" })).toBeVisible();
  await page.getByRole("button", { name: "서류 분석 시작" }).click();
  await expect(page.getByRole("button", { name: "원문 추출 및 AI 분석 진행 중" })).toBeVisible();
  await expect(page.getByLabel("Commercial Invoice PDF 파일 선택")).toBeDisabled();
  await expect(page.getByText("실제 응답을 기다리는 중입니다.", { exact: false })).toBeVisible();
  release();
  await expect(page.getByRole("heading", { name: "분석 응답 완료" })).toBeVisible();
});

test("actual unreadable PDF displays failure instead of AI success", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("Commercial Invoice PDF 파일 선택")).toBeEnabled();
  await page
    .getByLabel("Commercial Invoice PDF 파일 선택")
    .setInputFiles({
      name: "blank-synthetic.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await makePdf([[]])),
    });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "서류 분석 시작" }).click();
  await expect(
    page.getByRole("heading", { name: "분석 실패", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("오류 코드: NO_READABLE_TEXT")).toBeVisible();
});
