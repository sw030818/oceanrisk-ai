// Production corpus transport. Manifest/PDF only; scoring truth is never imported.
import{readFile,writeFile,mkdir}from'node:fs/promises';
import{createHash,randomUUID}from'node:crypto';
import{extractPdfText}from'../../src/modules/pdf/extract';
import{emptyShippingWire}from'../../src/modules/shipping/ground';
import{policy39,paid39Extraction,paid39Semantic}from'../lib/phase39-live';
import{reviewShipping}from'../../src/modules/shipping/review';
import type{ShippingType}from'../../src/modules/shipping/catalog';
const arg=(k:string)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3);
const sha=arg('sha')??'';
if(arg('code-frozen')!=='true'||!/^[a-f0-9]{40}$/.test(sha)||arg('approved-documents')!==String(policy39.documents)||arg('approved-requests')!==String(policy39.requests)||arg('approved-max-cost-usd')!==policy39.cost.toFixed(2))throw Error('Exact approved evaluation required');
const corpus=arg('corpus')??'universal-complex',id=arg('case')??'complex-13',attempt=arg('attempt')??'';
if(!/^[a-z0-9-]+$/.test(corpus)||!/^[-a-z0-9]+$/.test(id)||attempt&&!/^[-a-z0-9]+$/.test(attempt))throw Error('Safe corpus/case/attempt required');
const base='tests/fixtures/'+corpus+'/',dir='test-results/universal/private',path=dir+'/'+id+'-'+sha+(attempt?'-'+attempt:'')+'.json';
try{await readFile(path);throw Error('No implicit repeat');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
const manifest=(JSON.parse(await readFile(base+'manifest.json','utf8'))as{case?:string;file:string;sha256:string;type:ShippingType}[]).filter(m=>!m.case||m.case===id),fixtures=[];if(!manifest.length)throw Error('Unknown case');
for(const m of manifest){const bytes=new Uint8Array(await readFile(base+m.file));if(createHash('sha256').update(bytes).digest('hex')!==m.sha256)throw Error('Frozen stress bytes changed');fixtures.push({bytes,pdf:{id:randomUUID(),fileName:'synthetic-stress.pdf',pages:await extractPdfText(bytes,undefined,false,true)},wire:emptyShippingWire(m.type)});}
await mkdir(dir,{recursive:true,mode:0o700});const start=performance.now(),initial=await paid39Extraction(sha,'consistency-'+id,fixtures);
await writeFile(path.replace('.json','-initial.json'),JSON.stringify(initial),{mode:0o600});
const second=await paid39Semantic(sha,initial.results),review=reviewShipping(initial.results.flatMap(r=>r.document&&!r.error?[r.document]:[]),{semantic:second.semantic});
const output={sourceSha:sha,case:id,corpus,attempt,kind:'ACTUAL synthetic corpus; development/holdout partition recorded separately',initial,semantic:second.semantic,review,budget:second.budget,durationMs:Math.round(performance.now()-start),sourceShaStable:initial.sourceShaStable&&second.sourceShaStable!==false};
await writeFile(path,JSON.stringify(output),{mode:0o600});console.log(JSON.stringify({...output,initial:undefined,semantic:second.semantic?.status,review:review.outcomes}));
if(initial.results.length!==fixtures.length||initial.results.some(r=>r.error)||!output.sourceShaStable)process.exitCode=1;
