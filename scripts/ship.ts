import { spawnSync } from "node:child_process";
import { assertReleaseState } from "./lib/release-policy";
function git(...args: string[]) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.error || result.status !== 0) throw new Error(`Git ${args[0]} failed; no force push, merge, reset or credential fallback attempted.`);
  return result.stdout.trim();
}
function readState() {
  return {
    branch: git("branch", "--show-current"),
    unstaged: Boolean(git("diff", "--name-only")),
    untracked: Boolean(git("ls-files", "--others", "--exclude-standard")),
    remoteAncestor: spawnSync("git", ["merge-base", "--is-ancestor", "origin/main", "HEAD"]).status === 0,
    stagedPaths: git("diff", "--cached", "--name-only").split("\n").filter(Boolean),
  };
}
try {
  const args = process.argv.slice(2);
  const message = args[0] === "--message" && args.length === 2 ? args[1] : "";
  if (!message.trim() || message.length > 200 || /[\r\n]/.test(message)) throw new Error("Usage: npm run ship -- --message 'a meaningful description of the validated change'");
  git("fetch", "origin", "refs/heads/main:refs/remotes/origin/main");
  assertReleaseState(readState());
  git("push", "--dry-run", "origin", "HEAD:refs/heads/main");
  const indexTree = git("write-tree");
  const validatedHead = git("rev-parse", "HEAD");
  const result = spawnSync("npm", ["run", "verify"], { stdio: "inherit" });
  if (result.error || result.status !== 0) throw new Error("Release checks failed; no commit or push performed.");
  git("fetch", "origin", "refs/heads/main:refs/remotes/origin/main");
  assertReleaseState(readState());
  if (indexTree !== git("write-tree") || validatedHead !== git("rev-parse", "HEAD")) throw new Error("The staged tree or HEAD changed during validation. Rerun checks; no commit or push performed.");
  if (readState().stagedPaths.length) git("commit", "-m", message);
  const sha = git("rev-parse", "HEAD");
  git("push", "origin", "HEAD:refs/heads/main");
  const remote = git("ls-remote", "origin", "refs/heads/main").split(/\s+/)[0];
  if (remote !== sha) throw new Error("Push returned but remote SHA differs; GitHub preservation not confirmed.");
  git("fetch", "origin", "refs/heads/main:refs/remotes/origin/main");
  if (git("diff", "HEAD", "origin/main")) throw new Error("Remote source differs from local HEAD.");
  console.log(`GitHub main push verified: ${sha}`);
  const deployment = spawnSync("npm", ["run", "check:production", "--", "--sha", sha], { stdio: "inherit" });
  if (deployment.error || deployment.status !== 0) throw new Error(`Code preserved at ${sha}; Production verification failed or unavailable. Do not claim deployment success.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Ship failed.");
  process.exitCode = 1;
}
