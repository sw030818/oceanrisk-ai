import { readFileSync, appendFileSync, existsSync } from "node:fs";
const kind = process.argv[2];
const path = kind === "deployment" ? "test-results/deployment/report.json" : kind === "live" ? "test-results/live-gemini-production/report.json" : null;
if (!path) throw new Error("Summary kind must be deployment or live");
let markdown;
if (!existsSync(path)) markdown = `## ${kind} verification\nReport unavailable; no success claimed.\n`;
else {
  const data = JSON.parse(readFileSync(path, "utf8"));
  if (kind === "deployment") {
    const sha = /^[a-f0-9]{40}$/i.test(data.expectedSha ?? "") ? data.expectedSha : "unknown";
    const id = /^dpl_[a-zA-Z0-9_-]+$/.test(data.deploymentId ?? "") ? data.deploymentId : "not exposed";
    markdown = `## Production verification\n\nExpected commit: ${sha}\n\nServing expected Production SHA and configured key: **${data.verified === true}**\n\nDeployment ID: ${id}\n\nThis is HTTP serving identity verification, not Vercel control-plane Ready or AI accuracy.\n`;
    if (process.env.GITHUB_ACTIONS === "true") console.log(`::notice title=Production identity::SHA=${sha}; verified=${data.verified === true}; deploymentId=${id}`);
  } else {
    markdown = `## Actual Gemini synthetic Production validation\n\nServer key presence: ${data.keyConfigured === true ? "configured" : data.keyConfigured === false ? "absent" : "unknown"}\n\nCompleted: **${data.completed === true}**\n\nProduction upload attempts: ${Number.isInteger(data.serverRequestsAttempted) ? data.serverRequestsAttempted : "unknown"}\n\n| Case | Result | Criteria | Safe error codes |\n|---|---|---|---|\n`;
    const safeCode = (value) => typeof value === "string" && /^[A-Z0-9_]{1,60}$/.test(value) ? value : "none";
    for (const item of data.cases ?? []) {
      if (!/^[A-D]$/.test(item.id)) continue;
      const status = ["passed", "failed", "not_run"].includes(item.status) ? item.status : "unknown";
      const criteria = ["providerResponses", "types", "productValues", "quantityEvidence", "sourcePages", "ruleOutcome"].map((key) => `${key}=${item.criteria?.[key] === true ? "pass" : "unverified"}`).join("; ");
      const codes = Array.isArray(item.errorCodes) ? item.errorCodes.map(safeCode).join(", ") : safeCode(item.reason);
      markdown += `| ${item.id} | ${status} | ${criteria} | ${codes} |\n`;
      if (process.env.GITHUB_ACTIONS === "true") {
        const http = Number.isInteger(item.httpStatus) ? item.httpStatus : "not-recorded";
        console.log(`::notice title=Actual Gemini case ${item.id}::${status}; HTTP=${http}; ${criteria}; errors=${codes}`);
        const models = (item.modelsUsed ?? []).filter((value) => typeof value === "string" && /^gemini-[a-zA-Z0-9._-]+$/.test(value));
        if (models.length) console.log(`::notice title=Case ${item.id} models::${models.join(", ")}`);
        for (const [index, doc] of (item.groundingStatuses ?? []).entries()) {
          const states = ["seller", "buyer", "transactionReference", "partialShipment"].map((key) => `${key}=${["verified", "unverified", "missing", "user_edited"].includes(doc[key]) ? doc[key] : "unknown"}`).join("; ");
          console.log(`::notice title=Case ${item.id} context ${index + 1}::${states}`);
        }
      }
    }
    markdown += "\nOnly synthetic documents were used. No keys or raw document/model responses are included.\n";
  }
}
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
else console.log(markdown);
