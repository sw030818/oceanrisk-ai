// Explicit PHASE 2.3 budget. Never borrows/resets PHASE 2.2's spent ledger.
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { openSync, closeSync, unlinkSync } from "node:fs";
import { chromium } from "@playwright/test";
import { phase23Fixture } from "../tests/fixtures/phase23";
import { openAIRequest } from "../src/modules/ai/openai";
import { reviewDocuments } from "../src/modules/rules/review";
import { productKey } from "../src/modules/rules/items";
import { assertProduction } from "./lib/release-policy";
import {
  requestUpperCost,
  reserveTestBudget,
  reconcileTestBudget,
  type TestBudget,
} from "./lib/openai-budget";
import type {
  AnalysisResult,
  GroundedField,
} from "../src/modules/documents/schema";
const args = process.argv.slice(2),
  arg = (key: string) =>
    args.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3),
  sha = arg("sha");
if (!sha || !/^[a-f0-9]{40}$/.test(sha))
  throw new Error("Exact Production SHA required");
if (
  arg("approved-documents") !== "2" ||
  arg("approved-max-cost-usd") !== "0.03"
)
  throw new Error(
    "Explicit new approval required: 2 documents / $0.03. No provider call made.",
  );
const base = "https://oceanrisk-ai.vercel.app",
  directory = "test-results/live-phase23",
  path = directory + "/ledger.json";
await mkdir(directory, { recursive: true });
const lock = openSync(directory + "/run.lock", "wx");
process.once("exit", () => {
  closeSync(lock);
  unlinkSync(directory + "/run.lock");
});
let budget: TestBudget;
try {
  budget = JSON.parse(await readFile(path, "utf8"));
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== "ENOENT")
    throw new Error("Unreadable ledger; do not reset");
  try {
    const archive = JSON.parse(
      await readFile("docs/validation/phase23-2026-10-11.json", "utf8"),
    );
    if (archive.mode !== "actual-openai-phase23-synthetic" || !archive.budget)
      throw new Error("Invalid archive");
    budget = archive.budget;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT")
      throw new Error("Unreadable archived budget; do not reset");
    budget = {
      documents: 0,
      measuredCostUsd: 0,
      unresolvedCostUpperUsd: 0,
      maxDocuments: 2,
      maxCostUsd: 0.03,
    };
  }
}
if (
  budget.maxDocuments !== 2 ||
  budget.maxCostUsd !== 0.03 ||
  !Number.isSafeInteger(budget.documents) ||
  budget.documents < 0 ||
  budget.documents > 2 ||
  ![budget.measuredCostUsd, budget.unresolvedCostUpperUsd].every(
    (n) => Number.isFinite(n) && n >= 0,
  )
)
  throw new Error("Invalid PHASE 2.3 budget");
const save = async () => {
  await writeFile(path + ".tmp", JSON.stringify(budget, null, 2));
  await rename(path + ".tmp", path);
};
const status = await (
  await fetch(base + "/api/status?phase23=" + Date.now(), {
    signal: AbortSignal.timeout(10000),
  })
).json();
assertProduction(status, sha);
if (status.model !== "gpt-6-luna")
  throw new Error("Unpriced model; no call made");
const fixtures = await Promise.all([
  phase23Fixture("invoice"),
  phase23Fixture("packing_list"),
]);
const bounds = fixtures.map((f) =>
  requestUpperCost(
    Buffer.byteLength(JSON.stringify(openAIRequest(f.pdf, "gpt-6-luna"))),
  ),
);
reserveTestBudget(budget, bounds);
await save();
console.log(
  JSON.stringify({
    mode: "actual-openai-phase23-synthetic",
    reservedDocuments: budget.documents,
    reservedUpperUsd: budget.unresolvedCostUpperUsd,
    sha,
  }),
);
const form = new FormData();
fixtures.forEach((f) => form.append("files", f.makeFile()));
form.append("slots", '["invoice","packing_list"]');
let responseBody: {
  results: AnalysisResult[];
  aiConfigured: boolean;
  review?: unknown;
} | null = null;
try {
  const r = await fetch(base + "/api/analyze", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(110000),
  });
  const p = await r.json().catch(() => null);
  if (r.ok && Array.isArray(p?.results) && p.results.length === 2)
    responseBody = p;
} catch {
  /* Unknown spend stays reserved; no retry. */
}
const results = responseBody?.results ?? [];
results.forEach((r, i) =>
  reconcileTestBudget(budget, bounds[i], r.aiUsage?.estimatedCostUsd ?? null),
);
await save();
let expected = 0,
  correct = 0,
  grounded = 0;
