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
export interface TrialPolicy {
  directory: string;
  archive: string;
  evidenceRef: string;
  documents: number;
  requests: number;
  cost: number;
  phases: string[];
  name: string;
  reserveRecovery?: boolean;
  // Optional evaluation holdback; caps and ledger identity remain unchanged.
  reservedBalanceUsd?: number;
  // Explicit correction of an older, unapproved cost proposal; usage is retained.
  previousCostProposal?: number;
  previousApprovedCaps?: { documents: number; requests: number; cost?: number }[];
}
export interface TrialBudget extends TestBudget {
  requests: number;
  maxRequests: number;
}
export function reserveTrial(
  policy: TrialPolicy,
  b: TrialBudget,
  costs: number[],
  requests: number,
) {
  if (
    costs.some((n) => !Number.isFinite(n) || n < 0) ||
    !Number.isInteger(requests) ||
    requests < costs.length
  )
    throw Error("INVALID_RESERVATION");
  if (
    b.documents + costs.length > policy.documents ||
    b.requests + requests > policy.requests ||
    b.measuredCostUsd +
      b.unresolvedCostUpperUsd +
      costs.reduce((a, n) => a + n, 0) >
      policy.cost - (policy.reservedBalanceUsd ?? 0)
  )
    throw Error(policy.name + "_BUDGET_STOP");
  b.documents += costs.length;
  b.requests += requests;
  b.unresolvedCostUpperUsd += costs.reduce((a, n) => a + n, 0);
}
export function correctTrialCostProposal(policy:TrialPolicy,b:TrialBudget):TrialBudget {
  return policy.previousCostProposal===b.maxCostUsd && policy.cost<b.maxCostUsd
    ? {...b,maxCostUsd:policy.cost}:b;
}
export function migrateApprovedTrialCaps(policy: TrialPolicy, b: TrialBudget): TrialBudget {
  // Only explicit, phase-specific approved predecessor caps can be expanded.
  // Every count and every confirmed/unknown charge is retained unchanged.
  // A predecessor may name its own approved cost cap; it never lowers a cap.
  return policy.previousApprovedCaps?.some(p =>
    p.documents === b.maxDocuments && p.requests === b.maxRequests &&
    (p.cost ?? policy.cost) === b.maxCostUsd && (p.cost ?? policy.cost) <= policy.cost &&
    p.documents <= policy.documents && p.requests <= policy.requests)
    ? { ...b, maxDocuments: policy.documents, maxRequests: policy.requests, maxCostUsd: policy.cost } : b;
}
export async function withTrialBudget<T>(
  policy: TrialPolicy,
  run: (budget: TrialBudget, save: () => Promise<void>) => Promise<T>,
): Promise<T> {
  await mkdir(policy.directory, { recursive: true });
  const lock = openSync(policy.directory + "/run.lock", "wx");
  try {
    let budget: TrialBudget = {
      documents: 0,
      requests: 0,
      measuredCostUsd: 0,
      unresolvedCostUpperUsd: 0,
      maxDocuments: policy.documents,
      maxRequests: policy.requests,
      maxCostUsd: policy.cost,
    };
    const recover = (b: TrialBudget) => {
      b=migrateApprovedTrialCaps(policy,correctTrialCostProposal(policy,b));
      if (
        b.documents > budget.documents ||
        b.requests > budget.requests ||
        (b.documents === budget.documents &&
          b.measuredCostUsd + b.unresolvedCostUpperUsd >
            budget.measuredCostUsd + budget.unresolvedCostUpperUsd)
      )
        budget = b;
    };
    for (const path of [policy.archive, policy.directory + "/ledger.json"])
      try {
        const p = JSON.parse(await readFile(path, "utf8"));
        recover(path === policy.archive ? p.budget : p);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT")
          throw new Error("Unreadable budget; no reset");
      }
    const ref = policy.evidenceRef,
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
          ref + ":refs/remotes/origin/" + ref.slice("refs/heads/".length),
        ],
        { encoding: "utf8" },
      );
      const r =
        f.status === 0
          ? spawnSync(
              "git",
              [
                "show",
                "refs/remotes/origin/" +
                  policy.evidenceRef.slice("refs/heads/".length) +
                  ":" +
                  policy.archive,
              ],
              { encoding: "utf8" },
            )
          : null;
      if (r?.status !== 0) throw new Error("Cannot recover remote budget");
      recover(JSON.parse(r.stdout).budget);
    }
    if (
      budget.maxDocuments !== policy.documents ||
      budget.maxRequests !== policy.requests ||
      budget.maxCostUsd !== policy.cost ||
      ![budget.documents, budget.requests].every(Number.isSafeInteger) ||
      ![budget.measuredCostUsd, budget.unresolvedCostUpperUsd].every(
        (n) => Number.isFinite(n) && n >= 0,
      )
    )
      throw new Error("Invalid trial ledger");
    const save = async () => {
      await writeFile(
        policy.directory + "/ledger.tmp",
        JSON.stringify(budget, null, 2),
      );
      await rename(
        policy.directory + "/ledger.tmp",
        policy.directory + "/ledger.json",
      );
    };
    return await run(budget, save);
  } finally {
    closeSync(lock);
    unlinkSync(policy.directory + "/run.lock");
  }
}
export async function paidTrial(
  policy: TrialPolicy,
  sha: string,
  stage: string,
  fixtures: Pick<Fixture32, "bytes" | "pdf" | "wire">[],
  ocr = false,
) {
  if (!/^[a-f0-9]{40}$/.test(sha) || !/^[a-z0-9-]+$/.test(stage))
    throw new Error("Invalid source or safe stage ID");
  return withTrialBudget(policy, async (budget, save) => {
    const base = "https://ai-portcheck.vercel.app";
    async function status() {
      const s = await (
        await fetch(base + "/api/status?trial=" + Date.now(), {
          signal: AbortSignal.timeout(15000),
        })
      ).json();
      assertProduction(s, sha);
      if (!policy.phases.includes(s.phase) || s.model !== "gpt-6-luna")
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
      const extraCosts = fs.map((f) =>
        policy.reserveRecovery
          ? requestUpperCost(
              Buffer.byteLength(
                JSON.stringify(shippingOpenAIRequest(f.pdf, "gpt-6-luna")),
              ) + 16384,
              1536,
            )
          : 0,
      );
      if (
        ocr &&
        (fs.length !== 1 ||
          fs[0].pdf.pages.length !== 1 ||
          fs[0].bytes.length > 1024 * 1024)
      )
        throw new Error("OCR_EVALUATION_BOUND");
      reserveTrial(
        policy,
        budget,
        costs.map((n, i) => n + extraCosts[i]),
        fs.length * (ocr || policy.reserveRecovery ? 2 : 1),
      );
      await save();
      console.log(
        JSON.stringify({
          stage,
          sourceSha: sha,
          reservedDocuments: fs.length,
          reservedRequests: fs.length * (ocr || policy.reserveRecovery ? 2 : 1),
          reservedUpperUsd: costs.reduce((a, n, i) => a + n + extraCosts[i], 0),
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
          policy.phases.includes(p.phase) &&
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
        if (policy.reserveRecovery) {
          if (r.recoveryRequests === 0) {
            // Explicitly unissued request: release only its own reservation.
            budget.requests--;
            reconcileTestBudget(budget, extraCosts[i], 0);
          } else {
            reconcileTestBudget(
              budget,
              extraCosts[i],
              r.recoveryUsage?.estimatedCostUsd ?? null,
            );
          }
        }
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
  });
}
