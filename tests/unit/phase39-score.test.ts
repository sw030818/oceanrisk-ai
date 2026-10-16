import{it,expect}from"vitest";
import{score39}from"../../scripts/lib/phase39-score";
import type{ShippingReview}from"../../src/modules/shipping/review-model";
const review=(entries:[string,string][])=>({checks:[],primaryChecks:entries.map(([meaning,assessment])=>({comparison:{meaning},assessment}))}) as unknown as ShippingReview;
it("separates confirmed detection, provisional suspicion and false positive meanings",()=>{
 expect(score39(review([["goodsDescription","provisional_mismatch"]]),"material")).toMatchObject({TP:0,FP:0,FN:1,provisionalDetection:true});
 expect(score39(review([["quantity","confirmed_mismatch"],["quantity","confirmed_mismatch"]]),"quantity")).toMatchObject({TP:1,FP:0,FN:0});
 expect(score39(review([["quantity","confirmed_mismatch"]]),null)).toMatchObject({TP:0,FP:1,FN:0});
});
