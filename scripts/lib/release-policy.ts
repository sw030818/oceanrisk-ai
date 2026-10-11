export function assertReleaseState(state: {
  branch: string;
  unstaged: boolean;
  untracked: boolean;
  remoteAncestor: boolean;
  stagedPaths: string[];
}) {
  if (state.branch !== "main") throw new Error("Ship requires main. Synchronize main before editing; no automatic branch switching or merge.");
  if (state.unstaged || state.untracked) throw new Error("Review and stage only task files before shipping. Unstaged/untracked files remain; nothing was committed or pushed.");
  if (!state.remoteAncestor) throw new Error("Remote main advanced or diverged. Reconcile and rerun checks; never force push.");
  if (state.stagedPaths.some((path) => /(?:^|\/)\.env(?:\.|$)/.test(path) && !path.endsWith(".env.example") || /\.(?:pem|key|p12)$/.test(path)))
    throw new Error("Credential file staged. Remove it from the index before shipping.");
}
export function assertProduction(payload: unknown, sha: string) {
  const data = payload as { aiConfigured?: unknown; provider?: unknown; model?: unknown; accessRequired?: unknown; accessConfigured?: unknown; deployment?: { commitSha?: unknown; id?: unknown; environment?: unknown } } | null;
  if (!data || data.deployment?.commitSha !== sha) throw new Error("Production has not served the expected commit SHA.");
  if (data.deployment.environment !== "production") throw new Error("Endpoint did not identify a Production deployment.");
  if ("accessRequired" in data || "accessConfigured" in data) throw new Error("Production still serves the access-gated status contract.");
  if (data.aiConfigured !== true) throw new Error("Production OpenAI key is not configured; no real analysis readiness claimed.");
  if (data.provider !== "openai" || typeof data.model !== "string" || !/^[a-zA-Z0-9._-]{1,80}$/.test(data.model)) throw new Error("Production does not serve the OpenAI provider contract.");
  return { commitSha: sha, id: typeof data.deployment.id === "string" && /^dpl_[a-zA-Z0-9_-]+$/.test(data.deployment.id) ? data.deployment.id : null };
}
