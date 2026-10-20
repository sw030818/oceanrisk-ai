// Evaluation truth is NEVER imported here. Only manifest hashes, PDF bytes and
// empty candidate schemas enter the existing Production extraction transport.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {extractPdfText} from '../../src/modules/pdf/extract';
import {emptyShippingWire} from '../../src/modules/shipping/ground';
import {policy39,paid39Extraction,paid39Semantic} from '../lib/phase39-live';
import {reviewShipping} from '../../src/modules/shipping/review';
import type {ShippingType} from '../../src/modules/shipping/catalog';
const arg=(key:string)=>process.argv.find(a=>a.startsWith('--'+key+'='))?.slice(key.length+3);
if(arg('approved-documents')!==String(policy39.documents)||arg('approved-requests')!==String(policy39.requests)||arg('approved-max-cost-usd')!=='2.00')throw Error('Explicit current user approval required; flags alone are not approval');
const sha=arg('sha')??'',stage=arg('stage')??'',id=arg('case')??'',dir='test-results/universal',base=arg('corpus')==='replacement'?'tests/fixtures/universal-replacement/':'tests/fixtures/universal/';
if(!/^[a-f0-9]{40}$/.test(sha)||!['baseline','development','holdout','stress','error','final'].includes(stage)||!/^[-a-zA-Z0-9]+$/.test(id))throw Error('Exact source and safe stage/case required');
const manifest=JSON.parse(await readFile(base+'manifest.json','utf8')) as {case:string;partition:string;file:string;sha256:string;type:ShippingType;parent?:string}[];
const selected=manifest.filter(m=>m.case===id);if(!selected.length)throw Error('Unknown case');
if(selected.some(m=>m.partition==='holdout')&&stage!=='holdout'&&stage!=='final')throw Error('Blind holdout cannot be used for tuning');
if(stage==='holdout'&&arg('code-frozen')!=='true')throw Error('Explicit frozen-code holdout gate required');
await mkdir(dir+'/private',{recursive:true,mode:0o700});const tag=stage+'-'+id+'-'+sha;
try{await readFile(dir+'/private/'+tag+'.json');throw Error('Case already executed; no implicit retry or overwrite');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
const fixtures=[];
for(const m of selected){const bytes=new Uint8Array(await readFile(base+m.file));if(createHash('sha256').update(bytes).digest('hex')!==m.sha256)throw Error('Frozen PDF hash changed');fixtures.push({bytes,pdf:{id:randomUUID(),fileName:'evaluation.pdf',pages:await extractPdfText(bytes,undefined,false,true)},wire:emptyShippingWire(m.type)});}
const start=performance.now(),initial=await paid39Extraction(sha,('universal-'+stage+'-'+id).toLowerCase(),fixtures);
await writeFile(dir+'/private/'+tag+'-initial.json',JSON.stringify(initial),{mode:0o600});
let results=initial.results;
if(stage==='error'){
 const parent=selected[0].parent;if(!parent)throw Error('Error parent missing');
 const cached=JSON.parse(await readFile(dir+'/private/development-'+parent+'-'+sha+'.json','utf8'));
 results=[...cached.initial.results.filter((r:{uploadSlot:string})=>r.uploadSlot!=='house_manifest'),...results];
}
const second=await paid39Semantic(sha,results),docs=results.flatMap(r=>r.document&&!r.error?[r.document]:[]),review=reviewShipping(docs,{semantic:second.semantic});
const output={sourceSha:sha,stage,case:id,initial:{...initial,results},semantic:second.semantic,review,paidDocuments:initial.results.length,reusedParents:stage==='error'?2:0,durationMs:Math.round(performance.now()-start),sourceShaStable:initial.sourceShaStable&&second.sourceShaStable!==false};
await writeFile(dir+'/private/'+tag+'.json',JSON.stringify(output),{mode:0o600});
console.log(JSON.stringify({case:id,stage,sourceSha:sha,classified:docs.filter(d=>d.classificationStatus==='classified').length,documents:docs.length,errors:initial.results.flatMap(r=>r.error?[r.error.code]:[]),outcomes:review.outcomes,actionIssues:review.issues?.length,semantic:second.semantic?.status??'not_needed',budget:second.budget,durationMs:output.durationMs,automaticRetries:0}));
if(initial.results.some(r=>r.error)||!output.sourceShaStable)process.exitCode=1;
