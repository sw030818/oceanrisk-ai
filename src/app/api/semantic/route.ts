import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSameOrigin } from "@/modules/security/origin";
import { boundedJson } from "@/modules/security/bounded-json";
import { semanticSnapshotSchema, verifySemanticSnapshot } from "@/modules/shipping/semantic-receipt";
import { analyzeSemantics } from "@/modules/shipping/semantic-analysis";
import { AnalysisError, safeError } from "@/modules/documents/errors";
export const runtime="nodejs",maxDuration=60,dynamic="force-dynamic";
const schema=z.strictObject({snapshots:z.array(semanticSnapshotSchema).min(1).max(24)});
export async function POST(request:Request) {
  const headers={"Cache-Control":"no-store, private"};
  try {
    requireSameOrigin(request);
    const signal=AbortSignal.any([request.signal,AbortSignal.timeout(55000)]);
    const parsed=schema.safeParse(await boundedJson(request,signal));
    if(!parsed.success)throw new AnalysisError("INVALID_REQUEST","서버가 확인한 원문 분석 자료가 필요합니다.",400);
    const {snapshots}=parsed.data;
    if(new Set(snapshots.map(s=>s.document.id)).size!==snapshots.length||snapshots.some(s=>!verifySemanticSnapshot(s)))throw new AnalysisError("INVALID_REQUEST","원문 분석 확인 자료가 변경되었거나 만료되었습니다. PDF를 다시 분석해 주세요.",400);
    const semantic=await analyzeSemantics(snapshots.map(s=>s.document),{signal});
    return NextResponse.json({semantic,aiCalled:!!semantic.model,sourceSha:process.env.VERCEL_GIT_COMMIT_SHA??null},{headers});
  } catch(error) {return NextResponse.json({error:safeError(error),aiCalled:false},{status:error instanceof AnalysisError?error.httpStatus:500,headers});}
}
