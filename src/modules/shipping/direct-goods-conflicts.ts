import type { ShippingDocument } from "./schema";
import type { ShippingCheck, ShippingReview } from "./review-model";
import { factHbl } from "./facts";
import { compareGoods } from "./goods-semantics";
import { ref32, scope32, verified32 } from "./review-evidence";
// A third document's untranslated/partial description must not hide a proven
// contradiction between two complete, uniquely anchored, linked cargo records.
export function directGoodsConflicts(
  documents: ShippingDocument[],
  review: ShippingReview,
  primary: ShippingCheck[],
) {
  const seen = new Set(
    primary
      .filter(
        (c) =>
          c.assessment === "confirmed_mismatch" &&
          c.comparison?.meaning === "goodsDescription",
      )
      .map((c) => c.comparison!.hbl),
  );
  const owner = (d: ShippingDocument) => {
    if (
      d.classificationStatus !== "classified" ||
      d.factCoverage?.limitations.length ||
      ["partial", "combined_packages"].includes(scope32(d)) ||
      d.fields.shipmentScope?.current.status === "user_edited"
    )
      return;
    if (d.items.length === 1 && d.factCoverage?.items.complete)
      return ref32(d, "goodsDescription", d.items[0].fields.goodsDescription, {
        itemId: d.items[0].id,
      });
    if (
      !d.items.length &&
      d.cargoRecords.length === 1 &&
      d.factCoverage?.cargoRecords.complete
    )
      return ref32(
        d,
        "goodsDescription",
        d.cargoRecords[0].fields.goodsDescription,
        { cargoId: d.cargoRecords[0].id },
      );
  };
  for (const [i, a] of documents.entries())
    for (const b of documents.slice(i + 1)) {
      const hbl = factHbl(a),
        fa = owner(a),
        fb = owner(b);
      if (
        !hbl ||
        seen.has(hbl) ||
        hbl !== factHbl(b) ||
        !fa ||
        !fb ||
        !verified32(fa) ||
        !verified32(fb)
      )
        continue;
      const rel = review.relationships?.find(
        (r) =>
          r.status === "evidence_confirmed" &&
          !r.conflictRoles.length &&
          !r.mappingWarnings?.length &&
          r.documentIds.length === 2 &&
          r.documentIds.includes(a.id) &&
          r.documentIds.includes(b.id),
      );
      if (
        !rel ||
        compareGoods(fa.field.current.value, fb.field.current.value).status !==
          "different"
      )
        continue;
      const related = review.checks.filter(
        (c) =>
          c.category === "goods" &&
          c.fields.some((f) => f.fieldName === "goodsDescription") &&
          c.relationshipIds.includes(rel.id),
      );
      primary.push({
        id:
          "direct-goods/" +
          [a.id, b.id].sort().map(encodeURIComponent).join("/"),
        title: "입증된 품목 속성 충돌",
        scope: "document",
        category: "goods",
        documentIds: [a.id, b.id],
        relationshipIds: [rel.id],
        assessment: "confirmed_mismatch",
        importance: "high",
        fields: [fa, fb],
        explanation:
          "검증된 같은 HBL의 유일한 전체 화물행에서 품목·재질·모델·규격의 명시 속성이 충돌합니다. 다른 서류의 불완전한 표현과 구분한 독립 판정입니다.",
        followUp: "두 문서의 해당 품목을 원본 작성자에게 확인해 주세요.",
        comparison: {
          meaning: "goodsDescription",
          hbl,
          scope: "hbl_record",
          reasonCodes: [],
          relatedCheckIds: related.map((c) => c.id),
          facts: [],
        },
      });
      seen.add(hbl);
    }
}
