import { test, expect, type Page } from "@playwright/test";
test.setTimeout(60000);
import { evaluation33, fixture33 } from "../fixtures/shipping33";
import {
  shippingTypes,
  shippingLabels,
} from "../../src/modules/shipping/catalog";
import { groundShipping } from "../../src/modules/shipping/ground";
import { reviewShipping } from "../../src/modules/shipping/review";
async function upload(
  page: Page,
  fixtures: Awaited<ReturnType<typeof fixture33>>[],
) {
  for (const t of shippingTypes) {
    const fs = fixtures.filter((f) => f.truth.type === t);
    if (fs.length)
      await page
        .getByLabel(shippingLabels[t].title + " PDF 파일 선택", { exact: true })
        .setInputFiles(
          fs.map((f) => ({
            name: f.pdf.fileName,
            mimeType: "application/pdf",
            buffer: Buffer.from(f.bytes),
          })),
        );
  }
}
async function mocked33(page: Page, failBatch = 0, deferSecond = false) {
  const fixtures = await Promise.all(evaluation33("complex").map(fixture33));
  let calls = 0;
  await page.route("**/api/analyze", async (route) => {
    calls++;
    const form = await new Response(
      new Uint8Array(route.request().postDataBuffer()!),
      {
        headers: { "content-type": route.request().headers()["content-type"] },
      },
    ).formData();
    if (calls === failBatch)
      return route.fulfill({
        status: 502,
        json: { error: { message: "합성 배치 연결 실패" } },
      });
    const ids = JSON.parse(String(form.get("documentIds"))),
      slots = JSON.parse(String(form.get("slots")));
    const results = await Promise.all(
      form.getAll("files").map(async (entry, i) => {
        const bytes = new Uint8Array(await (entry as File).arrayBuffer());
        const f = fixtures.find((f) =>
          Buffer.from(f.bytes).equals(Buffer.from(bytes)),
        )!;
        const pdf = { ...f.pdf, id: ids[i] };
        return {
          pdf,
          document: groundShipping(f.wire, pdf, slots[i]),
          uploadSlot: slots[i],
          originalUploadSlot: slots[i],
          detectedType: f.truth.type,
          typeMismatch: false,
          error: null,
        };
      }),
    );
    if (deferSecond && calls === 1) {
      results[1].error = {
        code: "BATCH_DEFERRED",
        message: "아직 AI 호출 전",
      } as never;
      results[1].document.extractionStatus = "not_performed";
    }
    return route.fulfill({
      json: {
        phase: "3.3",
        mode: "shipping-analysis",
        results,
        capabilities: { pairComparison: true, triangularComparison: true },
        review: reviewShipping(results.map((r) => r.document)),
      },
    });
  });
  await page.goto("/");
  await upload(page, fixtures);
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "AI 서류 분석 시작", exact: true })
    .click();
  await expect(page.getByTestId("shipping-document")).toHaveCount(6);
  return { calls: () => calls };
}
test("multiple selection appends, duplicate names have unique IDs, individual remove and replace preserve siblings", async ({
  page,
}) => {
  await page.goto("/");
  const f = await fixture33(evaluation33("normal")[0]),
    input = page.getByLabel("House B/L PDF 파일 선택", { exact: true });
  const payload = {
    name: "same.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(f.bytes),
  };
  await input.setInputFiles([payload, payload]);
  await input.setInputFiles({ ...payload, name: "third.pdf" });
  await expect(page.getByTestId("upload-file")).toHaveCount(3);
  const ids = await page
    .getByTestId("upload-file")
    .evaluateAll((es) => es.map((e) => e.getAttribute("data-upload-id")));
  expect(new Set(ids).size).toBe(3);
  await page
    .getByLabel("House B/L 개별 PDF 교체")
    .setInputFiles({ ...payload, name: "unused.pdf" }); // no selected target leaves siblings intact
  await page
    .getByRole("button", { name: "same.pdf 1번째 파일 교체", exact: true })
    .click();
  await page
    .getByLabel("House B/L 개별 PDF 교체")
    .setInputFiles({ ...payload, name: "replaced.pdf" });
  await expect(page.getByTestId("upload-file")).toHaveCount(3);
  await expect(page.getByText("replaced.pdf", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "same.pdf 제거", exact: true })
    .click();
  await expect(page.getByTestId("upload-file")).toHaveCount(2);
  await expect(page.getByRole("region", { name: /업로드 영역/ })).toHaveCount(
    3,
  );
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.getByText("복수 신고·분할 자료 PDF 추가")).toHaveCount(0);
});
test("multiple simultaneous dropped files append and do not replace prior files", async ({
  page,
}) => {
  await page.goto("/");
  const transfer = await page.evaluateHandle(() => {
    const d = new DataTransfer();
    for (const name of ["drop1.pdf", "drop2.pdf"])
      d.items.add(
        new File(["%PDF-synthetic"], name, { type: "application/pdf" }),
      );
    return d;
  });
  const area = page.getByRole("region", { name: "수출신고필증 업로드 영역" });
  await area.dispatchEvent("drop", { dataTransfer: transfer });
  await area.dispatchEvent("drop", { dataTransfer: transfer });
  await expect(page.getByTestId("upload-file")).toHaveCount(4);
});
test("six documents in three batches retain qualified sources and cross-batch declaration aggregation", async ({
  page,
}) => {
  const { calls } = await mocked33(page);
  expect(calls()).toBe(3);
  await expect(page.getByTestId("shipping-review")).toBeVisible();
  await page
    .getByLabel("검토 결과 필터")
    .selectOption("all");
  await expect(
    page.getByRole("button", { name: "복수 신고 물품 수량 합계", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "원본 PDF 열기 (브라우저 내 파일)" }),
  ).toHaveCount(6);
  const source = page
    .locator(
      '[data-testid="shipping-check"][data-assessment="confirmed_match"]',
    )
    .first();
  await source.locator("xpath=ancestor::tr").getByRole("button").nth(1).click();
  await expect(page.getByRole("dialog")).toContainText("실제 PDF 블록 위치");
});
test("a failed middle batch preserves four successes and continues later independent documents", async ({
  page,
}) => {
  const { calls } = await mocked33(page, 2);
  expect(calls()).toBe(3);
  await expect(
    page.getByRole("heading", { name: "문서 분석 일부 성공 · 확인 필요" }),
  ).toBeVisible();
  await expect(page.getByText("오류 코드: BATCH_REQUEST_FAILED")).toHaveCount(
    2,
  );
  // The verdict leads with the failed files so a partial comparison is not read as complete.
  await expect(page.getByTestId("result-verdict")).toContainText(
    "파일 2개의 AI 분석이 실패해 비교에서 빠졌습니다",
  );
  await expect(
    page.getByRole("alert").filter({ hasText: "합성 배치 연결 실패" }),
  ).toHaveCount(2);
});
test("mobile correction and restoration recompute without an additional paid request", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { calls } = await mocked33(page);
  await page
    .getByText("AI 추출값·원문 근거 확인 및 수정", { exact: true })
    .first()
    .click();
  await page
    .getByLabel("House B/L · 포장 개수", { exact: true })
    .first()
    .fill("31");
  await expect(page.getByTestId("shipping-document").first()).toContainText(
    "사용자 수정",
  );
  await page
    .getByTestId("shipping-document")
    .first()
    .getByRole("button", { name: "원래 AI 추출값 복원" })
    .click();
  expect(calls()).toBe(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("native PDF-only mode handles six documents with duplicate names and zero AI capabilities", async ({
  page,
}) => {
  const fixtures = await Promise.all(evaluation33("complex").map(fixture33));
  const requests: string[] = [];
  await page.route("**/api/analyze", async (route) => {
    requests.push(route.request().postDataBuffer()!.toString());
    await route.continue();
  });
  await page.goto("/");
  await upload(page, fixtures);
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "PDF 원문만 보기", exact: true })
    .click();
  await expect(page.getByTestId("shipping-document")).toHaveCount(6);
  await expect(
    page.getByRole("heading", { name: "PDF 자료 준비 완료", exact: true }),
  ).toBeVisible();
  expect(requests).toHaveLength(3);
  expect(
    requests.every(
      (s) => s.includes("prepare") && !s.includes('name="ocr"\r\n\r\nauto'),
    ),
  ).toBe(true);
  await expect(page.getByTestId("shipping-review")).toHaveCount(0);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#shipping-print-report")).toContainText(
    "서류 간 대조 미실시",
  );
  await expect(page.locator("#shipping-print-report")).not.toContainText(
    "확정 불일치 0",
  );
});
test("large files split into byte-safe requests rather than raising Vercel body limits", async ({
  page,
}) => {
  const f = await fixture33(evaluation33("normal")[0]);
  const sizes: number[] = [];
  await page.route("**/api/analyze", async (route) => {
    sizes.push(route.request().postDataBuffer()!.length);
    await route.continue();
  });
  await page.goto("/");
  await page
    .getByLabel("House B/L PDF 파일 선택", { exact: true })
    .setInputFiles(
      [3, 2].map((mb, i) => ({
        name: `large-${i}.pdf`,
        mimeType: "application/pdf",
        buffer: Buffer.concat([
          Buffer.from(f.bytes),
          Buffer.alloc(mb * 1024 * 1024 - f.bytes.length),
        ]),
      })),
    );
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "PDF 원문만 보기", exact: true })
    .click();
  await expect(page.getByTestId("shipping-document")).toHaveCount(2);
  expect(sizes).toHaveLength(2);
  expect(sizes.every((n) => n < 4.5 * 1024 * 1024)).toBe(true);
});
test("print report includes reviewed values and source references without whole PDF text", async ({
  page,
}) => {
  await mocked33(page);
  await expect(
    page.getByRole("button", { name: "검토 보고서 인쇄 / PDF 저장" }),
  ).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#shipping-print-report")).toBeVisible();
  await expect(page.locator("#shipping-print-report")).toContainText(
    "원문 확인",
  );
  await expect(page.locator("#shipping-print-report")).not.toContainText(
    "SYNTHETIC EVALUATION ONLY",
  );
});

