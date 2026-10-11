import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json(
    { aiConfigured: Boolean(process.env.GEMINI_API_KEY) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
