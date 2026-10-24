import{it,expect}from"vitest";
import{policy39,reserve39,semanticBudgetStopped39}from"../../scripts/lib/phase39-live";
import{reconcileTestBudget}from"../../scripts/lib/openai-budget";
const fresh=()=>({documents:0,requests:0,measuredCostUsd:0,unresolvedCostUpperUsd:0,maxDocuments:3000,maxRequests:4500,maxCostUsd:3.5});
const old2=()=>({...fresh(),maxDocuments:1000,maxRequests:1500,maxCostUsd:2});
it("keeps a new proposed ledger and reserves semantic requests without inventing document attempts",()=>{expect(policy39.directory).toBe("test-results/live-phase39");const b=fresh();reserve39(b,.01,3,3);reserve39(b,.02,0,1);expect(b.documents).toBe(3);expect(b.requests).toBe(4);expect(b.unresolvedCostUpperUsd).toBeCloseTo(.03);});
it.each(["documents","requests","cost"])("stops before exhausted %s with no partial mutation",mode=>{const b=fresh();if(mode==="documents")b.documents=3000;if(mode==="requests")b.requests=4500;if(mode==="cost")b.measuredCostUsd=3.49;const before=structuredClone(b);expect(()=>reserve39(b,.02,1,1)).toThrow();expect(b).toEqual(before);});
it("preserves unknown timeout charges and earlier SHA usage",()=>{const b=fresh();reserve39(b,3.3,2,2);reconcileTestBudget(b,3.3,null);expect(()=>reserve39(b,.3,0,1)).toThrow();expect(b.documents).toBe(2);expect(b.requests).toBe(2);reconcileTestBudget(b,3.3,.01);reserve39(b,.3,0,1);expect(b.documents).toBe(2);expect(b.requests).toBe(3);});

it("does not spend a second request after an extraction quota/auth stop",()=>{for(const code of ["API_AUTH_OR_CONFIG","API_RATE_LIMIT","INVALID_MODEL","API_NOT_CONFIGURED","BATCH_STOPPED"])expect(semanticBudgetStopped39([{error:{code}}] as never)).toBe(true);expect(semanticBudgetStopped39([{error:{code:"PDF_UNREADABLE"}}] as never)).toBe(false);});
it("corrects the obsolete ten-dollar proposal without resetting paid or unknown usage",async()=>{const{correctTrialCostProposal}=await import("../../scripts/lib/trial-live");const before={...fresh(),maxCostUsd:10,documents:9,requests:12,measuredCostUsd:.13,unresolvedCostUpperUsd:.04};expect(correctTrialCostProposal(policy39,before)).toEqual({...before,maxCostUsd:3.5});expect(before.maxCostUsd).toBe(10);expect(correctTrialCostProposal({...policy39,cost:20},before)).toEqual(before);});

it("migrates only explicitly approved old caps without clearing a single attempt or charge",async()=>{
 const {migrateApprovedTrialCaps}=await import("../../scripts/lib/trial-live");
 const old={...old2(),maxDocuments:60,maxRequests:120,documents:59,requests:86,measuredCostUsd:.096102395,unresolvedCostUpperUsd:.01262635};
 expect(migrateApprovedTrialCaps(policy39,old)).toEqual({...old,maxDocuments:3000,maxRequests:4500,maxCostUsd:3.5});
 expect(migrateApprovedTrialCaps({...policy39,previousApprovedCaps:undefined},old)).toEqual(old);
 expect(migrateApprovedTrialCaps(policy39,{...old,maxCostUsd:10}).maxCostUsd).toBe(10);
});

it("preserves all cumulative charges when expanding the approved 150/220 predecessor",async()=>{const{migrateApprovedTrialCaps}=await import("../../scripts/lib/trial-live");const old={...old2(),maxDocuments:150,maxRequests:220,documents:150,requests:210,measuredCostUsd:.2262348,unresolvedCostUpperUsd:.0254659625};expect(migrateApprovedTrialCaps(policy39,old)).toEqual({...old,maxDocuments:3000,maxRequests:4500,maxCostUsd:3.5});});
it("expands the approved USD2 1000/1500 ledger to USD3.5 keeping every attempt and unknown charge, and ignores unapproved caps",async()=>{const{migrateApprovedTrialCaps}=await import("../../scripts/lib/trial-live");const cur={...old2(),documents:712,requests:958,measuredCostUsd:.9703890350000013,unresolvedCostUpperUsd:.12285267500000051};expect(migrateApprovedTrialCaps(policy39,cur)).toEqual({...cur,maxDocuments:3000,maxRequests:4500,maxCostUsd:3.5});const odd={...cur,maxCostUsd:2.5};expect(migrateApprovedTrialCaps(policy39,odd)).toEqual(odd);});
