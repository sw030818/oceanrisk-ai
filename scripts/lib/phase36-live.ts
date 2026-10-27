import {
  paidTrial,
  withTrialBudget,
  reserveTrial,
  type TrialBudget,
} from "./trial-live";
import { assertProduction } from "./release-policy";
import { requestUpperCost, reconcileTestBudget } from "./openai-budget";
import { targetedRequest } from "../../src/modules/shipping/targeted-recovery";
import type { RecoveryTarget } from "../../src/modules/shipping/recovery";
import type { Fixture32 } from "./phase32-live";
import type { AIUsage } from "../../src/modules/documents/schema";
import type { ShippingField } from "../../src/modules/shipping/schema";
export const policy36 = {
  directory: "test-results/live-phase36",
  archive: "docs/validation/phase36-live-2026-10-14.json",
  evidenceRef: "refs/heads/validation/phase36-evidence",
  documents: 60,
  requests: 75,
  cost: 0.5,
  phases: ["3.6"],
  name: "PHASE36",
  reserveRecovery: true,
};
export type Budget36 = TrialBudget;
export const paid36 = (
  sha: string,
  stage: string,
  fixtures: Pick<Fixture32, "bytes" | "pdf" | "wire">[],
) => paidTrial(policy36, sha, stage, fixtures);
export const reserve36 = (
  budget: TrialBudget,
  costs: number[],
  requests: number,
) => reserveTrial(policy36, budget, costs, requests);
// Explicit targeted-only experiment. Initial synthetic candidates are not counted
// as a real first extraction. Same ledger/lock/caps as full-document validation.
export async function paidRecovery36(
  sha: string,
  fixture: Pick<Fixture32, "bytes" | "pdf">,
  targets: RecoveryTarget[],
) {
  if (!/^[a-f0-9]{40}$/.test(sha) || !targets.length || targets.length > 6)
    throw Error("INVALID_RECOVERY_TRIAL");
  return withTrialBudget(policy36, async (budget, save) => {
    const base = "https://ai-portcheck.vercel.app";
    const status = async () => {
      const s = await (
        await fetch(base + "/api/status?recovery=" + Date.now(), {
          signal: AbortSignal.timeout(15000),
        })
      ).json();
      assertProduction(s, sha);
      if (s.phase !== "3.6" || s.model !== "gpt-6-luna")
        throw Error("Unexpected phase/model");
    };
    await status();
    const upper = requestUpperCost(
      Buffer.byteLength(
        JSON.stringify(targetedRequest(fixture.pdf, targets, "gpt-6-luna")),
      ),
      1536,
    );
    reserve36(budget, [upper], 1);
    await save();
    console.log(
      JSON.stringify({
        stage: "targeted-only",
        sourceSha: sha,
        reservedDocuments: 1,
        reservedRequests: 1,
        reservedUpperUsd: upper,
        budget,
        automaticRetries: 0,
      }),
    );
    const form = new FormData();
    form.append(
      "files",
      new File([new Uint8Array(fixture.bytes)], fixture.pdf.fileName, {
        type: "application/pdf",
      }),
    );
    form.append("documentId", fixture.pdf.id);
    form.append(
      "targets",
      JSON.stringify(
        targets.map((t) => ({
          id: t.id,
          role: t.role,
          scope: t.scope,
          entityId: t.entityId,
        })),
      ),
    );
    let response: {
      supplierCalls: number;
      usage: AIUsage | null;
      error: { code: string } | null;
      proposals: {
        target: string;
        entityOwner: string;
        field: ShippingField;
      }[];
    } | null = null;
    const started = performance.now();
    try {
      const r = await fetch(base + "/api/recover", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(115000),
      });
      const p = await r.json();
      if (
        p.phase === "3.6" &&
        p.mode === "targeted-recovery" &&
        [0, 1].includes(p.supplierCalls)
      ) {
        response = p;
        if (p.supplierCalls === 0) {
          budget.requests--;
          reconcileTestBudget(budget, upper, 0);
        } else
          reconcileTestBudget(budget, upper, p.usage?.estimatedCostUsd ?? null);
      }
    } catch {
      /* Unknown usage retains reservation; no retry. */
    }
    await save();
    await status();
    return {
      response,
      budget,
      sourceSha: sha,
      durationMs: Math.round(performance.now() - started),
    };
  });
}
