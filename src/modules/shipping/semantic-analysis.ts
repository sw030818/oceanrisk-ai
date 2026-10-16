import type { ShippingDocument } from "./schema";
import type { OpenAIOptions } from "../ai/openai";
import { safeError } from "../documents/errors";
import { validateSemanticDecision } from "./semantic-validation";
import { semanticContext } from "./semantic-context";
import { requestSemantic } from "./semantic-request";
import { semanticWireSchema, type SemanticReport, type SemanticWire } from "./semantic-schema";
export async function analyzeSemantics(documents: ShippingDocument[], options: OpenAIOptions & {
  ai?: (context:ReturnType<typeof semanticContext>)=>Promise<SemanticWire>;
} = {}): Promise<SemanticReport> {
  const context = semanticContext(documents);
  const report: SemanticReport = {status:"not_needed",inputKey:context.key,decisions:{pairs:[]},requestedPairs:context.pairs.length,omittedPairs:context.omittedPairs};
  if (!context.pairs.length) return report;
  try {
    report.decisions = semanticWireSchema.parse(await (options.ai ?? (c=>requestSemantic(c,{
      ...options,onModelUsed:model=>{report.model=model;options.onModelUsed?.(model);},
      onUsage:usage=>{report.usage=usage;options.onUsage?.(usage);},
    })))(context));
    const coverage=new Set<string>();
    for(const d of report.decisions.pairs){const p=context.pairs.find(p=>p.left.id===d.leftId&&p.right.id===d.rightId);if(!p||d.relation==="unknown"||validateSemanticDecision(d,p).code==="INVALID_SEMANTIC_EVIDENCE")continue;coverage.add(p.left.id+"->"+p.right.ref.documentId);coverage.add(p.right.id+"->"+p.left.ref.documentId);}
    const incomplete=context.pairs.some(p=>!coverage.has(p.left.id+"->"+p.right.ref.documentId)||!coverage.has(p.right.id+"->"+p.left.ref.documentId));
    report.status = context.omittedPairs || incomplete ? "partial" : "complete";
  } catch(error) { report.status="failed";report.error=safeError(error); }
  return report;
}
