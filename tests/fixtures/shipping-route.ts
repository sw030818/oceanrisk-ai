import type { Page } from "@playwright/test";
import type { ShippingResult } from "../../src/modules/shipping/prepare";
import { reviewShipping } from "../../src/modules/shipping/review";
import { summarizeShipping } from "../../src/modules/shipping/summary";
// Existing regression cases keep their assertions about evidence and outcomes;
// transport fixtures now answer the actual sequential batch contract.
export async function routeShipping(
  page: Page,
  results: ShippingResult[],
  phase = "3.2",
  analyze = true,
) {
  let count = 0;
  const used = new Set<string>();
  await page.route("**/api/analyze", async (route) => {
    count++;
    const bytes = route.request().postDataBuffer()!;
    const form = await new Response(new Uint8Array(bytes), {
      headers: { "content-type": route.request().headers()["content-type"] },
    }).formData();
    const subset = form.getAll("files").map((file) => {
      const r = results.find(
        (r) => r.pdf.fileName === (file as File).name && !used.has(r.pdf.id),
      );
      if (!r) throw new Error("Missing batch regression fixture");
      used.add(r.pdf.id);
      return r;
    });
    const review =
      analyze && phase !== "3.1"
        ? reviewShipping(
            subset.flatMap((r) => (r.document ? [r.document] : [])),
          )
        : { status: "not_performed", checks: [] };
    await route.fulfill({
      json: {
        mode: analyze ? "shipping-analysis" : "pdf-preparation",
        phase,
        results: subset,
        summary: summarizeShipping(subset),
        review,
        aiCalled: analyze,
        capabilities: {
          aiExtraction: analyze,
          pairComparison: analyze && phase !== "3.1",
          triangularComparison: analyze && phase !== "3.1",
        },
      },
    });
  });
  return { calls: () => count };
}
