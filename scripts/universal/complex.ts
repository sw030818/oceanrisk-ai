// New synthetic stress, not tuning and never imported by application code.
import{readFile,writeFile,mkdir}from'node:fs/promises';
import{createHash,randomUUID}from'node:crypto';
import{extractPdfText}from'../../src/modules/pdf/extract';
import{emptyShippingWire}from'../../src/modules/shipping/ground';
import{paid39Extraction,paid39Semantic}from'../lib/phase39-live';
import{reviewShipping}from'../../src/modules/shipping/review';
import type{ShippingType}from'../../src/modules/shipping/catalog';
const arg=(k:string)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3);
const sha=arg('sha')??'';
if(!/^[a-f0-9]{40}$/.test(sha)||arg('approved-documents')!=='150'||arg('approved-requests')!=='220'||arg('approved-max-cost-usd')!=='2.00')throw Error('Exact approved evaluation required');
const base='tests/fixtures/universal-complex/',dir='test-results/universal/private',path=dir+'/complex-13-'+sha+'.json';
try{await readFile(path);throw Error('No implicit repeat');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
const manifest=JSON.parse(await readFile(base+'manifest.json','utf8'))as{file:string;sha256:string;type:ShippingType}[],fixtures=[];
for(const m of manifest){const bytes=new Uint8Array(await readFile(base+m.file));if(createHash('sha256').update(bytes).digest('hex')!==m.sha256)throw Error('Frozen stress bytes changed');fixtures.push({bytes,pdf:{id:randomUUID(),fileName:'synthetic-stress.pdf',pages:await extractPdfText(bytes,undefined,false,true)},wire:emptyShippingWire(m.type)});}
await mkdir(dir,{recursive:true,mode:0o700});const start=performance.now(),initial=await paid39Extraction(sha,'universal-complex-13',fixtures);
await writeFile(path.replace('.json','-initial.json'),JSON.stringify(initial),{mode:0o600});
const second=await paid39Semantic(sha,initial.results),review=reviewShipping(initial.results.flatMap(r=>r.document&&!r.error?[r.document]:[]),{semantic:second.semantic});
const output={sourceSha:sha,case:'complex-13',kind:'ACTUAL independent synthetic complex stress',initial,semantic:second.semantic,review,budget:second.budget,durationMs:Math.round(performance.now()-start),sourceShaStable:initial.sourceShaStable&&second.sourceShaStable!==false};
await writeFile(path,JSON.stringify(output),{mode:0o600});console.log(JSON.stringify({...output,initial:undefined,semantic:second.semantic?.status,review:review.outcomes}));
if(initial.results.some(r=>r.error)||!output.sourceShaStable)process.exitCode=1;