const field = (
  wanted: { value: unknown },
  actual: GroundedField<unknown> | undefined,
) => {
  if (wanted.value === null) return;
  expected++;
  if (actual && actual.value === wanted.value) {
    correct++;
    if (actual.status === "verified") grounded++;
  }
};
fixtures.forEach((f, i) => {
  const d = results[i]?.document;
  for (const key of [
    "seller",
    "buyer",
    "documentNumber",
    "purchaseOrder",
    "invoiceReference",
    "partialShipment",
    "currency",
    "totalAmount",
    "subtotalAmount",
    "discountAmount",
    "freightAmount",
    "taxAmount",
  ] as const)
    if (f.data[key]) field(f.data[key]!, d?.[key]);
  for (const row of f.data.items) {
    const matches =
      d?.items.filter(
        (r) =>
          productKey(r.description.value) === productKey(row.description.value),
      ) ?? [];
    const actual = matches.length === 1 ? matches[0] : undefined;
    for (const key of [
      "description",
      "quantity",
      "unit",
      "netWeight",
      "grossWeight",
      "weightUnit",
      "sku",
      "packageQuantity",
      "packageUnit",
      "unitPrice",
      "amount",
    ] as const)
      if (row[key]) field(row[key]!, actual?.[key]);
  }
});
const docs = results.flatMap((r) => (r.document ? [r.document] : []));
const review = reviewDocuments(
  docs,
  docs.length === 2
    ? { invoiceId: docs[0].id, packingId: docs[1].id }
    : undefined,
);
const browser: { executed: boolean; passed: boolean; reason: string | null } = {
  executed: false,
  passed: false,
  reason: null,
};
if (responseBody) {
  let instance: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    instance = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      headless: true,
    });
    const context = await instance.newContext();
    const page = await context.newPage();
    // Fetch the real deployed HTML/assets through Node's configured, TLS-verified
    // proxy transport. No ignoreHTTPSErrors or browser TLS verification bypass.
    // Reuse this actual paid response in memory; UI verification costs no new call.
    await page.route("**/*", async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      if (url.origin !== base) {
        await route.abort();
        return;
      }
      if (url.pathname === "/api/analyze") {
        await route.fulfill({ json: responseBody! });
        return;
      }
      if (request.method() !== "GET") {
        await route.abort();
        return;
      }
      const r = await fetch(request.url(), {
        signal: AbortSignal.timeout(20000),
        headers: { accept: request.headers().accept ?? "*/*" },
      });
      const headers = Object.fromEntries(
        [...r.headers.entries()].filter(
          ([name]) =>
            ![
              "content-encoding",
              "content-length",
              "transfer-encoding",
              "connection",
            ].includes(name.toLowerCase()),
        ),
      );
      await route.fulfill({
        headers,
        status: r.status,
        contentType:
          r.headers.get("content-type") ?? "application/octet-stream",
        body: Buffer.from(await r.arrayBuffer()),
      });
    });
    await page.goto(base, { waitUntil: "networkidle" });
    for (const [i, f] of fixtures.entries())
      await page
        .getByLabel(
          i ? "Packing List PDF 파일 선택" : "Commercial Invoice PDF 파일 선택",
        )
        .setInputFiles({
          name: f.pdf.fileName,
          mimeType: "application/pdf",
          buffer: Buffer.from(f.bytes),
        });
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "서류 분석 시작" }).click();
    await page.getByTestId("review-panel").waitFor();
    browser.executed = true;
    const a = await page
        .getByTestId("check-quantity-0")
        .getAttribute("data-assessment"),
      b = await page
        .getByTestId("check-quantity-1")
        .getAttribute("data-assessment");
    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    );
    await page
      .getByTestId("check-quantity-0")
      .getByRole("button", { name: /Invoice 수량/ })
      .click();
    await page.getByRole("dialog").waitFor();
    browser.passed =
      a === "confirmed_match" && b === "confirmed_match" && mobile;
    if (!browser.passed) browser.reason = "UI_ASSERTION_FAILED";
  } catch {
    browser.reason = "PRODUCTION_BROWSER_TRANSPORT_OR_ASSERTION_FAILED";
  } finally {
    await instance?.close();
  }
}
const parsed = results.filter((r) => r.document && !r.error).length;
const codes = results.map((r) =>
  [
    "INVALID_AI_RESPONSE",
    "API_AUTH_OR_CONFIG",
    "API_RATE_LIMIT",
    "API_NOT_CONFIGURED",
    "API_ERROR",
    "API_UNAVAILABLE",
    "API_REQUEST_REJECTED",
  ].includes(r.error?.code ?? "")
    ? r.error!.code
    : r.error
      ? "OTHER_SAFE_ERROR"
      : null,
);
const usage = results.map((r) => r.aiUsage ?? null);
const passed =
  parsed === 2 &&
  grounded === expected &&
  expected > 0 &&
  review.summary.confirmedQuantityMatches === 2 &&
  !review.summary.referenceWarning &&
  browser.passed;
const report = {
  mode: "actual-openai-phase23-synthetic",
  recordedAtUtc: new Date().toISOString(),
  sourceSha: sha,
  keyPresence: true,
  model: "gpt-6-luna",
  budget,
  documentRequests: budget.documents,
  batchRequests: 1,
  automaticRetries: 0,
  structuredSuccesses: parsed,
  expectedFields: expected,
  correctValues: correct,
  groundedCorrectFields: grounded,
  ruleSummary: review.summary,
  quantityStates: review.quantityChecks.map((c) => c.assessment),
  fieldStates: results.map(
    (r) =>
      r.document?.items.map((row) =>
        Object.fromEntries(
          [
            "description",
            "quantity",
            "unit",
            "netWeight",
            "grossWeight",
            "sku",
          ].map((key) => [key, row[key as keyof typeof row]?.status]),
        ),
      ) ?? null,
  ),
  errorCodes: codes,
  providerDiagnostics: results.map((r) => r.error?.diagnostics ?? null),
  verificationIssues: results.map(
    (r) =>
      r.document?.items.map((row) =>
        Object.fromEntries(
          ["quantity", "netWeight", "grossWeight", "sku"].map((key) => [
            key,
            row[key as keyof typeof row]?.verificationCode,
          ]),
        ),
      ) ?? null,
  ),
  usage,
  browser,
  passed,
  limitations: [
    "Synthetic reported structure only; actual user PDFs were not available",
    "No extra mismatch/provider tests paid; comprehensive regression tests remain mocked",
  ],
};
await writeFile(directory + "/report.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
process.exitCode = passed ? 0 : 1;
