import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { openSync, closeSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  requestUpperCost,
  reconcileTestBudget,
  type TestBudget,
} from "./openai-budget";
import { assertProduction } from "./release-policy";
import { shippingOpenAIRequest } from "../../src/modules/shipping/openai";
import {
  shippingBatches,
  mergeShippingResults,
} from "../../src/modules/shipping/batches";
import type { ShippingResult } from "../../src/modules/shipping/prepare";
import type { Fixture32 } from "./phase32-live";
export const directory33 = "test-results/live-phase33",
  archive33 = "docs/validation/phase33-live-2026-10-13.json";
export interface Budget33 extends TestBudget {
  requests: number;
  maxRequests: number;
}
export function reserve33(b: Budget33, costs: number[], requests: number) {
  if (
    costs.some((n) => !Number.isFinite(n) || n < 0) ||
    !Number.isInteger(requests) ||
    requests < costs.length
  )
    throw new Error("INVALID_RESERVATION");
  if (
    b.documents + costs.length > 24 ||
    b.requests + requests > 30 ||
    b.measuredCostUsd +
      b.unresolvedCostUpperUsd +
      costs.reduce((a, n) => a + n, 0) >
      0.1
  )
    throw new Error("PHASE33_BUDGET_STOP");
  b.documents += costs.length;
  b.requests += requests;
  b.unresolvedCostUpperUsd += costs.reduce((a, n) => a + n, 0);
}
export async function paid33(
  sha: string,
  stage: string,
  fixtures: Fixture32[],
  ocr = false,
) {
  if (!/^[a-f0-9]{40}$/.test(sha) || !/^[a-z0-9-]+$/.test(stage))
    throw new Error("Invalid source or safe stage ID");
  await mkdir(directory33, { recursive: true });
  const lock = openSync(directory33 + "/run.lock", "wx");
  try {
    let budget: Budget33 = {
      documents: 0,
      requests: 0,
      measuredCostUsd: 0,
      unresolvedCostUpperUsd: 0,
      maxDocuments: 24,
      maxRequests: 30,
      maxCostUsd: 0.1,
    };
    const recover = (b: Budget33) => {
      if (
        b.documents > budget.documents ||
        b.requests > budget.requests ||
        (b.documents === budget.documents &&
          b.measuredCostUsd + b.unresolvedCostUpperUsd >
            budget.measuredCostUsd + budget.unresolvedCostUpperUsd)
      )
        budget = b;
    };
    for (const path of [archive33, directory33 + "/ledger.json"])
      try {
        const p = JSON.parse(await readFile(path, "utf8"));
        recover(path === archive33 ? p.budget : p);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT")
          throw new Error("Unreadable budget; no reset");
      }
    const ref = "refs/heads/validation/phase33-evidence",
      remote = spawnSync("git", ["ls-remote", "--exit-code", "origin", ref], {
        encoding: "utf8",
      });
    if (remote.status !== 0 && remote.status !== 2)
      throw new Error("Cannot confirm remote budget");
    if (remote.status === 0) {
      const f = spawnSync(
        "git",
        [
          "fetch",
          "--no-tags",
          "origin",
          ref + ":refs/remotes/origin/validation/phase33-evidence",
        ],
        { encoding: "utf8" },
      );
      const r =
        f.status === 0
          ? spawnSync(
              "git",
              [
                "show",
                "refs/remotes/origin/validation/phase33-evidence:" + archive33,
              ],
              { encoding: "utf8" },
            )
          : null;
      if (r?.status !== 0) throw new Error("Cannot recover remote budget");
      recover(JSON.parse(r.stdout).budget);
    }
    if (
      budget.maxDocuments !== 24 ||
      budget.maxRequests !== 30 ||
      budget.maxCostUsd !== 0.1 ||
      ![budget.documents, budget.requests].every(Number.isSafeInteger) ||
      ![budget.measuredCostUsd, budget.unresolvedCostUpperUsd].every(
        (n) => Number.isFinite(n) && n >= 0,
      )
    )
      throw new Error("Invalid PHASE33 ledger");
    const base = "https://ai-portcheck.vercel.app";
    async function status() {
      const s = await (
        await fetch(base + "/api/status?live33=" + Date.now(), {
          signal: AbortSignal.timeout(15000),
        })
      ).json();
      assertProduction(s, sha);
      if (s.phase !== "3.3" || s.model !== "gpt-6-luna")
        throw new Error("Unexpected phase/model");
    }
    await status();
    let merged: ShippingResult[] = [];
    const batches = shippingBatches(
      fixtures.map((f) => ({
        id: f.pdf.id,
        slot: f.wire.type as "house_bl",
        file: new File([new Uint8Array(f.bytes)], f.pdf.fileName, {
          type: "application/pdf",
        }),
      })),
    );
    const save = async () => {
      await writeFile(
        directory33 + "/ledger.tmp",
        JSON.stringify(budget, null, 2),
      );
      await rename(directory33 + "/ledger.tmp", directory33 + "/ledger.json");
    };
    let batchRequests = 0;
    const batchDurationsMs: number[] = [];
    for (const batch of batches) {
      await status();
      const fs = batch.map((e) => fixtures.find((f) => f.pdf.id === e.id)!);
      // OCR is a separate bounded one-page evaluation: reserve two supplier calls
      // and $0.03 including vision transcription + extraction, not text-only pricing.
      // This runner never processes arbitrary customer/image batches.
      const costs = fs.map((f) =>
        ocr
          ? 0.03
          : requestUpperCost(
              Buffer.byteLength(
                JSON.stringify(shippingOpenAIRequest(f.pdf, "gpt-6-luna")),
              ),
              8192,
            ),
      );
      if (
        ocr &&
        (fs.length !== 1 ||
          fs[0].pdf.pages.length !== 1 ||
          fs[0].bytes.length > 1024 * 1024)
      )
        throw new Error("OCR_EVALUATION_BOUND");
      reserve33(budget, costs, fs.length * (ocr ? 2 : 1));
      await save();
      console.log(
        JSON.stringify({
          stage,
          sourceSha: sha,
          reservedDocuments: fs.length,
          reservedRequests: fs.length * (ocr ? 2 : 1),
          reservedUpperUsd: costs.reduce((a, n) => a + n, 0),
          budget,
          automaticRetries: 0,
        }),
      );
      const form = new FormData();
      batch.forEach((e) => form.append("files", e.file));
      form.append("slots", JSON.stringify(batch.map((e) => e.slot)));
      form.append("documentIds", JSON.stringify(batch.map((e) => e.id)));
      form.append("operation", "analyze");
      form.append("ocr", ocr ? "auto" : "off");
      const batchStarted = performance.now();
      batchRequests++;
      let results: ShippingResult[] = [];
      try {
        const r = await fetch(base + "/api/analyze", {
            method: "POST",
            body: form,
            signal: AbortSignal.timeout(115000),
          }),
          p = await r.json();
        if (
          r.ok &&
          p.mode === "shipping-analysis" &&
          p.phase === "3.3" &&
          p.results?.length === batch.length &&
          p.results.every(
            (v: ShippingResult, i: number) => v.pdf?.id === batch[i].id,
          )
        )
          results = p.results;
      } catch {
        /* unknown usage retains reservation, no automatic retry */
      }
      results.forEach((r, i) => {
        const measured = r.aiUsage?.estimatedCostUsd;
        const vision = r.ocrUsage?.estimatedCostUsd;
        reconcileTestBudget(
          budget,
          costs[i],
          typeof measured === "number" && (!ocr || typeof vision === "number")
            ? measured + (vision ?? 0)
            : null,
        );
      });
      await save();
      batchDurationsMs.push(Math.round(performance.now() - batchStarted));
      merged = mergeShippingResults(merged, results);
      await status();
      if (results.length !== batch.length || results.some((r) => r.error))
        break;
    }
    return {
      results: merged,
      budget,
      batchRequests,
      batchDurationsMs,
      sourceSha: sha,
      sourceShaStable: true,
    };
  } finally {
    closeSync(lock);
    unlinkSync(directory33 + "/run.lock");
  }
}
