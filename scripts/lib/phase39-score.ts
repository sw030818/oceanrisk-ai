import type {ShippingReview} from "../../src/modules/shipping/review-model";
// Evaluation only. No expected answers are passed to either OpenAI request.
export function score39(review:ShippingReview, expectedMeaning:string|null) {
 const checks=review.primaryChecks??review.checks;
 const meaning=(c:typeof checks[number])=>c.comparison?.meaning??(c.category==="goods"?"goodsDescription":c.category);
 const wanted=expectedMeaning&&["specification","model","material","size"].includes(expectedMeaning)?"goodsDescription":expectedMeaning;
 const confirmed=[...new Set(checks.filter(c=>c.assessment==="confirmed_mismatch").map(meaning))];
 const provisional=[...new Set(checks.filter(c=>c.assessment==="provisional_mismatch").map(meaning))];
 return {evaluationUnit:"one independent fault meaning per shipment; other confirmed meanings count as false positives",expectedMeaning:wanted,confirmedMeanings:confirmed,provisionalMeanings:provisional,TP:wanted&&confirmed.includes(wanted)?1:0,FP:confirmed.filter(m=>m!==wanted).length,FN:wanted&&!confirmed.includes(wanted)?1:0,provisionalDetection:!!wanted&&provisional.includes(wanted)};
}
