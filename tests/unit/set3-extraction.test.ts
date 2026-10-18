import { describe, it, expect } from "vitest";
import { shipping34Fixture } from "../fixtures/shipping34";
import { portMeaning, countryCode } from "../../src/modules/shipping/ports";
import { contextualPort } from "../../src/modules/shipping/port-context";
import { root32 } from "../../src/modules/shipping/review-evidence";
import { groundShipping } from "../../src/modules/shipping/ground";
import { recoverNative } from "../../src/modules/shipping/recovery";
import { verifyShippingField } from "../../src/modules/shipping/verify";
import { reviewShipping } from "../../src/modules/shipping/review";

describe("explicit and independently grounded destination normalization", () => {
  it.each(["VANCOUVER, CANADA", "CAVAN", "CA VAN", "Vancouver (CAVAN)"])("maps sourced Canadian port %s", value => {
    expect(portMeaning(value)?.code).toBe("CAVAN");
  });
  it("protects ambiguous names, explicit conflicts and unknown codes", () => {
    expect(portMeaning("Vancouver")).toBeNull();
    expect(portMeaning("Vancouver", "CA")?.code).toBe("CAVAN");
    expect(portMeaning("Vancouver", "US")?.code).toBe("USVAN");
    expect(portMeaning("CAVAN", "US")).toBeNull();
    expect(portMeaning("Vancouver, Canada", "US")).toBeNull();
    expect(portMeaning("Seattle, USA")?.code).toBe("USSEA");
    expect(countryCode("캐나다 (CA) / CANADA")).toBe("CA");
    expect(countryCode("Canada (US)")).toBeNull();
  });
  it("uses only its own verified country and preserves the raw value", async () => {
    const f = await shipping34Fixture("export_declaration", {pod:"Vancouver", destinationCountry:"캐나다 (CA) / CANADA"});
    const d = recoverNative(f.document, f.pdf), ref = root32(d,"portOfDischarge")!;
    expect(contextualPort(ref,[d])).toBe("CAVAN");
    expect(ref.field.current.value).toBe("Vancouver");
    d.fields.destinationCountry.current.status = "user_edited";
    expect(contextualPort(ref,[d])).toBeNull();
  });
  it.each([ ["VANCOUVER, CANADA","VANCOUVER, CANADA","confirmed_match"], ["VANCOUVER, CANADA","SEATTLE, USA","confirmed_mismatch"], ["UNKNOWN CITY A","UNKNOWN CITY B","provisional_mismatch"] ])("compares ports conservatively %s / %s",async (a,b,status) => {
    const left = await shipping34Fixture("house_bl",{pod:a}), right = await shipping34Fixture("house_manifest",{pod:b});
    const c=reviewShipping([left.document,right.document]).primaryChecks!.find(c=>c.comparison?.meaning==="portOfDischarge");
    expect(c?.assessment).toBe(status);
  });
});

describe("native goods-cell count annotation belongs to its exact item/cargo row", () => {
  it("verifies separate numeric and unit candidates and recovers missing cargo fields", async () => {
    const f=await shipping34Fixture("house_manifest",{goodsCountAnnotation:"720 PCS"});
    const b=f.pdf.pages[0].blocks!.find(b=>b.text==="720 PCS")!;
    const owner=f.document.cargoRecords[0].fields.houseBlNumber.current.source!.layout!;
    for(const [role,value] of [["quantity",720],["quantityUnit","PCS"]] as const) {
      const v=verifyShippingField({value,evidence:{page:1,blockIds:[b.id]}},f.pdf,role,"cargo",owner);
      expect(v.current.status).toBe("verified");
      expect(v.current.source?.semanticRole).toBe(role === "quantity" ? "quantity" : "quantityUnit");
      const wrong={...owner,rowId:owner.rowId+"other"};
      expect(verifyShippingField({value,evidence:{page:1,blockIds:[b.id]}},f.pdf,role,"cargo",wrong).current.status).not.toBe("verified");
      expect(verifyShippingField({value,evidence:{page:1,blockIds:[b.id]}},f.pdf,role).current.status).not.toBe("verified");
    }
    const d=recoverNative(groundShipping(f.wire,f.pdf,"house_manifest"),f.pdf);
    expect(d.cargoRecords[0].fields.quantity.original.value).toBeNull();
    expect(d.cargoRecords[0].fields.quantity.current.value).toBe(720);
    expect(d.cargoRecords[0].fields.quantity.current.status).toBe("verified");
    expect(d.cargoRecords[0].fields.quantityUnit.current.value).toBe("PCS");
  });
  it.each(["MODEL 720", "720 mAh", "720 KG", "60 CTN"])("does not turn %s into product count",async text=>{
    const f=await shipping34Fixture("house_manifest",{goodsCountAnnotation:text}),b=f.pdf.pages[0].blocks!.find(b=>b.text===text)!;
    const owner=f.document.cargoRecords[0].fields.houseBlNumber.current.source!.layout!;
    expect(verifyShippingField({value:720,evidence:{page:1,blockIds:[b.id]}},f.pdf,"quantity","cargo",owner).current.status).not.toBe("verified");
  });
});

