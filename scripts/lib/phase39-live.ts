import {withTrialBudget,paidTrial,type TrialBudget} from "./trial-live";
import {requestUpperCost,reconcileTestBudget} from "./openai-budget";
import {semanticContext} from "../../src/modules/shipping/semantic-context";
import {semanticOpenAIRequest} from "../../src/modules/shipping/semantic-request";
import type {ShippingResult} from "../../src/modules/shipping/prepare";
import type {SemanticReport} from "../../src/modules/shipping/semantic-schema";
import type {Fixture32} from "./phase32-live";
// Current final-engine instruction authorizes cumulative PHASE39 USD2.
// The old USD10 was a proposal only. Preserve all prior usage, including unknown cost.
export const policy39={directory:"test-results/live-phase39",archive:"docs/validation/phase39-live.json",evidenceRef:"refs/heads/validation/phase39-evidence",documents:60,requests:120,cost:2,previousCostProposal:10,phases:["3.8"],name:"PHASE39",reserveRecovery:false};
export function reserve39(b:TrialBudget,cost:number,documents:number,requests:number){
 if(!Number.isFinite(cost)||cost<0||!Number.isInteger(documents)||documents<0||!Number.isInteger(requests)||requests<1||requests<documents)throw Error("INVALID_RESERVATION");
 if(b.maxDocuments!==60||b.maxRequests!==120||b.maxCostUsd!==2)throw Error("PHASE39_LEDGER_MISMATCH");
 if(b.documents+documents>60||b.requests+requests>120||b.measuredCostUsd+b.unresolvedCostUpperUsd+cost>2)throw Error("PHASE39_BUDGET_STOP");
 b.documents+=documents;b.requests+=requests;b.unresolvedCostUpperUsd+=cost;
}
export const paid39Extraction=(sha:string,stage:string,fixtures:Pick<Fixture32,"bytes"|"pdf"|"wire">[])=>paidTrial(policy39,sha,stage,fixtures);
export const semanticBudgetStopped39=(results:ShippingResult[])=>results.some(r=>r.error&&["API_AUTH_OR_CONFIG","API_RATE_LIMIT","INVALID_MODEL","API_NOT_CONFIGURED","BATCH_STOPPED"].includes(r.error.code));
export async function paid39Semantic(sha:string,results:ShippingResult[]) {
 return withTrialBudget(policy39,async(budget,save)=>{
  if(semanticBudgetStopped39(results))return{semantic:undefined,budget,attempted:false};
  const documents=results.flatMap(r=>!r.error&&r.document&&r.document.extractionStatus!=="not_performed"?[r.document]:[]),context=semanticContext(documents);
  if(!context.pairs.length)return{semantic:undefined,budget,attempted:false};
  const snapshots=results.flatMap(r=>r.semanticSnapshot?[r.semanticSnapshot]:[]);
  if(snapshots.length!==documents.length)throw Error("MISSING_SERVER_RECEIPT_NO_SEMANTIC_CALL");
  const base="https://oceanrisk-ai.vercel.app",status=await(await fetch(base+"/api/status?phase39="+Date.now(),{signal:AbortSignal.timeout(15000)})).json();
  if(status.deployment?.commitSha!==sha||status.enginePhase!=="3.9"||status.model!=="gpt-6-luna"||status.capabilities?.automaticTargetedRecovery!==false)throw Error("UNEXPECTED_PRODUCTION_NO_CALL");
  const upper=requestUpperCost(Buffer.byteLength(JSON.stringify(semanticOpenAIRequest(context))),8192);
  reserve39(budget,upper,0,1);await save();
  let semantic:SemanticReport|undefined;
  try {const r=await fetch(base+"/api/semantic",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({snapshots}),signal:AbortSignal.timeout(60000)}),p=await r.json();if(p.aiCalled===false){budget.requests--;reconcileTestBudget(budget,upper,0);}
    if(r.ok&&p.semantic){semantic=p.semantic;if(p.aiCalled!==false)reconcileTestBudget(budget,upper,semantic?.usage?.estimatedCostUsd??null);}}
  catch{/* Unknown timeout usage keeps full reservation. Never retry. */}
  await save();
  // A deployment moving during a paid request cannot be labelled exact-SHA.
  const after=await(await fetch(base+"/api/status?phase39="+Date.now(),{signal:AbortSignal.timeout(15000)})).json();
  const sourceShaStable=after.deployment?.commitSha===sha;
  return{semantic,budget,attempted:true,sourceShaStable};
 });
}
