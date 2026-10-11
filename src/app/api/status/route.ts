import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json(
    {
      aiConfigured: Boolean(process.env.OPENAI_API_KEY),
      deployment: {
        commitSha: /^[a-f0-9]{40}$/i.test(process.env.VERCEL_GIT_COMMIT_SHA ?? "")
          ? process.env.VERCEL_GIT_COMMIT_SHA
          : null,
        id: /^dpl_[a-zA-Z0-9_-]+$/.test(process.env.VERCEL_DEPLOYMENT_ID ?? "")
          ? process.env.VERCEL_DEPLOYMENT_ID
          : null,
        environment: process.env.VERCEL_ENV === "production" ? "production" : "non-production",
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
