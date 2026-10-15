import { paidTrial, reserveTrial, type TrialBudget } from "./trial-live";
import type { Fixture32 } from "./phase32-live";
// Not an approval: execute only after the user's separate PHASE38 consent.
export const policy38 = {
  directory: "test-results/live-phase38",
  archive: "docs/validation/phase38-live-2026-10-16.json",
  evidenceRef: "refs/heads/validation/phase38-evidence",
  documents: 8,
  requests: 8,
  cost: 0.1,
  phases: ["3.8"],
  name: "PHASE38",
  reserveRecovery: false,
};
export const reserve38 = (
  budget: TrialBudget,
  costs: number[],
  requests: number,
) => reserveTrial(policy38, budget, costs, requests);
export const paid38 = (
  sha: string,
  stage: string,
  fixtures: Pick<Fixture32, "bytes" | "pdf" | "wire">[],
) => paidTrial(policy38, sha, stage, fixtures);
