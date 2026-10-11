// Explicit authorized Production tests: synthetic PDFs only, no local key extraction.
import { mkdir,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { layoutCases,layoutFixture } from '../tests/fixtures/layouts';
import { evaluateLayoutResults } from './lib/layout-evaluation';
import { assertProduction } from './lib/release-policy';
import type { AnalysisResult } from '../src/modules/documents/schema';
const args=process.argv.slice(2),sha=args.find(a=>a.startsWith('--sha='))?.slice(6),repeat=Number(args.find(a=>a.startsWith('--repeat='))?.slice(9)??1);
if(!sha||!Number.isInteger(repeat)||repeat<1||repeat>2)throw new Error('Use --sha=<deployed SHA> and optional --repeat=2');
const origin='https://oceanrisk-ai.vercel.app';
const status=await fetch(origin+'/api/status',{signal:AbortSignal.timeout(10000),cache:'no-store'});
if(!status.ok)throw new Error('Production status unavailable');
const deployment=assertProduction(await status.json(),sha);
await mkdir('test-results/live-layouts',{recursive:true});
const cases=[];let quotaStopped=false;
for(const scenario of layoutCases) {
  const fixtures=await Promise.all([layoutFixture(scenario.id,'invoice'),layoutFixture(scenario.id,'packing_list')]);
  const budget=evaluateLayoutResults([],fixtures.map(f=>f.data),scenario.id).expectedFields;
  for(let attempt=1;attempt<=(scenario.id===layoutCases[0].id?repeat:1);attempt++) {
    if(quotaStopped){cases.push({id:scenario.id,attempt,expectedFields:budget,status:'not_run',reason:'PROVIDER_QUOTA_STOP'});continue;}
    const form=new FormData();fixtures.forEach(f=>form.append('files',f.makeFile()));form.append('slots','["invoice","packing_list"]');
    console.log(`Actual synthetic layout ${scenario.id}, attempt ${attempt}: two PDFs`);
    try {
      const response=await fetch(origin+'/api/analyze',{method:'POST',body:form,signal:AbortSignal.timeout(110000)});
      const payload=await response.json().catch(()=>null);
      if(!response.ok||!Array.isArray(payload?.results)||payload.results.length!==2) {cases.push({id:scenario.id,attempt,expectedFields:budget,status:'failed',reason:'INVALID_SERVER_RESPONSE',httpStatus:response.status});continue;}
      const results=payload.results as AnalysisResult[];
      if(results.some(r=>r.error?.code==='API_RATE_LIMIT'))quotaStopped=true;
      const evaluation=evaluateLayoutResults(results,fixtures.map(f=>f.data),scenario.id);
      const signature=createHash('sha256').update(JSON.stringify({states:evaluation.fieldStates,rules:evaluation.ruleStates,values:results.map(r=>r.document?{type:r.document.type,seller:r.document.seller.value,buyer:r.document.buyer.value,items:r.document.items.map(i=>[i.description.value,i.quantity.value,i.unit.value]),reference:r.document.transactionReference.value}:null)})).digest('hex');
      cases.push({id:scenario.id,attempt,status:evaluation.passed?'passed':'failed',...evaluation,signature,models:results.map(r=>r.aiModel??null)});
      console.log(JSON.stringify({id:scenario.id,attempt,passed:evaluation.passed,providerSuccesses:evaluation.providerSuccesses,grounded: evaluation.groundedCorrectFields,expected: evaluation.expectedFields,ruleCorrect:evaluation.ruleCorrect,errorCodes:evaluation.errorCodes,fieldStates:evaluation.fieldStates}));
    }catch{cases.push({id:scenario.id,attempt,expectedFields:budget,status:'failed',reason:'PRODUCTION_ANALYSIS_UNAVAILABLE'});}
  }
}
const evaluations=cases.filter((c):c is Extract<typeof c,{providerSuccesses:number}>=>'providerSuccesses'in c);
const repeated=cases.filter(c=>c.id===layoutCases[0].id && 'signature'in c);
const report={mode:'actual-gemini-synthetic-layouts',deployment,cases,completed:cases.every(c=>c.status==='passed'),attemptedPairs:cases.filter(c=>c.status!=='not_run').length,
  providerSuccesses:evaluations.reduce((n,c)=>n+c.providerSuccesses,0),expectedDocuments:cases.filter(c=>c.status!=='not_run').length*2,plannedDocuments:cases.length*2,
  groundedCorrectFields:evaluations.reduce((n,c)=>n+c.groundedCorrectFields,0),expectedFields:cases.filter(c=>c.status!=='not_run').reduce((n,c)=>n+c.expectedFields,0),correctRuleCases:evaluations.filter(c=>c.ruleCorrect).length,
  repeatConsistent:repeated.length===2&&repeated.every(c=>'providerSuccesses'in c&&c.providerSuccesses===2)?('signature'in repeated[0]&&'signature'in repeated[1]&&repeated[0].signature===repeated[1].signature):null};
await writeFile('test-results/live-layouts/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({completed:report.completed,attemptedPairs:report.attemptedPairs,providerSuccesses:report.providerSuccesses,expectedDocuments:report.expectedDocuments,groundedCorrectFields:report.groundedCorrectFields,expectedFields:report.expectedFields,correctRuleCases:report.correctRuleCases,repeatConsistent:report.repeatConsistent}));
process.exitCode=report.completed?0:1;
