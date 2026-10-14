import type { ShippingDocument } from "./schema";
import type { ShippingCheck, ShippingRelationship } from "./review-model";
import {
  identifiers32,
  key32,
  ref32,
  root32,
  scope32,
  text32,
  unit32,
  verified32,
} from "./review-evidence";
export function declarationGroupChecks(
  docs: ShippingDocument[],
  relations: ShippingRelationship[],
): ShippingCheck[] {
  const checks: ShippingCheck[] = [];
  for (const bl of docs.filter((d) => d.detectedType === "house_bl")) {
    const linked = docs.filter(
      (d) =>
        d.detectedType === "export_declaration" &&
        relations.some(
          (r) =>
            r.status === "evidence_confirmed" &&
            r.sharedRoles.includes("houseBlNumber") &&
            r.documentIds.includes(bl.id) &&
            r.documentIds.includes(d.id),
        ),
    );
    if (linked.length < 2) continue;
    const own = linked.map((d) => root32(d, "declarationNumber"));
    const expected = new Set(
      identifiers32(bl, "declarationNumber")
        .filter(verified32)
        .map((f) => text32(f.field.current.value)),
    );
    const numbers = own.map((f) =>
      f && verified32(f) ? text32(f.field.current.value) : null,
    );
    const actual = new Set(numbers.filter((n): n is string => !!n));
    const refs = linked.flatMap((d) =>
      d.items.map((i) => ({
        description: ref32(d, "goodsDescription", i.fields.goodsDescription, {
          itemId: i.id,
        }),
        hs: ref32(d, "hsCode", i.fields.hsCode, { itemId: i.id }),
        quantity: ref32(d, "quantity", i.fields.quantity, { itemId: i.id }),
        unit: ref32(d, "quantityUnit", i.fields.quantityUnit, { itemId: i.id }),
      })),
    );
    const target = bl.items.map((i) => ({
      description: ref32(bl, "goodsDescription", i.fields.goodsDescription, {
        itemId: i.id,
      }),
      hs: ref32(bl, "hsCode", i.fields.hsCode, { itemId: i.id }),
      quantity: ref32(bl, "quantity", i.fields.quantity, { itemId: i.id }),
      unit: ref32(bl, "quantityUnit", i.fields.quantityUnit, { itemId: i.id }),
    }));
    const fields = [
      ...own.filter((f): f is NonNullable<typeof f> => !!f),
      ...refs.flatMap((r) => Object.values(r)),
      ...target.flatMap((r) => Object.values(r)),
    ];
    const blockers: string[] = [];
    const blNumbers = new Set(
      identifiers32(bl, "houseBlNumber")
        .filter(verified32)
        .map((f) => text32(f.field.current.value)),
    );
    if (
      docs.some(
        (d) =>
          d.id !== bl.id &&
          d.detectedType === "house_bl" &&
          identifiers32(d, "houseBlNumber")
            .filter(verified32)
            .some((f) => blNumbers.has(text32(f.field.current.value))),
      )
    )
      blockers.push(
        "같은 HBL의 복수 원본/버전이 있어 해당 집계의 전체 범위를 확인해야 합니다.",
      );
    if (numbers.some((n) => !n) || actual.size !== linked.length)
      blockers.push(
        "신고번호 누락 또는 중복이 있어 중복 합산을 배제하지 못했습니다.",
      );
    if (
      !expected.size ||
      expected.size !== actual.size ||
      [...actual].some((n) => !expected.has(n))
    )
      blockers.push(
        "HBL에 명시된 전체 신고 목록과 현재 신고서가 정확히 대응하지 않습니다.",
      );
    if ([bl, ...linked].some((d) => scope32(d) === "partial" || scope32(d) === "combined_packages" || (scope32(d) !== "full" && !d.factCoverage?.items.complete)))
      blockers.push("부분선적 또는 전체 신고 포함 범위가 미확인입니다.");
    if ([bl, ...linked].some((d) => !d.collectionCoverage?.items.complete))
      blockers.push("실제 품목 표의 전체 행 포함을 확인하지 못했습니다.");
    if (
      !refs.length ||
      !target.length ||
      [...refs, ...target].some((r) =>
        Object.values(r).some((f) => !verified32(f)),
      )
    )
      blockers.push("품명·HS·수량·단위 중 일부 근거가 미확인입니다.");
    const identity = (r: (typeof refs)[number]) =>
      text32(r.description.field.current.value) +
      "/" +
      text32(r.hs.field.current.value);
    const keys = refs.map(identity),
      tk = target.map(identity);
    if (new Set(keys).size !== keys.length || new Set(tk).size !== tk.length)
      blockers.push(
        "복수 신고 또는 HBL에 중복 품목이 있어 명시적 배분 없이 합산하지 않습니다.",
      );
    if (keys.length !== tk.length || keys.some((k) => !tk.includes(k)))
      blockers.push(
        "HBL 전체 품목 집합과 신고 품목 집합이 정확히 대응하지 않습니다.",
      );
    const units = [...refs, ...target].map((r) =>
      unit32(r.unit.field.current.value, "quantity"),
    );
    if (units.some((u) => !u) || new Set(units.map((u) => u?.unit)).size !== 1)
      blockers.push("동일 의미의 물품 수량 단위가 아닙니다.");
    const left = refs.reduce(
      (n, r, i) =>
        n +
        (typeof r.quantity.field.current.value === "number"
          ? r.quantity.field.current.value * (units[i]?.factor ?? 1)
          : 0),
      0,
    );
    const right = target.reduce(
      (n, r, i) =>
        n +
        (typeof r.quantity.field.current.value === "number"
          ? r.quantity.field.current.value *
            (units[refs.length + i]?.factor ?? 1)
          : 0),
      0,
    );
    if (
      !Number.isFinite(left) ||
      !Number.isFinite(right) ||
      Math.max(left, right) > Number.MAX_SAFE_INTEGER
    )
      blockers.push("합계가 안전한 수치 범위를 초과합니다.");
    const same =
      Math.abs(left - right) <=
      Math.max(1e-9, Math.max(left, right) * Number.EPSILON * refs.length);
    if (!blockers.length)
      for (const [i, row] of refs.entries()) {
        const index = target.findIndex((r) => identity(r) === identity(row)),
          matched = target[index];
        const equal =
          Number(row.quantity.field.current.value) * units[i]!.factor ===
          Number(matched.quantity.field.current.value) *
            units[refs.length + index]!.factor;
        checks.push({
          id: key32(bl.id, "check", "declaration-group-item-" + identity(row)),
          scope: "document",
          category: "quantity",
          title: "복수 신고 대응 품목 수량",
          importance: equal ? "info" : "high",
          assessment: equal ? "confirmed_match" : "confirmed_mismatch",
          relationshipIds: [],
          fields: [
            row.description,
            row.hs,
            row.quantity,
            row.unit,
            matched.description,
            matched.hs,
            matched.quantity,
            matched.unit,
          ],
          explanation:
            "명시된 전체 신고 목록의 서로 다른 품목을 HBL의 유일한 품명·HS 행에 대응해 수량을 비교했습니다.",
          followUp: "해당 신고 품목과 HBL 물품 수량·단위를 확인해 주세요.",
        });
      }
    checks.push({
      id: key32(bl.id, "check", "declaration-group-quantity"),
      scope: "document",
      category: "quantity",
      title: "복수 신고 물품 수량 합계",
      importance: blockers.length ? "attention" : same ? "info" : "high",
      assessment: blockers.length
        ? "needs_review"
        : same
          ? "confirmed_match"
          : "confirmed_mismatch",
      relationshipIds: relations
        .filter(
          (r) =>
            r.documentIds.includes(bl.id) &&
            r.documentIds.some((id) => linked.some((d) => d.id === id)),
        )
        .map((r) => r.id),
      fields,
      explanation: blockers.length
        ? "신고 합산의 포함·중복·행 근거 조건을 충족하지 못했습니다."
        : "명시된 전체 신고 목록과 서로 다른 검증된 품목 집합의 물품 수량을 합산했습니다. 포장/중량을 물품 수량에 포함하지 않았습니다.",
      uncertainties: blockers,
      followUp:
        "신고 목록·전체 품목 포함·분할 배분을 확인해 주세요. 같은 품목이나 공동 포장은 자동 합산하지 않습니다.",
      ...(!blockers.length
        ? {
            computedValues: [
              {
                documentId: bl.id,
                value: right,
                unit: String(target[0].unit.field.current.value),
                formula: "sum" as const,
                componentKeys: target.map((r) =>
                  key32(r.quantity.documentId, "item", r.quantity.itemId!),
                ),
              },
              {
                documentId: linked.map((d) => d.id).join("+"),
                value: left,
                unit: String(refs[0].unit.field.current.value),
                formula: "sum" as const,
                componentKeys: refs.map((r) =>
                  key32(r.quantity.documentId, "item", r.quantity.itemId!),
                ),
              },
            ],
          }
        : {}),
    });
  }
  return checks;
}
