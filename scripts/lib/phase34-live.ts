import { paidTrial, reserveTrial, type TrialBudget } from "./trial-live";
import type { Fixture32 } from "./phase32-live";
export const directory34 = "test-results/live-phase34",
  archive34 = "docs/validation/phase34-live-2026-10-14.json";
export type Budget34 = TrialBudget;
const policy = {
  directory: directory34,
  archive: archive34,
  evidenceRef: "refs/heads/validation/phase34-evidence",
  documents: 30,
  requests: 40,
  cost: 0.15,
  phases: ["3.3", "3.4"],
  name: "PHASE34",
};
export const reserve34 = (b: Budget34, costs: number[], requests: number) =>
  reserveTrial(policy, b, costs, requests);
export const paid34 = (
  sha: string,
  stage: string,
  fixtures: Pick<Fixture32, "bytes" | "pdf" | "wire">[],
  ocr = false,
) => paidTrial(policy, sha, stage, fixtures, ocr);