test("a server-deferred document moves to a fresh single-file batch without erasing prior successes", async ({
  page,
}) => {
  const { calls } = await mocked33(page, 0, true);
  expect(calls()).toBe(4);
  await expect(page.getByText("오류 코드: BATCH_DEFERRED")).toHaveCount(0);
  await expect(page.getByTestId("shipping-document")).toHaveCount(6);
});

test("adding a file after analysis retains existing edits and analyzes only the new document", async ({
  page,
}) => {
  const { calls } = await mocked33(page);
  await page.getByRole("button", { name: "서류 업로드", exact: true }).click();
  const f = await fixture33(evaluation33("complex")[0]);
  await page
    .getByLabel("House B/L PDF 파일 선택", { exact: true })
    .setInputFiles({
      name: f.pdf.fileName,
      mimeType: "application/pdf",
      buffer: Buffer.from(f.bytes),
    });
  await page
    .getByRole("button", { name: "AI 서류 분석 시작", exact: true })
    .click();
  await expect(page.getByTestId("shipping-document")).toHaveCount(7);
  expect(calls()).toBe(4);
  await expect(
    page.getByText("기존 성공 결과 6개를 유지했습니다.", { exact: false }),
  ).toBeVisible();
});

test("result filters separate confirmed matches from uncertainty without any new API request", async ({
  page,
}) => {
  const { calls } = await mocked33(page);
  await page.getByLabel("검토 결과 필터").selectOption("match");
  await expect(
    page.locator(
      '[data-testid="shipping-check"][data-assessment="confirmed_match"]',
    ),
  ).not.toHaveCount(0);
  await expect(
    page.locator(
      '[data-testid="shipping-check"][data-assessment="needs_review"]',
    ),
  ).toHaveCount(0);
  await page.getByLabel("검토 결과 필터").selectOption("review");
  await expect(
    page.locator(
      '[data-testid="shipping-check"][data-assessment="confirmed_match"]',
    ),
  ).toHaveCount(0);
  expect(calls()).toBe(3);
});
