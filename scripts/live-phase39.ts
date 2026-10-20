// Explicit PHASE39 consent required. Safe metadata only; snapshots and model
// outputs remain mode600 under the ignored private directory.
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {createHash,randomUUID} from "node:crypto";
import {shipping39Fixture,cases39} from "../tests/fixtures/shipping39";
import {shippingTypes} from "../src/modules/shipping/catalog";
import {emptyShippingWire} from "../src/modules/shipping/ground";
import {extractPdfText} from "../src/modules/pdf/extract";
import {shippingValues} from "../src/modules/shipping/fields";
import {reviewShipping} from "../src/modules/shipping/review";
import {score39} from "./lib/phase39-score";
import {policy39,paid39Extraction,paid39Semantic} from "./lib/phase39-live";
const arg=(name:string)=>process.argv.find(a=>a.startsWith("--"+name+"="))?.slice(name.length+3);
if(arg("approved-documents")!==String(policy39.documents)||arg("approved-requests")!==String(policy39.requests)||arg("approved-max-cost-usd")!=="2.00")throw Error("PHASE39 separate explicit approval required; flags are not consent");
const sha=arg("sha")??"",id=arg("case")??"",dir="test-results/live-phase39";
if(!/^[a-f0-9]{40}$/.test(sha)||!cases39.some(c=>c.id===id)&&!["set2","independent-normal","independent-model"].includes(id))throw Error("Exact SHA and one evaluation case required");
if(execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim()!==sha||execFileSync("git",["status","--porcelain"],{encoding:"utf8"}).trim())throw Error("Clean exact Production source required");
const status=await(await fetch("https://oceanrisk-ai.vercel.app/api/status",{signal:AbortSignal.timeout(15000)})).json();if(status.enginePhase!=="3.9"||status.deployment?.commitSha!==sha||status.capabilities?.automaticTargetedRecovery!==false)throw Error("Wrong Production or extra recovery enabled");
const fixtures=[];
for(const[index,type]of shippingTypes.entries()){
 if(["set2","independent-normal","independent-model"].includes(id)){
  const path=arg("private-dir");if(!path)throw Error("Private original Set2 path required");
  const bytes=new Uint8Array(await readFile(path+"/0"+(index+1)+".pdf"));fixtures.push({bytes,pdf:{id:"phase39-set2-"+type,fileName:"private-input-"+index+".pdf",pages:await extractPdfText(bytes,undefined,false,true)},wire:emptyShippingWire(type)});
 }else{const f=await shipping39Fixture(id,type);fixtures.push({...f,wire:emptyShippingWire(type)});}
}
await mkdir(dir+"/private",{recursive:true,mode:0o700});
for(const [index,f] of fixtures.entries()){ f.pdf.id=randomUUID();f.pdf.fileName="evaluation-"+index+".pdf"; }
const start=performance.now(),initial=await paid39Extraction(sha,"phase39-"+id,fixtures);
// Save the extraction checkpoint BEFORE a second stage. Failure or timeout
// cannot erase the completed documents or reset already reserved usage.
const tag=id+"-"+sha+"-"+Date.now();await writeFile(dir+"/private/"+tag+"-initial.json",JSON.stringify(initial),{mode:0o600});
const next=await paid39Semantic(sha,initial.results),documents=initial.results.flatMap(r=>!r.error&&r.document&&r.document.extractionStatus!=="not_performed"?[r.document]:[]),review=reviewShipping(documents,{semantic:next.semantic});
await writeFile(dir+"/private/"+tag+".json",JSON.stringify({initial,semantic:next.semantic,review}),{mode:0o600});
const report={kind:"New OpenAI first extraction and separate semantic request; not oracle replay",sourceSha:sha,case:id,sourceShaStable:initial.sourceShaStable&&next.sourceShaStable!==false,score:score39(review,id==="independent-model"?"model":cases39.find(c=>c.id===id)?.fault??null),inputHashes:fixtures.map(f=>createHash("sha256").update(f.bytes).digest("hex")),documents:documents.length,classified:documents.filter(d=>d.classificationStatus==="classified").length,initial:documents.map(d=>({present:shippingValues(d).filter(f=>f.original.value!==null).length,verified:shippingValues(d).filter(f=>f.original.status==="verified").length,currentVerified:shippingValues(d).filter(f=>f.current.status==="verified").length,recovery:d.recoverySummary})),outcomes:review.outcomes,semantic:{status:next.semantic?.status??"not_needed",requestedPairs:next.semantic?.requestedPairs??0,usage:next.semantic?.usage,validationCodes:review.primaryChecks?.flatMap(c=>c.semantic?[c.semantic.validationCode]:[])},errors:initial.results.flatMap(r=>r.error?[r.error.code]:[]),budget:next.budget,durationMs:Math.round(performance.now()-start),automaticRetries:0,checks:review.primaryChecks?.map(c=>({meaning:c.comparison?.meaning??c.category,assessment:c.assessment,reasons:c.comparison?.reasonCodes??c.uncertainties}))};
await writeFile(dir+"/"+tag+".json",JSON.stringify(report,null,2));console.log(JSON.stringify({case:id,sourceSha:sha,documents:report.documents,semanticStatus:report.semantic.status,outcomes:report.outcomes,budget:report.budget,automaticRetries:0}));
