import { describe, expect, it } from "vitest";
import { assertProduction, assertReleaseState } from "../../scripts/lib/release-policy";
const ready = { branch: "main", unstaged: false, untracked: false, remoteAncestor: true, stagedPaths: ["src/app/api/status/route.ts", ".env.example"] };
describe("release protection", () => {
  it("permits reviewed changes based on current main", () => expect(() => assertReleaseState(ready)).not.toThrow());
  it.each([
    { branch: "feature" }, { unstaged: true }, { untracked: true }, { remoteAncestor: false },
    { stagedPaths: [".env.local"] }, { stagedPaths: ["secret.key"] }, { stagedPaths: ["private/service.pem"] },
  ])("stops an unsafe release %j", (change) => expect(() => assertReleaseState({ ...ready, ...change })).toThrow());
});
describe("Production identity checks do not equate presence with live AI success", () => {
  const sha = "a".repeat(40);
  const payload = { provider: "openai", model: "gpt-6-luna", aiConfigured: true, deployment: { commitSha: sha, id: "dpl_synthetic", environment: "production" } };
  it("requires exact commit and Production identity", () => expect(assertProduction(payload, sha)).toEqual({ commitSha: sha, id: "dpl_synthetic" }));
  it.each([
    { ...payload, aiConfigured: false },
    { ...payload, provider: "gemini" },
    { ...payload, model: null },
    { ...payload, accessRequired: true },
    { ...payload, accessConfigured: true },
    { ...payload, deployment: { ...payload.deployment, environment: "preview" } },
    { ...payload, deployment: { ...payload.deployment, commitSha: "b".repeat(40) } },
    null,
  ])("rejects stale, incomplete or gated deployment %j", (data) => expect(() => assertProduction(data, sha)).toThrow());
  it("does not echo unexpected deployment IDs", () => expect(assertProduction({ ...payload, deployment: { ...payload.deployment, id: "private text" } }, sha).id).toBeNull());
});
