import {it,expect} from "vitest";
import {cases39,shipping39Fixture} from "../fixtures/shipping39";
import {shippingTypes} from "../../src/modules/shipping/catalog";
import {verifyClassification,verifyShippingField} from "../../src/modules/shipping/verify";
import {numericTokens} from "../../src/modules/evidence/numbers";
it.each(cases39)("independent ReportLab native PDF source: $id",async(c)=>{
 for(const type of shippingTypes){const {pdf}=await shipping39Fixture(c.id,type),p=pdf.pages[0],title=p.blocks!.find(b=>b.text===(type==="house_bl"?"HOUSE BILL OF LADING":type==="house_manifest"?"HOUSE MANIFEST":"수출신고필증"))!;expect(title).toBeTruthy();expect(verifyClassification(type,{page:1,blockIds:[title.id]},pdf).current.status).toBe("verified");
 const expected=type==="house_manifest"&&c.fault==="packageCount"?11:10;
 expect(p.blocks!.filter(b=>numericTokens(b.text).includes(expected)).some(b=>verifyShippingField({value:expected,evidence:{page:1,blockIds:[b.id]}},pdf,"packageCount").current.status==="verified")).toBe(true);
 const goods=type==="export_declaration"?c.ko:type==="house_manifest"?(c.manifest??c.en):c.en;expect(p.text).toContain(goods);
 }
},15000);
