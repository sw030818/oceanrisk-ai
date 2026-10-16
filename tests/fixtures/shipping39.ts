import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import manifest from "./phase39/manifest.json";
import cases from "./phase39/cases.json";
import {extractPdfText} from "../../src/modules/pdf/extract";
import type {ShippingType} from "../../src/modules/shipping/catalog";
export {cases as cases39};
export async function shipping39Fixture(id:string,type:ShippingType) {
  const meta=manifest.find(m=>m.case===id&&m.type===type);if(!meta)throw Error("Unknown public synthetic fixture");
  const bytes=new Uint8Array(await readFile(new URL("./phase39/generated/"+meta.file,import.meta.url)));
  if(createHash("sha256").update(bytes).digest("hex")!==meta.sha256)throw Error("Synthetic fixture checksum changed");
  return {bytes,pdf:{id:"reportlab39-"+id+"-"+type,fileName:meta.file,pages:await extractPdfText(bytes,undefined,false,true)},type};
}

// Evaluation-only correct candidate adapter. Never imported by app/OpenAI code.
export async function oracle39(id:string,type:ShippingType) {
  const {emptyShippingWire,itemFieldKeys,cargoFieldKeys,groundShipping}=await import("../../src/modules/shipping/ground");
  const {verifyShippingField}=await import("../../src/modules/shipping/verify");
  const {physicalLines}=await import("../../src/modules/layout/physical-spans");
  const f=await shipping39Fixture(id,type),p=f.pdf.pages[0],c=cases.find(c=>c.id===id)!,ci=cases.indexOf(c),fault=type==="house_manifest"?c.fault:undefined;
  const w=emptyShippingWire(type),blocks=p.blocks!,spans=[...blocks.map(b=>[b]),...physicalLines(p)];
  const find=<T extends string|number>(value:T,role:string,scope:"document"|"item"|"container"|"cargo"="document",owner?:NonNullable<NonNullable<import("../../src/modules/shipping/schema").ShippingField["current"]["source"]>["layout"]>)=>{
    for(const bs of spans){if(bs.length>12)continue;const candidate={value,evidence:{page:1,blockIds:bs.map(b=>b.id)}};if(verifyShippingField(candidate,f.pdf,role,scope,owner).current.status==="verified")return candidate;}
    return{value:null,evidence:null};
  };
  const hbl=fault==="houseBlNumber"?`SYN39-OTHER-${String(ci+1).padStart(3,"0")}`:`SYN39-HB-${String(ci+1).padStart(3,"0")}`,
    cn=fault==="containerNumber"?"SYN-U3901002":"SYN-U3901001",sn=fault==="sealNumber"?"SYN-SEAL-3902":"SYN-SEAL-3901",qty=fault==="quantity"?99:100,pkg=fault==="packageCount"?11:10,weight=fault==="grossWeight"?81:80;
  const title=blocks.find(b=>b.text===(type==="house_bl"?"HOUSE BILL OF LADING":type==="house_manifest"?"HOUSE MANIFEST":"수출신고필증"))!;w.typeEvidence={page:1,blockIds:[title.id]};
  for(const[role,value]of Object.entries({houseBlNumber:hbl,declarationNumber:`SYN39-D-${String(ci+1).padStart(3,"0")}`,shipper:"Synthetic Seller 39",consignee:"Synthetic Buyer 39",portOfLoading:"BUSAN",portOfDischarge:"ROTTERDAM",shipmentScope:"full shipment",quantity:qty*(c.second?2:1),quantityUnit:"PCS",packageCount:pkg,packageUnit:"CARTONS",grossWeight:weight,grossWeightUnit:"KG"}))(w.fields as Record<string,import("../../src/modules/shipping/ai-schema").Candidate>)[role]=find(value,role);
  const rows=[{en:type==="house_manifest"?(c.manifest??c.en):c.en,ko:c.ko,hs:fault==="hsCode"?"3924.10-0000":c.hs},...(c.second?[c.second]:[])];
  for(const row of rows){const scope=type==="house_manifest"?"cargo":"item",fields=Object.fromEntries((scope==="item"?itemFieldKeys:cargoFieldKeys).map(k=>[k,{value:null,evidence:null}])) as Record<string,import("../../src/modules/shipping/ai-schema").Candidate>;
    const goods=type==="export_declaration"?row.ko:row.en;
    fields.goodsDescription=find(goods,"goodsDescription",scope);
    const owner=verifyShippingField(fields.goodsDescription,f.pdf,"goodsDescription",scope).current.source?.layout;
    if(scope==="cargo")fields.houseBlNumber=find(hbl,"houseBlNumber",scope,owner);
    for(const[role,value]of Object.entries({hsCode:row.hs,quantity:qty,quantityUnit:type==="house_manifest"?"PCS":"EA",packageCount:pkg,packageUnit:"CTN",grossWeight:weight,grossWeightUnit:"KG",containerNumber:cn,sealNumber:sn}))if(role in fields)fields[role]=find(value,role,scope,owner);
    if(scope==="item")w.items.push({fields:fields as import("../../src/modules/shipping/ai-schema").ShippingWire["items"][number]["fields"]});else w.cargoRecords.push({fields:fields as import("../../src/modules/shipping/ai-schema").ShippingWire["cargoRecords"][number]["fields"]});
  }
  const anchor=find(cn,"containerNumber","container"),owner=verifyShippingField(anchor,f.pdf,"containerNumber","container").current.source?.layout;
  if(anchor.value!==null)w.containers=[{containerNumber:anchor,sealNumber:find(sn,"sealNumber","container",owner),sealNumbers:[find(sn,"sealNumber","container",owner)],packageCount:find(pkg,"packageCount","container",owner),packageUnit:find("CTN","packageUnit","container",owner),grossWeight:find(weight,"grossWeight","container",owner),weightUnit:find("KG","weightUnit","container",owner)}];
  return {...f,wire:w,document:groundShipping(w,f.pdf,type)};
}
