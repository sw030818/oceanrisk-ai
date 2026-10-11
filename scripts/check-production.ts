import { mkdir, writeFile } from "node:fs/promises";
import { assertProduction } from "./lib/release-policy";
const args = process.argv.slice(2);
const sha = args[0] === "--sha" ? args[1] : process.env.GITHUB_SHA;
if (!sha || !/^[a-f0-9]{40}$/i.test(sha)) throw new Error("Provide --sha with the verified main commit SHA");
const report: { expectedSha: string; verified: boolean; deploymentId: string | null; reason: string; attempts: number } = { expectedSha: sha, verified: false, deploymentId: null, reason: "Not checked", attempts: 0 };
const attempts = Number(process.env.PRODUCTION_CHECK_ATTEMPTS ?? 20);
if (!Number.isInteger(attempts) || attempts < 1 || attempts > 40) throw new Error("PRODUCTION_CHECK_ATTEMPTS must be 1-40");
for (let i = 0; i < attempts; i++) {
  report.attempts++;
  try {
    const response = await fetch("https://oceanrisk-ai.vercel.app/api/status", { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Production HTTP ${response.status}`);
    const match = assertProduction(await response.json(), sha);
    report.verified = true;
    report.deploymentId = match.id;
    report.reason = "Production HTTP response serves the expected SHA and has the OpenAI key configured. This is not key validity, a real AI accuracy test or Vercel control-plane Ready confirmation.";
    break;
  } catch (error) {
    // Proxy denial is not evidence that Production itself failed.
    report.reason = error instanceof Error && ["Production has not served the expected commit SHA.", "Endpoint did not identify a Production deployment.", "Production still serves the access-gated status contract.", "Production does not serve the OpenAI provider contract.", "Production OpenAI key is not configured; no real analysis readiness claimed."].includes(error.message) ? error.message : "Production endpoint could not be verified (network or HTTP failure).";
    console.log(`Production check ${i + 1}/${attempts}: ${report.reason}`);
  }
  if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 15000));
}
await mkdir("test-results/deployment", { recursive: true });
await writeFile("test-results/deployment/report.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
process.exitCode = report.verified ? 0 : 1;