it("keeps genuine count/package differences and preserves original candidates", async () => {
  const a=await shipping34Fixture("house_bl"), b=await shipping34Fixture("house_manifest",{goodsCountAnnotation:"690 PCS",quantity:690,packages:65});
  const d=recoverNative(b.document,b.pdf);
  expect(d.cargoRecords[0].fields.quantity.original.value).toBeNull();
  expect(d.cargoRecords[0].fields.quantity.current.value).toBe(690);
  expect(d.cargoRecords[0].fields.packageCount.current.value).toBe(65);
  const r=reviewShipping([a.document,d]);
  expect(r.primaryChecks!.some(c=>c.comparison?.meaning==="quantity"&&c.assessment==="confirmed_mismatch")).toBe(true);
  expect(r.primaryChecks!.some(c=>c.comparison?.meaning==="packageCount"&&c.assessment==="confirmed_mismatch")).toBe(true);
});

it("missing country can be recovered from its own labelled native cell, not OCR", async () => {
  const f=await shipping34Fixture("export_declaration",{pod:"Vancouver",destinationCountry:"CANADA (CA)"}),w=structuredClone(f.wire);
  w.fields.destinationCountry={value:null,evidence:null};
  const d=recoverNative(groundShipping(w,f.pdf,"export_declaration"),f.pdf);
  expect(d.fields.destinationCountry.original.value).toBeNull();
  expect(contextualPort(root32(d,"portOfDischarge")!,[d])).toBe("CAVAN");
  const p=structuredClone(f.pdf);p.pages[0].textSource="ocr";
  const o=recoverNative(groundShipping(w,p,"export_declaration"),p);
  expect(contextualPort(root32(o,"portOfDischarge")!,[o])).toBeNull();
});

it("does not recover a declared currency value as quantity from an earlier aligned header",async()=>{
  const f=await shipping34Fixture("export_declaration",{declaredValue:9800}),w=structuredClone(f.wire);
  w.fields.quantity={value:null,evidence:null};
  const d=recoverNative(groundShipping(w,f.pdf,"export_declaration"),f.pdf);
  expect(d.fields.quantity.current.value).toBe(720);
  expect(d.fields.quantity.current.status).toBe("verified");
  const b=f.pdf.pages[0].blocks!.find(b=>b.text==="USD 9800")!;
  expect(verifyShippingField({value:9800,evidence:{page:1,blockIds:[b.id]}},f.pdf,"quantity").current.status).not.toBe("verified");
});

it("keeps the count annotation out of recovered product identity",async()=>{
  const f=await shipping34Fixture("house_manifest",{goodsCountAnnotation:"720 PCS"}),w=structuredClone(f.wire);
  w.cargoRecords[0].fields.goodsDescription={value:null,evidence:null};
  const d=recoverNative(groundShipping(w,f.pdf,"house_manifest"),f.pdf);
  expect(d.cargoRecords[0].fields.goodsDescription.current.value).toBe("GLASS STORAGE JARS");
  expect(d.cargoRecords[0].fields.goodsDescription.current.status).toBe("verified");
});

it("identical literal codes agree without proving gazetteer coverage; different unknown codes stay provisional",async()=>{
  for (const other of ["USXYZ","USZZZ"]) {
    const a=await shipping34Fixture("house_bl",{pod:"USXYZ"}), b=await shipping34Fixture("house_manifest",{pod:other});
    const c=reviewShipping([a.document,b.document]).primaryChecks!.find(c=>c.comparison?.meaning==="portOfDischarge");
    expect(c?.assessment).toBe(other==="USXYZ"?"confirmed_match":"provisional_mismatch");
  }
});

it("verifies and recovers both explicit suffix atoms in an owned one-line cargo description, retaining model/capacity",async()=>{
  const goods="GLASS STORAGE JARS MODEL Q7 750ML / 720 PCS / 60 CARTONS";
  const f=await shipping34Fixture("house_manifest",{goods,goodsSize:5}),b=f.pdf.pages[0].blocks!.find(b=>b.text===goods)!,owner=f.document.cargoRecords[0].fields.houseBlNumber.current.source!.layout!;
  for(const[role,value]of [["quantity",720],["quantityUnit","PCS"],["packageCount",60],["packageUnit","CARTONS"]]as const){
    expect(verifyShippingField({value,evidence:{page:1,blockIds:[b.id]}},f.pdf,role,"cargo",owner).current.status).toBe("verified");
    expect(verifyShippingField({value,evidence:{page:1,blockIds:[b.id]}},f.pdf,role,"cargo",{...owner,rowId:"different"}).current.status).not.toBe("verified");
  }
  expect(verifyShippingField({value:750,evidence:{page:1,blockIds:[b.id]}},f.pdf,"quantity","cargo",owner).current.status).not.toBe("verified");
  const d=recoverNative(f.document,f.pdf);
  expect(d.cargoRecords[0].fields.quantity.current.value).toBe(720);
  expect(d.cargoRecords[0].fields.quantity.current.status).toBe("verified");
  expect(d.cargoRecords[0].fields.goodsDescription.current.value).toBe(goods);
});
