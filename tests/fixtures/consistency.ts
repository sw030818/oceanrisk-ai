import {fixture35, type Row35} from './shipping35';
import {recoverNative} from '../../src/modules/shipping/recovery';
import {semanticContext} from '../../src/modules/shipping/semantic-context';
import type {SemanticReport} from '../../src/modules/shipping/semantic-schema';
export async function consistencyFixture(options: {
 quantity?: number; quantityB?: number; missingReference?: boolean;
 foreignHbl?: boolean; manifestHs?: string; manifestTotal?: number;
 model?: string; seal?: string; duplicateSeal?:string; partial?: boolean; duplicate?: boolean;
 noModel?: boolean; thirdDeclaration?: boolean;
} = {}) {
 const en=['OPTICAL WAVEGUIDE MODEL WG42','TORQUE LIMITER MODEL TL17','KINETIC BRAKE MODEL KB62'];
 const ko=['광도파관 MODEL '+(options.model??'WG42'),'토크 리미터 MODEL TL17','동적 브레이크 MODEL KB62'];
 const hs=['9001.90','8483.60','8483.90'],quantities=[600,400,200];
 if(options.noModel)for(let i=0;i<en.length;i++) {en[i]=en[i].replace(/ MODEL \w+$/,'');ko[i]=ko[i].replace(/ MODEL \w+$/,'');}
 const row=(i:number,korean=false):Row35=>({name:(korean?ko:en)[i],hs:hs[i],qty:korean?(i===0?options.quantity??600:i===1?options.quantityB??400:200):quantities[i],unit:korean?'EA':'PCS'});
 const cs=[{name:'allocated',cn:'ABCU1234567',seal:'SEAL42',packages:30,gross:300},{name:'allocated',cn:'DEFU7654321',seal:'SEAL17',packages:20,gross:200},{name:'allocated',cn:'GHIU2468135',seal:'SEAL62',packages:10,gross:200}];
 const count=options.thirdDeclaration?3:2,all=Array.from({length:count},(_,i)=>i);
 const common={hbl:'SYN-CONSISTENCY-2042',scope:'full shipment'};
 const refs=all.map(i=>'DECL-C-2042-'+String.fromCharCode(65+i));
 const totals={quantity:all.reduce((n,i)=>n+quantities[i],0),packageCount:all.reduce((n,i)=>n+cs[i].packages,0),grossWeight:all.reduce((n,i)=>n+cs[i].gross,0)};
 const specs=[fixture35('house_bl',{...common,id:'cx-bl',totals,declarationRefs:[(options.missingReference?refs.slice(0,-1):refs).join(', ')],rows:all.map(i=>row(i)),containers:cs.slice(0,count)})];
 for(const i of all)specs.push(fixture35('export_declaration',{
  ...common,hbl:options.foreignHbl&&i===0?'OTHER-SHIPMENT-999':common.hbl,id:'cx-d'+String.fromCharCode(97+i),
  totals:{quantity:row(i,true).qty,packageCount:cs[i].packages,grossWeight:cs[i].gross},declaration:refs[i],scope:options.partial&&i===0?'partial shipment':common.scope,rows:[row(i,true)],containers:[cs[i]],
 }));
 specs.push(fixture35('house_manifest',{...common,id:'cx-mf',totals:{...totals,quantity:options.manifestTotal??totals.quantity},declarationRefs:[refs.join(', ')],rows:all.map(i=>({...row(i),hs:i===0?options.manifestHs??hs[0]:hs[i]})),containers:cs.slice(0,count).map((c,i)=>({...c,seal:i===0?options.seal??c.seal:c.seal}))}));
 if(options.duplicate)specs.push(fixture35('export_declaration',{...common,id:'cx-duplicate',totals:{quantity:row(0,true).qty,packageCount:cs[0].packages,grossWeight:cs[0].gross},declaration:refs[0],rows:[row(0,true)],containers:[{...cs[0],seal:options.duplicateSeal??cs[0].seal}]}));
 const fixtures=await Promise.all(specs),docs=fixtures.map(f=>recoverNative(f.document,f.pdf)),context=semanticContext(docs);
 const family=(value:unknown)=>en.findIndex((v,i)=>String(value).includes(v.split(' MODEL')[0])||String(value).includes(ko[i].split(' MODEL')[0]));
 const report:SemanticReport={status:'complete',inputKey:context.key,requestedPairs:context.pairs.length,omittedPairs:0,model:'MOCK-never-provider',decisions:{pairs:context.pairs.map(p=>({
  leftId:p.left.id,rightId:p.right.id,relation:family(p.left.ref.field.current.value)===family(p.right.ref.field.current.value)?'same_product':'different_product',
  left:{fieldId:p.left.id,quote:String(p.left.ref.field.current.value),blockIds:p.left.descriptions[0].blockIds},right:{fieldId:p.right.id,quote:String(p.right.ref.field.current.value),blockIds:p.right.descriptions[0].blockIds},claims:[],explanation:'MOCK language test; independent native attributes and scope must still be checked.',
 }))}};
 return {fixtures,docs,report};
}
