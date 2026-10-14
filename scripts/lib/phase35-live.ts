import { paidTrial, reserveTrial, type TrialBudget } from "./trial-live";
import type { Fixture32 } from "./phase32-live";
export const directory35 = "test-results/live-phase35",
  archive35 = "docs/validation/phase35-live-2026-10-14.json";
export type Budget35 = TrialBudget;
const policy = {
  directory: directory35,
  archive: archive35,
  evidenceRef: "refs/heads/validation/phase35-evidence",
  documents: 60,
  requests: 75,
  cost: 0.5,
  phases: ["3.5"],
  name: "PHASE35",
};
export const reserve35 = (b: Budget35, costs: number[], requests: number) =>
  reserveTrial(policy, b, costs, requests);
export const paid35 = (
  sha: string,
  stage: string,
  fixtures: Pick<Fixture32, "bytes" | "pdf" | "wire">[],
) => paidTrial(policy, sha, stage, fixtures, false);
