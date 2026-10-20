import{beforeAll,it,expect,vi}from'vitest';
import{consistencyFixture}from'../fixtures/consistency';
import{semanticContext}from'../../src/modules/shipping/semantic-context';
import{semanticIdAliases,semanticFormat,expandSemanticIds,semanticPayload}from'../../src/modules/shipping/semantic-request';
import{analyzeSemantics}from'../../src/modules/shipping/semantic-analysis';
import{validateSemanticDecision}from'../../src/modules/shipping/semantic-validation';
import{reviewShipping}from'../../src/modules/shipping/review';
import{unicodePdf}from'../fixtures/shipping31';
import{extractPdfText}from'../../src/modules/pdf/extract';
import{verifyClassification}from'../../src/modules/shipping/verify';
let f:Awaited<ReturnType<typeof consistencyFixture>>;beforeAll(async()=>{f=await consistencyFixture();},20000);
it('uses short exact provider enums and expands every evidence/claim ID by lookup only',()=>{
 const c=semanticContext(f.docs),aliases=semanticIdAliases(c),raw=structuredClone(f.report.decisions),reverse=new Map(Object.entries(aliases).map(([a,id])=>[id,a]));
 for(const p of raw.pairs){p.leftId=reverse.get(p.leftId)!;p.rightId=reverse.get(p.rightId)!;p.left.fieldId=p.leftId;p.right.fieldId=p.rightId;}
 const format=semanticFormat(c),schema=JSON.stringify(format.schema());expect(Object.keys(aliases).every(k=>/^F\d+$/.test(k))).toBe(true);expect(schema).toContain('"enum":["F1"');
 expect(expandSemanticIds(raw,aliases)).toEqual(f.report.decisions);
 raw.pairs[0].left.fieldId='F999';const expanded=expandSemanticIds(raw,aliases);expect(expanded.pairs[0].left.fieldId).toBe('F999');expect(validateSemanticDecision(expanded.pairs[0],c.pairs[0]).code).toBe('INVALID_SEMANTIC_EVIDENCE');
});
it('retains provider aliases before expansion without another request or mutating document values',async()=>{
 const before=JSON.stringify(f.docs),fetcher=vi.fn(async(_url:unknown,o?:RequestInit)=>{
  const request=JSON.parse(String(o?.body)),payload=JSON.parse(request.input.find((item:{role:string})=>item.role==='user').content[0].text).untrustedVerifiedSources as ReturnType<typeof semanticPayload>;
  expect(payload.products.every(p=>/^F\d+$/.test(p.fieldId))).toBe(true);
  const products=new Map(payload.products.map(p=>[p.fieldId,p])),pairs=payload.requestedPairs.map(p=>{const a=products.get(p.leftId)as {descriptions:{value:string;blockIds:string[]}[]},b=products.get(p.rightId)as typeof a;return{leftId:p.leftId,rightId:p.rightId,relation:'compatible_incomplete',left:{fieldId:p.leftId,quote:a.descriptions[0].value,blockIds:a.descriptions[0].blockIds},right:{fieldId:p.rightId,quote:b.descriptions[0].value,blockIds:b.descriptions[0].blockIds},claims:[],explanation:'MOCK transport only'};});
  return new Response(JSON.stringify({status:'completed',model:'gpt-6-luna',output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify({pairs})}]}],usage:{input_tokens:100,output_tokens:100}}));
 });
 const r=await analyzeSemantics(f.docs,{apiKey:'mock-test-key',fetcher});expect(fetcher).toHaveBeenCalledOnce();expect(r.error).toBeUndefined();expect(r.providerTransport?.decisions.pairs[0].leftId).toMatch(/^F\d+$/);expect(r.decisions.pairs[0].leftId).not.toMatch(/^F\d+$/);expect(JSON.stringify(f.docs)).toBe(before);
});
it('keeps a failed redundant AI pair visible while using an independently proved alternate owner path',()=>{
 const s=structuredClone(f.report),pair=s.decisions.pairs.find(p=>p.leftId.startsWith('cx-mf')||p.rightId.startsWith('cx-mf'))!;pair.leftId='wrong-uuid';s.status='partial';
 const r=reviewShipping(f.docs,{semantic:s});expect(r.issues).toHaveLength(0);expect(r.primaryChecks!.some(c=>c.semantic?.validationCode==='VERIFIED_ALTERNATE_OWNER_PATH'&&c.assessment==='not_applicable')).toBe(true);expect(r.semantic?.decisions.pairs.some(p=>p.leftId==='wrong-uuid')).toBe(true);
});
it.each([
 ['수출신고필증 / EXPORT DECLARATION CERTIFICATE','export_declaration',true],
 ['HOUSE MANIFEST | HOUSE CARGO MANIFEST','house_manifest',true],
 ['수출신고필증 / HOUSE MANIFEST','export_declaration',false],
 ['EXPORT DECLARATION / ACCOUNT STATEMENT','export_declaration',false],
 ['Reference to EXPORT DECLARATION CERTIFICATE','export_declaration',false],
]as const)('independently checks whole bilingual native headings: %s',async(title,type,valid)=>{
 const bytes=unicodePdf([[{text:title,x:30,y:25,size:15}]]),pdf={id:'title',fileName:'synthetic.pdf',pages:await extractPdfText(bytes,undefined,false,true)};
 const field=verifyClassification(type,{page:1,blockIds:pdf.pages[0].blocks!.map(b=>b.id)},pdf);expect(field.current.status==='verified').toBe(valid);
});
it.each(['수출신고필증 / HOUSE MANIFEST','HOUSE B/L / MASTER B/L'])('a second valid page cannot erase a conflicting bilingual heading: %s',async mixed=>{
 const type=mixed.includes('MASTER')?'house_bl':'export_declaration',clean=type==='house_bl'?'HOUSE BILL OF LADING':'EXPORT DECLARATION';
 const bytes=unicodePdf([[{text:mixed,x:30,y:25,size:15}],[{text:clean,x:30,y:25,size:15}]]),pdf={id:'mixed',fileName:'synthetic.pdf',pages:await extractPdfText(bytes,undefined,false,true)};
 expect(verifyClassification(type,{page:2,blockIds:pdf.pages[1].blocks!.map(b=>b.id)},pdf).current.status).toBe('unverified');
});
