import { spawnSync } from "node:child_process";
const env = { ...process.env, GEMINI_API_KEY: "", OPENAI_API_KEY: "", NEXT_TELEMETRY_DISABLED: "1", PLAYWRIGHT_SERVER_MODE: "production", VITEST_MAX_WORKERS: process.env.VITEST_MAX_WORKERS || "1" };
const buildOnly = process.argv[2] === "--build-only";
const checks = [["run", "typecheck"], ["run", "lint"], ["test"], ["run", "build"], ["run", "verify:runtime"]];
if (!buildOnly) { checks.unshift(["ci", "--no-audit", "--no-fund"]); checks.push(["run", "test:e2e"]); }
for (const args of checks) {
  const result = spawnSync("npm", args, { stdio: "inherit", env });
  if (result.error || result.status !== 0) { console.error(`Verification failed at npm ${args.join(" ")}; ship stopped.`); process.exit(result.status || 1); }
}
console.log(`${buildOnly ? "Vercel build gate" : "All local release"} checks passed. This does not prove a live OpenAI call or Vercel deployment.`);
