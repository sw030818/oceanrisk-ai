import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json(
    {
      phase: "3.8",
      enginePhase: "3.9",
      capabilities: {
        pdfPreparation: true,
        multiFileBatches: true,
        selectiveOCR: true,
        nativeRecovery: true,
        automaticTargetedRecovery:
          process.env.SHIPPING_TARGETED_RECOVERY_ENABLED === "true",
        documentClassification: true,
        aiExtraction: true,
        semanticAnalysis: true,
        pairComparison: true,
        triangularComparison: true,
      },
      aiConfigured: Boolean(process.env.OPENAI_API_KEY),
      provider: "openai",
      model: /^[a-zA-Z0-9._-]{1,80}$/.test(
        process.env.OPENAI_MODEL ?? "gpt-6-luna",
      )
        ? (process.env.OPENAI_MODEL ?? "gpt-6-luna")
        : null,
      deployment: {
        commitSha: /^[a-f0-9]{40}$/i.test(
          process.env.VERCEL_GIT_COMMIT_SHA ?? "",
        )
          ? process.env.VERCEL_GIT_COMMIT_SHA
          : null,
        id: /^dpl_[a-zA-Z0-9_-]+$/.test(process.env.VERCEL_DEPLOYMENT_ID ?? "")
          ? process.env.VERCEL_DEPLOYMENT_ID
          : null,
        environment:
          process.env.VERCEL_ENV === "production"
            ? "production"
            : "non-production",
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
