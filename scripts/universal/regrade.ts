/* eslint-disable @typescript-eslint/no-explicit-any -- stored provider results are untyped JSON */
// Free regrade of stored REAL AI answers (private test-results files): rebuild each
// answer from its stored originals (value + cited blocks), ground it again with
// the engine at <root>, and list every original verification status that
// changed. Run before shipping engine changes. Prints no document text beyond
// the changed values; private inputs are never written.
// Usage: npx tsx scripts/universal/regrade.ts <engine-root> <dir-with-result-json>...
import {readFileSync,readdirSync} from 'node:fs';
const root=process.argv[2], dirs=process.argv.slice(3);
const {emptyShippingWire,groundShipping}=await import(root+'/src/modules/shipping/ground');
const {itemFieldKeys,cargoFieldKeys}=await import(root+'/src/modules/shipping/ai-schema');
const cand=(f:any)=>{const o=f?.original;return {value:o?.value??null,evidence:o?.source?.segments?.length?{page:o.source.page,blockIds:o.source.segments.map((s:any)=>s.blockId)}:null};};
// Recovery-created native-* rows are not AI answers and are skipped.
const changes:Record<string,number>={};let fields=0,files=0;const examples:string[]=[];
for(const dir of dirs)for(const name of readdirSync(dir)){
 if(!name.endsWith('.json')||name.endsWith('-initial.json')||name.includes('ledger'))continue;
 let d:any;try{d=JSON.parse(readFileSync(dir+'/'+name,'utf8'));}catch{continue;}
 const results=d.initial?.results;if(!results)continue;files++;
 for(const r of results){const doc=r.document;if(!doc||!r.pdf?.pages)continue;
  const w:any=emptyShippingWire(doc.uploadType);w.type=doc.classification?.original?.value??doc.uploadType;w.typeEvidence=cand(doc.classification).evidence;
  for(const k of Object.keys(w.fields)){if(doc.fields[k])w.fields[k]=cand(doc.fields[k]);}
  for(const a of doc.additionalFields??[])if(w.fields[a.meaning])w.fields[a.meaning]=cand(a.field);
  w.items=doc.items.map((i:any)=>({fields:Object.fromEntries(itemFieldKeys.map((k:string)=>[k,cand(i.fields[k])]))}));
  w.cargoRecords=(doc.cargoRecords??[]).map((i:any)=>({fields:Object.fromEntries(cargoFieldKeys.map((k:string)=>[k,cand(i.fields[k])]))}));
  w.containers=doc.containers.map((c:any)=>({containerNumber:cand(c.containerNumber),sealNumber:cand(c.sealNumber),sealNumbers:(c.sealNumbers??[]).map(cand),packageCount:cand(c.packageCount),packageUnit:cand(c.packageUnit),grossWeight:cand(c.grossWeight),weightUnit:cand(c.weightUnit)}));
  w.references=(doc.references??[]).map((x:any)=>({kind:x.kind,number:cand(x.number)}));
  let nd:any;try{nd=groundShipping(w,r.pdf,doc.uploadType);}catch(e){changes['ERR '+(e as Error).message.slice(0,60)]=(changes['ERR '+(e as Error).message.slice(0,60)]??0)+1;continue;}
  const pairs=(a:any,b:any,p:string)=>{fields++;const o=a?.original?.status,n=b?.original?.status;if(o!==n){const k=`${doc.uploadType} ${p.replace(/item-\d+|cargo-\d+|container-\d+/,'X')} ${o}->${n} ${b?.original?.verificationCode??''}`;changes[k]=(changes[k]??0)+1;if(examples.length<40)examples.push(name.slice(0,40)+' '+k+' '+JSON.stringify(a?.original?.value).slice(0,60));}};
  for(const k of Object.keys(doc.fields))pairs(doc.fields[k],nd.fields[k],'doc.'+k);
  for(const i of doc.items.filter((x:any)=>!String(x.id).startsWith('native'))){const ni=nd.items.find((x:any)=>x.id===i.id);for(const k of Object.keys(i.fields))pairs(i.fields[k],ni?.fields[k],i.id+'.'+k);}
  for(const i of (doc.cargoRecords??[]).filter((x:any)=>!String(x.id).startsWith('native'))){const ni=nd.cargoRecords.find((x:any)=>x.id===i.id);for(const k of Object.keys(i.fields))pairs(i.fields[k],ni?.fields[k],i.id+'.'+k);}
  for(const c of doc.containers){const nc=nd.containers.find((x:any)=>x.id===c.id);for(const k of ['containerNumber','sealNumber','packageCount','packageUnit','grossWeight','weightUnit'])pairs(c[k],nc?.[k],c.id+'.'+k);}
 }}
console.log(JSON.stringify({files,fields,changes},null,1));console.log(examples.join('\n'));
