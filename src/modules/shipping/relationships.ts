import type { ShippingDocument } from "./schema";
import type { ShippingRelationship, ShippingCheck } from "./review-model";
import {
  identifiers32,
  verified32,
  text32,
  scope32,
  key32,
  root32,
  ref32,
  refKey32,
} from "./review-evidence";
export function relateShipping(
  docs: ShippingDocument[],
): ShippingRelationship[] {
  const ordered = [...docs].sort((a, b) => a.id.localeCompare(b.id)),
    out: ShippingRelationship[] = [];
  for (let i = 0; i < ordered.length; i++)
    for (let j = i + 1; j < ordered.length; j++) {
      const a = ordered[i],
        b = ordered[j];
      if (a.detectedType === b.detectedType) continue;
      const evidence: ShippingCheck["fields"] = [],
        shared: string[] = [],
        conflicts: string[] = [];
      for (const role of [
        "houseBlNumber",
        "declarationNumber",
        "shipmentReference",
      ]) {
        const left = identifiers32(a, role).filter(verified32),
          right = identifiers32(b, role).filter(verified32),
          l = new Set(left.map((f) => text32(f.field.current.value))),
          r = new Set(right.map((f) => text32(f.field.current.value)));
        const matches = [...l].filter((v) => r.has(v));
        if (matches.length) {
          shared.push(role);
          evidence.push(
            ...left.filter((f) =>
              matches.includes(text32(f.field.current.value)),
            ),
            ...right.filter((f) =>
              matches.includes(text32(f.field.current.value)),
            ),
          );
        } else if (l.size && r.size) {
          conflicts.push(role);
          evidence.push(...left, ...right);
        }
      }
      const declarationMappingMissing =
        shared.includes("houseBlNumber") &&
        conflicts.includes("declarationNumber");
      if (declarationMappingMissing)
        conflicts.splice(conflicts.indexOf("declarationNumber"), 1);
      const strong = shared.length > 0;
      // A shared booking, container or goods name supports a candidate, never a
      // shipment identity proof. Conflicting strong identifiers protect quantities.
      const containers = a.containers
        .filter((c) =>
          verified32(ref32(a, "containerNumber", c.containerNumber)),
        )
        .some((c) =>
          b.containers.some(
            (d) =>
              verified32(ref32(b, "containerNumber", d.containerNumber)) &&
              text32(c.containerNumber.current.value) ===
                text32(d.containerNumber.current.value),
          ),
        );
      const parties = ["shipper", "consignee"].filter((role) => {
        const l = root32(a, role),
          r = root32(b, role);
        return (
          l &&
          r &&
          verified32(l) &&
          verified32(r) &&
          text32(l.field.current.value) !== text32(r.field.current.value)
        );
      });
      if (strong && parties.length) conflicts.push(...parties);
      const completeClass =
        a.classificationStatus === "classified" &&
        b.classificationStatus === "classified";
      const editedIdentity = [a, b].some((d) =>
        d.references.some(r=>['house_bl','export_declaration','shipment'].includes(r.kind)&&r.number.current.status==='user_edited') ||
        [
          "houseBlNumber",
          "declarationNumber",
          "shipmentReference",
          "shipper",
          "consignee",
          "exporter",
          "exporterIdentifier",
        ].some(
          (role) =>
            d.fields[role]?.current.status === "user_edited" ||
            d.additionalFields.some(
              (f) =>
                f.meaning === role && f.field.current.status === "user_edited",
            ) ||
            identifiers32(d, role).some(
              (f) => f.field.current.status === "user_edited",
            ),
        ),
      );
      const status = conflicts.length
        ? "conflict"
        : strong &&
            completeClass &&
            !declarationMappingMissing &&
            !editedIdentity
          ? "evidence_confirmed"
          : "proposed";
      const scopes = [scope32(a), scope32(b)],
        scope = scopes.includes("partial")
          ? "partial"
          : scopes.includes("combined_packages")
            ? "combined_packages"
            : scopes.every((s) => s === "full")
              ? "full"
              : "unknown";
      const entityRefs = [a, b].flatMap((doc) => [
        { documentId: doc.id, kind: "document" as const, entityId: doc.id },
        ...doc.items.map((row) => ({
          documentId: doc.id,
          kind: "item" as const,
          entityId: row.id,
        })),
        ...doc.containers.map((row) => ({
          documentId: doc.id,
          kind: "container" as const,
          entityId: row.id,
        })),
        ...doc.cargoRecords
          .filter((row) => {
            const f = ref32(doc, "houseBlNumber", row.fields.houseBlNumber, {
              cargoId: row.id,
            });
            return (
              verified32(f) &&
              evidence.some(
                (e) =>
                  e.fieldName === "houseBlNumber" &&
                  text32(e.field.current.value) ===
                    text32(f.field.current.value),
              )
            );
          })
          .map((row) => ({
            documentId: doc.id,
            kind: "cargo" as const,
            entityId: row.id,
          })),
        ...doc.references.map((row) => ({
          documentId: doc.id,
          kind: "reference" as const,
          entityId: row.id,
        })),
      ]);
      out.push({
        id: key32(a.id, "relationship", b.id),
        documentIds: [a.id, b.id],
        itemIds: entityRefs
          .filter((r) => r.kind === "item")
          .map((r) => key32(r.documentId, r.kind, r.entityId))
          .sort(),
        containerIds: entityRefs
          .filter((r) => r.kind === "container")
          .map((r) => key32(r.documentId, r.kind, r.entityId))
          .sort(),
        referenceIds: entityRefs
          .filter((r) => r.kind === "reference")
          .map((r) => key32(r.documentId, r.kind, r.entityId))
          .sort(),
        entityRefs: entityRefs.sort((a, b) =>
          key32(a.documentId, a.kind, a.entityId).localeCompare(
            key32(b.documentId, b.kind, b.entityId),
          ),
        ),
        status,
        scope,
        sharedRoles: shared.sort(),
        conflictRoles: conflicts.sort(),
        evidence: evidence.sort((a, b) =>
          refKey32(a).localeCompare(refKey32(b)),
        ),
        reason:
          editedIdentity && status === "proposed"
            ? "선적/당사자 식별 필드가 사용자 수정값입니다. 변경된 연결 범위를 원문 검증 성공으로 승격하지 않습니다."
            : declarationMappingMissing
              ? "같은 HBL이지만 해당 신고번호가 상대 문서 참조 목록에서 확인되지 않았습니다. 복수 신고/부분 범위를 확인합니다. 다른 거래 또는 확정 참조 오류로 단정하지 않습니다."
              : status === "conflict"
                ? "명시적 식별자 또는 당사자가 충돌합니다. 같은 선적으로 확정하지 않습니다."
                : status === "evidence_confirmed"
                  ? "같은 의미의 검증된 HBL/신고/선적 참조로 연결했습니다. 수량 비교의 선적 범위는 별도로 확인합니다."
                  : containers
                    ? "컨테이너는 같지만 강한 선적 식별 근거가 부족합니다."
                    : "문서 선택은 비교 의도이며 같은 선적의 입증은 아닙니다. 연결 근거를 확인해 주세요.",
      });
    }
  return out;
}
