import { paidTrial, reserveTrial, type TrialBudget } from "./trial-live";
import type { Fixture32 } from "./phase32-live";
// New user approval; never reuse an earlier phase's ledger or reset on a SHA change.
export const policy37 = {
  directory: "test-results/live-phase37",
  archive: "docs/validation/phase37-live-2026-10-15.json",
  evidenceRef: "refs/heads/validation/phase37-evidence",
  documents: 120,
  requests: 150,
  cost: 0.5,
  phases: ["3.7"],
  name: "PHASE37",
  reserveRecovery: true,
};
export const reserve37 = (b: TrialBudget, costs: number[], requests: number) =>
  reserveTrial(policy37, b, costs, requests);
export const paid37 = (
  sha: string,
  stage: string,
  fixtures: Pick<Fixture32, "bytes" | "pdf" | "wire">[],
) =>
  paidTrial(
    { ...policy37, reservedBalanceUsd: stage.startsWith("dev37-") ? 0.1 : 0 },
    sha,
    stage,
    fixtures,
  );
