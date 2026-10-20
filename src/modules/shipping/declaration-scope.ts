import { goodsComparisonValue } from "./goods-context";
import type { ShippingCheck, ShippingRelationship } from "./review-model";
import type { ShippingDocument } from "./schema";
import { goodsCore } from "./equivalence";
import {
  identifiers32,
  ref32,
  scope32,
  text32,
  unit32,
  verified32,
  containerViews32,
} from "./review-evidence";

// Resolve full-document vs individual-declaration scope, never numerical truth.
// The original checks remain unchanged. Successful, independently grounded
// group/item checks replace invalid whole-vs-subset comparisons in the primary
// projection. Allocation of packages/weight is still an explicit open problem.
export function resolveDeclarationScopes(
  primary: ShippingCheck[],
  original: ShippingCheck[],
  documents: ShippingDocument[],
  relations: ShippingRelationship[],
) {
  const rows = (d: ShippingDocument) => {
    if (!d.collectionCoverage?.items.complete || !d.items.length) return null;
    const keys = d.items.map((i) => {
      const refs = [
        "goodsDescription",
        "hsCode",
        "quantity",
        "quantityUnit",
      ].map((k) => ref32(d, k, i.fields[k], { itemId: i.id }));
      const unit = unit32(i.fields.quantityUnit.current.value, "quantity");
      if (!refs.every(verified32) || !unit) return null;
      return JSON.stringify([
        goodsCore(goodsComparisonValue(i.fields.goodsDescription)),
        text32(i.fields.hsCode.current.value),
        Number(i.fields.quantity.current.value) * unit.factor,
        unit.unit,
      ]);
    });
    return keys.some((k) => k === null) || new Set(keys).size !== keys.length
      ? null
      : keys.sort().join("|");
  };
  for (const proof of original.filter((c) => c.declarationCoverage)) {
    const coverage = proof.declarationCoverage!;
    if (!proof.computedValues?.length || !proof.fields.every(verified32))
      continue;
    const bl = documents.find((d) => d.id === coverage.hblDocumentId);
    if (!bl || bl.classificationStatus !== "classified") continue;
    const hbl = [
      ...new Set(
        identifiers32(bl, "houseBlNumber")
          .filter(verified32)
          .map((f) => text32(f.field.current.value)),
      ),
    ];
    const baseRows = rows(bl);
    if (!baseRows || hbl.length !== 1) continue;
    const carriers = new Set([bl.id]);
    for (const d of documents) {
      if (
        d.detectedType !== "house_manifest" ||
        d.classificationStatus !== "classified" ||
        (d.fields.shipmentScope?.current.value != null &&
          d.fields.shipmentScope.current.status !== "verified") ||
        scope32(d) === "partial" ||
        scope32(d) === "combined_packages"
      )
        continue;
      const ids = [
        ...new Set(
          identifiers32(d, "houseBlNumber")
            .filter(verified32)
            .map((f) => text32(f.field.current.value)),
        ),
      ];
      const linked = relations.some(
        (r) =>
          r.documentIds.includes(d.id) &&
          r.documentIds.includes(bl.id) &&
          r.status === "evidence_confirmed" &&
          !r.conflictRoles.length &&
          !r.mappingWarnings?.length,
      );
      if (
        linked &&
        ids.length === 1 &&
        ids[0] === hbl[0] &&
        rows(d) === baseRows
      )
        carriers.add(d.id);
    }
    const declarations = new Set(coverage.declarationDocumentIds),
      members = new Set([...carriers, ...declarations]);
    for (const c of primary) {
      const ids = [
        ...new Set([
          ...(c.documentIds ?? []),
          ...c.fields.map((f) => f.documentId),
        ]),
      ];
      if (
        ids.length < 2 ||
        ids.some((id) => !members.has(id)) ||
        !c.fields.length ||
        !c.fields.every(verified32) ||
        c.assessment === "confirmed_mismatch"
      )
        continue;
      // Never erase a user edit, bad evidence, unit conflict, partial shipment,
      // duplicate source, or unrelated uncertainty merely because a sum exists.
      const reasons = c.comparison?.reasonCodes ?? [];
      if (
        reasons.some(
          (r) =>
            !["DECLARATION_SCOPE_UNRESOLVED", "SCOPE_UNRESOLVED"].includes(r),
        )
      )
        continue;
      const meaning = c.comparison?.meaning;
      const subset = ids.some((id) => declarations.has(id));
      if (subset && ["containerNumber", "sealNumber"].includes(meaning ?? "")) {
        // Whole carrier lists and an individual declaration are different sets.
        // A proven complete declaration group permits membership, not equality.
        // Seal membership additionally requires the very same native container.
        const signature = (f: typeof c.fields[number]) => {
          if (f.fieldName !== meaning) return null;
          if (meaning === "containerNumber") return text32(f.field.current.value);
          const d = documents.find((d) => d.id === f.documentId);
          const owner = d && containerViews32(d).find((v) =>
            v.id === (f.containerId ?? f.cargoId));
          if (!owner || !owner.containerNumber ||
            !verified32(ref32(d!, "containerNumber", owner.containerNumber,
              owner.kind === "cargo" ? { cargoId: owner.id } : { containerId: owner.id })))
            return null;
          return JSON.stringify([text32(owner.containerNumber.current.value), text32(f.field.current.value)]);
        };
        const carrierSets = ids.filter((id) => carriers.has(id)).map((id) =>
          c.fields.filter((f) => f.documentId === id).map(signature));
        const own = c.fields.filter((f) => declarations.has(f.documentId)).map(signature);
        if (carrierSets.length && own.length && carrierSets.every((keys) =>
          keys.length && keys.every(Boolean) &&
          own.every((key) => !!key && keys.includes(key)))) {
          c.assessment = "confirmed_match";
          c.importance = "info";
          c.scopeResolution = { groupCheckId: proof.id, kind: "container_membership" };
          c.comparison!.reasonCodes = [];
          c.comparison!.relatedCheckIds = [...new Set([...c.comparison!.relatedCheckIds, proof.id])];
          c.uncertainties = [];
          c.explanation = "전체 신고 목록과 품목 범위가 검증된 그룹에서 해당 신고의 컨테이너 포함 관계를 확인했습니다. Seal은 같은 원문 컨테이너 번호 안에서만 대조합니다.";
        }
        continue;
      }
      if (
        subset &&
        ["quantity", "goodsDescription", "hsCode"].includes(meaning ?? "") &&
        c.assessment.startsWith("provisional")
      ) {
        c.assessment = "not_applicable";
        c.importance = "info";
        c.scopeResolution = { groupCheckId: proof.id, kind: "subset" };
        c.comparison!.relatedCheckIds = [
          ...new Set([...c.comparison!.relatedCheckIds, proof.id]),
        ];
        c.explanation =
          "전체 HBL과 개별 신고의 값은 같은 범위가 아닙니다. 명시된 전체 신고 목록·유일 품목·전체 원문 행을 입증한 별도 품목 대응 및 신고 합계 검사에서 대조합니다. 원본 검사는 보존합니다.";
        c.followUp =
          "복수 신고 대응 품목 수량 및 합계 검사의 실제 값·근거·판정을 확인해 주세요.";
      } else if (
        !subset &&
        ids.every((id) => carriers.has(id)) &&
        meaning === "hsCode" &&
        c.assessment === "provisional_match"
      ) {
        c.assessment = "confirmed_match";
        c.importance = "info";
        c.scopeResolution = {
          groupCheckId: proof.id,
          kind: "aligned_carriers",
        };
        c.comparison!.reasonCodes = [];
        c.uncertainties = [];
        c.explanation =
          "검증된 전체 품목 행의 품명·전체 HS·수량·단위 집합이 일대일로 대응하는 두 운송서류의 HS를 비교했습니다.";
      } else if (
        subset &&
        c.assessment === "provisional_match" &&
        ["grossWeight", "packageCount", "netWeight"].includes(meaning ?? "")
      ) {
        c.scopeResolution = { groupCheckId: proof.id, kind: "allocation" };
      }
    }
  }
}
