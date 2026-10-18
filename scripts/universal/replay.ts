// FREE re-grounding of recorded first candidates. No provider, no truth import.
import{readFile,readdir,writeFile,mkdir}from'node:fs/promises';
import{groundShipping,emptyShippingWire,itemFieldKeys,cargoFieldKeys}from'../../src/modules/shipping/ground';
import{recoverNative}from'../../src/modules/shipping/recovery';
import{extractPdfText}from'../../src/modules/pdf/extract';
import{reviewShipping}from'../../src/modules/shipping/review';
import{semanticContext}from'../../src/modules/shipping/semantic-context';
import type{Candidate}from'../../src/modules/shipping/ai-schema';
import type{ShippingField}from'../../src/modules/shipping/schema';
import type{ShippingResult}from'../../src/modules/shipping/prepare';
const from=process.argv[3]??'baseline';if(!['baseline','holdout'].includes(from))throw Error('Select immutable saved stage');
const prefix=from==='baseline'?'replay':'replayretired';
const sha=process.argv[2]??'',dir='test-results/universal',manifest=JSON.parse(await readFile('tests/fixtures/universal/manifest.json','utf8'));
const names=(await readdir(dir+'/private')).filter(n=>n.startsWith(from+'-')&&n.endsWith(sha+'.json'));
const candidate=(f?:ShippingField):Candidate=>({value:f?.original.value??null,evidence:f?.original.source?.segments?.length?{page:f.original.source.page,blockIds:f.original.source.segments.map(s=>s.blockId)}:null});
type ReplayWire={type:string;typeEvidence:Candidate['evidence'];fields:Record<string,Candidate>;items:{fields:Record<string,Candidate>}[];cargoRecords:{fields:Record<string,Candidate>}[];containers:{containerNumber:Candidate;sealNumber:Candidate;sealNumbers:Candidate[];packageCount:Candidate;packageUnit:Candidate;grossWeight:Candidate;weightUnit:Candidate}[];references:{kind:string;number:Candidate}[]};
await mkdir(dir+'/replay',{recursive:true,mode:0o700});
for(const name of names){const saved=JSON.parse(await readFile(dir+'/private/'+name,'utf8')),results:ShippingResult[]=[];
 for(const r of saved.initial.results as ShippingResult[]){if(!r.document||r.error){results.push(r);continue;}const d=r.document,m=manifest.find((m:{case:string;type:string})=>m.case===saved.case&&m.type===r.uploadSlot);if(!m)throw Error('Missing baseline source');const bytes=await readFile('tests/fixtures/universal/'+m.file),pdf={...r.pdf,pages:await extractPdfText(new Uint8Array(bytes),undefined,false,true)},w=emptyShippingWire(d.classification!.original.value as 'house_bl') as unknown as ReplayWire;
 w.typeEvidence=candidate(d.classification).evidence;
 for(const[k,f]of Object.entries(d.fields))w.fields[k]=candidate(f);
 for(const e of d.additionalFields)if(e.meaning in w.fields)w.fields[e.meaning]=candidate(e.field);
 w.items=d.items.map(i=>({fields:Object.fromEntries(itemFieldKeys.map(k=>[k,candidate(i.fields[k])]))}));
 w.cargoRecords=d.cargoRecords.map(i=>({fields:Object.fromEntries(cargoFieldKeys.map(k=>[k,candidate(i.fields[k])]))}));
 w.containers=d.containers.map(c=>({containerNumber:candidate(c.containerNumber),sealNumber:candidate(c.sealNumber),sealNumbers:(c.sealNumbers??[]).map(candidate),packageCount:candidate(c.packageCount),packageUnit:candidate(c.packageUnit),grossWeight:candidate(c.grossWeight),weightUnit:candidate(c.weightUnit)}));
 w.references=d.references.map(ref=>({kind:ref.kind,number:candidate(ref.number)}));
 results.push({...r,pdf,document:recoverNative(groundShipping(w,pdf,r.uploadSlot),pdf)});
 }
 const documents=results.flatMap(r=>r.document?[r.document]:[]),context=semanticContext(documents),semantic=saved.semantic?{...saved.semantic,inputKey:context.key}:undefined,review=reviewShipping(documents,{semantic});
 const out={...saved,stage:prefix,kind:'FREE original candidate re-grounding + cached semantic opinion, NOT new extraction',initial:{...saved.initial,results},semantic,review};await writeFile(dir+'/replay/'+name.replace(from+'-',prefix+'-'),JSON.stringify(out),{mode:0o600});console.log(JSON.stringify({case:saved.case,before:saved.review.outcomes,after:review.outcomes,beforeIssues:saved.review.issues?.length,afterIssues:review.issues?.length}));
}
