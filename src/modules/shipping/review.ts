import { declarationAllocations } from "./declaration-allocation";
import { portRelation } from "./port-context";
import { withSemanticReview } from "./semantic-integration";
import type { SemanticReport } from "./semantic-schema";
import { withFactReview } from "./fact-review";
import { partyMatch32 } from "./parties";
import type { ShippingDocument } from "./schema";
import type {
  ShippingReview,
  ShippingCheck,
  ShippingAssessment,
  ShippingRelationship,
} from "./review-model";
import {
  goodsEquivalent,
  hsSix,
  contextualPackageUnit,
} from "./equivalence";
import { declarationGroupChecks } from "./declaration-groups";
import { relateShipping } from "./relationships";
import {
  has32,
  identifiers32,
  identifierValues32,
  declarationAgreement32,
  containerViews32,
  containerEntry32,
  key32,
  ref32,
  refKey32,
  comparisonField32 as root32,
  scope32,
  registerShippingSet,
  text32,
  unit32,
  verified32,
  type FieldRef,
} from "./review-evidence";
import { shippingFieldLabels } from "./catalog";
type Category = ShippingCheck["category"];
type Scope = ShippingCheck["scope"];
const label = (key: string) =>
  shippingFieldLabels[key as keyof typeof shippingFieldLabels] ??
  (
    {
      weightUnit: "중량 단위",
      shipmentReference: "선적 참조",
      bookingReference: "Booking 참조",
    } as Record<string, string>
  )[key] ??
  key;
const unique = (rs: FieldRef[]) =>
  rs.filter(
    (r, i) =>
      rs.findIndex(
        (x) =>
          x.documentId === r.documentId &&
          x.fieldName === r.fieldName &&
          x.itemId === r.itemId &&
          x.containerId === r.containerId &&
          x.cargoId === r.cargoId &&
          x.referenceId === r.referenceId,
      ) === i,
  );
function pairScope(a: ShippingDocument, b: ShippingDocument): Scope {
  const types = new Set([a.detectedType, b.detectedType]);
  return types.has("house_bl") && types.has("house_manifest")
    ? "house_bl_manifest"
    : types.has("export_declaration") && types.has("house_manifest")
      ? "declaration_manifest"
      : "house_bl_declaration";
}
const missing = (values: (FieldRef | undefined)[]) =>
  values.some((f) => !f || !has32(f.field));
function whole32(d: ShippingDocument) {
  const bl = new Set(
    identifiers32(d, "houseBlNumber")
      .filter(verified32)
      .map((f) => text32(f.field.current.value)),
  );
  const cargo=d.factCoverage?.cargoRecords, containers=d.factCoverage?.containers;
  const sameNativeRows = !!cargo?.nativeRows?.length && !!cargo.nativeHbls?.length &&
    cargo.nativeHbls.every(h=>bl.has(text32(h))) && bl.size===1 &&
    !!containers?.complete && JSON.stringify(cargo.nativeRows)===JSON.stringify(containers.rows);
  return (
    bl.size <= 1 &&
    !(
      d.collectionCoverage?.cargoRecords.rowCount &&
      !d.collectionCoverage.cargoRecords.complete && !sameNativeRows
    )
  );
}
function blockers32(
  a: ShippingDocument,
  b: ShippingDocument,
  r: ShippingRelationship,
  numeric = false,
) {
  const why: string[] = [];
  if (r.status !== "evidence_confirmed")
    why.push(
      r.status === "conflict"
        ? "참조/당사자 충돌로 같은 선적의 확정이 보호됩니다."
        : r.status === "user_confirmed"
          ? "사용자 확인에 따른 연결이며 원문 동일성 입증과 구분합니다."
          : "강한 선적 연결 근거가 부족합니다.",
    );
  if (
    a.classificationStatus !== "classified" ||
    b.classificationStatus !== "classified"
  )
    why.push("문서 분류 근거를 확인해야 합니다.");
  if (numeric && (scope32(a) !== "full" || scope32(b) !== "full"))
    why.push(
      "전체 선적 범위가 양쪽 원문에서 확인되지 않았거나 부분/동시포장 범위입니다.",
    );
  if (numeric && (!whole32(a) || !whole32(b)))
    why.push(
      "여러 HBL 화물을 포함하는 문서 전체 합계는 직접 비교하지 않습니다.",
    );
  return why;
}
export function reviewShipping(
  input: ShippingDocument[],
  options: { confirmedRelationships?: string[]; semantic?: SemanticReport } = {},
): ShippingReview {
  const documents = [...input]
    .filter((d) => d.extractionStatus !== "not_performed")
    .sort((a, b) => a.id.localeCompare(b.id));
  registerShippingSet(documents);
  const relationships = relateShipping(documents),
    checks: ShippingCheck[] = [];
  for (const r of relationships)
    if (
      r.status === "proposed" &&
      options.confirmedRelationships?.includes(r.id)
    ) {
      r.status = "user_confirmed";
      r.reason =
        "사용자가 동일 선적으로 확인했습니다. 원문 연결 근거의 검증 성공으로 승격하지 않으며 관련 수치 비교는 잠정입니다.";
    }
  const add = (
    scope: Scope,
    id: string,
    category: Category,
    fields: FieldRef[],
    assessment: ShippingAssessment,
    title: string,
    reason: string,
    why: string[] = [],
    links: string[] = [],
    computedValues?: ShippingCheck["computedValues"],
  ) => {
    checks.push({
      id: key32(scope, "check", id),
      scope,
      category,
      assessment,
      title,
      importance:
        assessment.endsWith("mismatch") &&
        ["reference", "container", "packaging", "weight", "quantity"].includes(
          category,
        )
          ? "high"
          : assessment === "confirmed_match"
            ? "info"
            : "attention",
      fields: unique(fields).sort((a, b) =>
        refKey32(a).localeCompare(refKey32(b)),
      ),
      relationshipIds: links,
      explanation: reason,
      uncertainties: why,
      followUp:
        assessment === "confirmed_match"
          ? "원문과 선적 범위를 최종 확인해 주세요."
          : category === "reference"
            ? "HBL·신고·선적 번호의 종류와 해당 화물 범위를 원본 작성자에게 확인해 주세요."
            : `원본 작성자에게 ${title}의 단위·선적 범위·행 대응을 확인하고 필요하면 서류를 수정해 주세요.`,
      computedValues,
    });
  };
  function compare(
    scope: Scope,
    id: string,
    category: Category,
    values: (FieldRef | undefined)[],
    why: string[],
    links: string[],
    title: string,
    equal?: boolean,
  ) {
    const fs = values.filter((f): f is FieldRef => !!f),
      present = !missing(values);
    const same =
      equal ?? new Set(fs.map((f) => text32(f.field.current.value))).size <= 1;
    const safe = present && fs.every(verified32) && !why.length;
    // A pair where one document does not print the field at all is not a
    // comparison. Genuinely required information is flagged once per document
    // by the required-information check, not again for every pair.
    const assessment: ShippingAssessment = !present
      ? "not_applicable"
      : safe
        ? same
          ? "confirmed_match"
          : "confirmed_mismatch"
        : same
          ? "provisional_match"
          : "provisional_mismatch";
    add(
      scope,
      id,
      category,
      fs,
      assessment,
      title,
      !present
        ? "한쪽에 비교할 필드가 없습니다. 누락을 불일치로 판단하지 않습니다."
        : `${title}의 같은 의미 값을 ${safe ? "검증된 원문과 연결 범위에서" : "후보 연결/사용자 확인을 바탕으로"} ${same ? "일치" : "차이"}로 확인했습니다.`,
      [
        ...why,
        ...(fs.some((f) => !verified32(f))
          ? [
              "근거 미확인 또는 사용자 수정값이 포함되어 확정 판정하지 않습니다.",
            ]
          : []),
      ],
      links,
    );
  }
  function number(
    scope: Scope,
    id: string,
    category: "packaging" | "quantity" | "weight",
    values: (FieldRef | undefined)[],
    units: (FieldRef | undefined)[],
    why: string[],
    links: string[],
    title: string,
    optional = false,
  ) {
    const fs = [...values, ...units].filter((f): f is FieldRef => !!f);
    // Per-container figures are optional detail: a form without them is not
    // missing information, because document totals are compared separately.
    if (optional && missing(values)) {
      add(scope, id, category, fs, "not_applicable", title, "한쪽 서류에 컨테이너별 수치가 없어 비교 대상이 아닙니다. 문서 합계는 별도로 비교합니다.", why, links);
      return;
    }
    if (missing(values) || missing(units)) {
      add(
        scope,
        id,
        category,
        fs,
        "insufficient_information",
        title,
        "수치 또는 해당 단위 정보가 부족합니다.",
        why,
        links,
      );
      return;
    }
    const normalized = units.map((f) => {
      const code = category === "packaging" ? contextualPackageUnit(f) : null;
      return code ? { unit: code, factor: 1 } : unit32(f!.field.current.value, category);
    });
    if (
      normalized.some((u) => !u) ||
      new Set(normalized.map((u) => u?.unit)).size !== 1
    ) {
      add(
        scope,
        id,
        category,
        fs,
        "not_comparable",
        title,
        "서로 다른 의미 또는 호환성이 정의되지 않은 단위입니다. PCS·CTNS 또는 순·총·신고 중량을 혼용하지 않습니다.",
        why,
        links,
      );
      return;
    }
    const nums = values.map((v, i) =>
      typeof v!.field.current.value === "number"
        ? v!.field.current.value * normalized[i]!.factor
        : NaN,
    );
    if (nums.some((n) => !Number.isFinite(n))) {
      add(
        scope,
        id,
        category,
        fs,
        "not_comparable",
        title,
        "수치 형식이 올바르지 않습니다.",
        why,
        links,
      );
      return;
    }
    const same = nums.every(
        (v) =>
          Math.abs(v - nums[0]) <=
          Math.max(1, Math.abs(v), Math.abs(nums[0])) * 1e-9,
      ),
      reportedDocumentScope =
        values.every(
          (v) =>
            v &&
            !v.itemId &&
            !v.cargoId &&
            !v.containerId &&
            v.field.current.source?.scopeBasis === "document_field",
        ) &&
        fs.every(verified32) &&
        values.every((v) => {
          const doc = documents.find((d) => d.id === v!.documentId);
          if (
            !doc ||
            scope32(doc) === "partial" ||
            scope32(doc) === "combined_packages" ||
            !whole32(doc)
          )
            return false;
          const hbls = new Set(
            identifiers32(doc, "houseBlNumber")
              .filter(verified32)
              .map((f) => text32(f.field.current.value)),
          );
          if (hbls.size !== 1) return false;
          if (doc.detectedType === "export_declaration") {
            const siblings = documents.filter(
              (d) =>
                d.detectedType === "export_declaration" &&
                identifiers32(d, "houseBlNumber")
                  .filter(verified32)
                  .some((f) => hbls.has(text32(f.field.current.value))),
            );
            if (
              new Set(
                siblings.flatMap((d) =>
                  identifiers32(d, "declarationNumber")
                    .filter(verified32)
                    .map((f) => text32(f.field.current.value)),
                ),
              ).size > 1
            )
              return false;
          }
          return true;
        }),
      guard = [
        ...why.filter(
          (w) =>
            !reportedDocumentScope ||
            !same ||
            w !==
              "전체 선적 범위가 양쪽 원문에서 확인되지 않았거나 부분/동시포장 범위입니다.",
        ),
        ...(!fs.every(verified32)
          ? ["수치/단위의 근거 미확인 또는 사용자 수정값이 포함됩니다."]
          : []),
      ];
    add(
      scope,
      id,
      category,
      fs,
      guard.length
        ? same
          ? "provisional_match"
          : "provisional_mismatch"
        : same
          ? "confirmed_match"
          : "confirmed_mismatch",
      title,
      `${title}를 같은 단위(${normalized[0]!.unit})로 비교했습니다. ${same ? "수치가 일치합니다." : "수치가 다릅니다."}${reportedDocumentScope ? " 동일 HBL의 명시된 문서 기재값 비교이며 전체 계약 이행/전량 선적을 입증하지 않습니다." : ""}`,
      guard,
      links,
    );
  }
  function rows(d: ShippingDocument) {
    // A manifest may print a complete goods table plus a separate HBL/container
    // allocation table with no goods column. These are different entity types.
    // Native completeness proves no unextracted goods rows are being dropped.
    const cargoOnly = d.detectedType === "house_manifest" && d.items.length > 0 &&
      d.factCoverage?.items.complete && d.items.every(i=>verified32(ref32(d,"goodsDescription",i.fields.goodsDescription,{itemId:i.id}))) &&
      d.cargoRecords.length > 0 && d.cargoRecords.every(c=>
        !has32(c.fields.goodsDescription) && !has32(c.fields.tradeDescription) &&
        verified32(ref32(d,"houseBlNumber",c.fields.houseBlNumber,{cargoId:c.id}))) &&
      new Set(identifiers32(d,"houseBlNumber").filter(verified32).map(f=>text32(f.field.current.value))).size === 1;
    if (cargoOnly) return d.items.map(i=>({id:i.id,kind:"item" as const,fields:i.fields}));
    if (d.detectedType === "house_manifest" && d.cargoRecords.length)
      return d.cargoRecords.map((c) => ({
        id: c.id,
        kind: "cargo" as const,
        fields: c.fields,
      }));
    return d.items.map((i) => ({
      id: i.id,
      kind: "item" as const,
      fields: i.fields,
    }));
  }
  const rowRef = (
    d: ShippingDocument,
    row: ReturnType<typeof rows>[number],
    name: string,
  ): FieldRef | undefined => {
    if (
      row.kind === "cargo" &&
      !has32(row.fields[name]) &&
      [
        "quantity",
        "quantityUnit",
        "hsCode",
        "netWeight",
        "netWeightUnit",
      ].includes(name) &&
      whole32(d) &&
      scope32(d) === "full"
    ) {
      const description = text32(row.fields.goodsDescription.current.value),
        item = d.items.filter(
          (i) =>
            text32(i.fields.goodsDescription.current.value) === description,
        ),
        cargo = d.cargoRecords.filter(
          (c) =>
            text32(c.fields.goodsDescription.current.value) === description,
        );
      if (
        item.length === 1 &&
        cargo.length === 1 &&
        verified32(
          ref32(d, "goodsDescription", item[0].fields.goodsDescription, {
            itemId: item[0].id,
          }),
        ) &&
        verified32(
          ref32(d, "goodsDescription", row.fields.goodsDescription, {
            cargoId: row.id,
          }),
        )
      )
        return ref32(d, name, item[0].fields[name], { itemId: item[0].id });
    }
    return row.fields[name]
      ? ref32(
          d,
          name,
          row.fields[name],
          row.kind === "cargo" ? { cargoId: row.id } : { itemId: row.id },
        )
      : undefined;
  };
  for (const r of relationships) {
    const a = documents.find((d) => d.id === r.documentIds[0])!,
      b = documents.find((d) => d.id === r.documentIds[1])!,
      scope = pairScope(a, b),
      links = [r.id],
      base = blockers32(a, b, r);
    const duplicateScope = documents.some(
      (d) =>
        d.id !== a.id &&
        d.id !== b.id &&
        [a.detectedType, b.detectedType].includes(d.detectedType) &&
        identifiers32(d, "houseBlNumber").some(
          (f) =>
            verified32(f) &&
            r.evidence.some(
              (e) =>
                e.fieldName === "houseBlNumber" &&
                text32(e.field.current.value) === text32(f.field.current.value),
            ),
        ),
    );
    const numeric = [
      ...blockers32(a, b, r, true),
      ...(duplicateScope
        ? [
            "같은 HBL의 복수 문서 범위가 있어 전체 포함/중복 여부를 확인해야 합니다.",
          ]
        : []),
    ];
    for (const role of [
      "houseBlNumber",
      "declarationNumber",
      "shipmentReference",
    ]) {
      if (role === "declarationNumber") {
        const agreement = declarationAgreement32(a, b);
        const refs = [...identifiers32(a, role), ...identifiers32(b, role)];
        if (agreement.same && refs.every(verified32)) {
          const confirmed = r.status === "evidence_confirmed";
          add(scope, r.id + "/" + role, "reference", refs,
            confirmed ? "confirmed_match" : "provisional_match", label(role),
            "검증된 신고번호의 명시적 목록과 개별 신고의 포함 관계를 대조했습니다. 원본 목록·인용과 선적 범위는 별도로 보존합니다.",
            confirmed ? [] : base, links);
          continue;
        }
      }
      const l = identifiers32(a, role),
        rr = identifiers32(b, role),
        shared = l.find((x) =>
          rr.some(
            (y) =>
              text32(x.field.current.value) === text32(y.field.current.value),
          ),
        );
      const x = shared ?? l[0],
        y = shared
          ? rr.find(
              (y) =>
                text32(shared.field.current.value) ===
                text32(y.field.current.value),
            )
          : rr[0];
      const ambiguous =
        !shared &&
        (new Set(l.map((f) => text32(f.field.current.value))).size > 1 ||
          new Set(rr.map((f) => text32(f.field.current.value))).size > 1)
          ? ["복수 참조 범위가 달라 한 번호를 임의로 선택하지 않습니다."]
          : [];
      if (ambiguous.length) {
        add(
          scope,
          r.id + "/" + role,
          "reference",
          [...l, ...rr],
          "needs_review",
          label(role),
          "참조의 여러 후보를 임의로 선택하지 않습니다.",
          ambiguous,
          links,
        );
        continue;
      }
      if (
        role === "declarationNumber" &&
        !shared &&
        l.length &&
        rr.length &&
        r.sharedRoles.includes("houseBlNumber")
      ) {
        add(
          scope,
          r.id + "/" + role,
          "reference",
          [...l, ...rr],
          "needs_review",
          label(role),
          "같은 HBL에는 여러 신고번호가 연결될 수 있습니다. 해당 신고와 상대 참조의 대응 범위를 확인하며 번호 차이만으로 확정 오류를 생성하지 않습니다.",
          [],
          links,
        );
        continue;
      }
      const identityBasis = r.sharedRoles.some((s) => s !== role);
      const why =
        r.status === "evidence_confirmed"
          ? ambiguous
          : identityBasis && r.conflictRoles.includes(role)
            ? ambiguous
            : [...base, ...ambiguous];
      compare(
        scope,
        r.id + "/" + role,
        "reference",
        [x, y],
        why,
        links,
        label(role),
      );
    }
    for (const role of [
      "shipper",
      "consignee",
      "portOfLoading",
      "portOfDischarge",
      "goodsDescription",
    ]) {
      const left = root32(a, role),
        right = root32(b, role),
        different =
          left &&
          right &&
          text32(left.field.current.value) !==
            text32(right.field.current.value);
      const party = ["shipper", "consignee"].includes(role)
        ? partyMatch32(left, right)
        : null;
      const projectedParty =
        !!party?.certain && party.same === true && !!different;
      const partyGuard =
        party &&
        left &&
        right &&
        different &&
        (!party.certain || party.addressConflict)
          ? ["원문 당사자명과 주소를 구분하거나 주소 차이를 확인해야 합니다."]
          : [];
      const relation =
        role.startsWith("portOf") && left && right
          ? portRelation(left, right, documents)
          : null;
      // Different printed text naming one identified port (UN/LOCODE, local
      // name, exonym, country qualifier) is the same place.
      const mappedPort = relation === "same" && !!different;
      const similarGoods =
        role === "goodsDescription" &&
        left &&
        right &&
        ["partial", "semantic"].includes(
          goodsEquivalent(left.field.current.value, right.field.current.value),
        );
      const representationGuard =
        different &&
        !mappedPort &&
        !(
          role === "goodsDescription" &&
          left &&
          right &&
          goodsEquivalent(
            left.field.current.value,
            right.field.current.value,
          ) === "semantic"
        ) &&
        (role === "goodsDescription" || (role.startsWith("portOf") && relation !== "different"))
          ? [
              "언어·요약·항구명/코드 등 표기 차이일 수 있습니다. 문자열 차이를 물품 또는 항구의 확정 오류로 단정하지 않습니다.",
            ]
          : [];
      compare(
        scope,
        r.id + "/" + role,
        role.startsWith("portOf")
          ? "port"
          : role === "goodsDescription"
            ? "goods"
            : "party",
        [left, right],
        [...base, ...representationGuard, ...partyGuard],
        links,
        mappedPort
          ? label(role) + " · UN/LOCODE 표준화"
          : projectedParty
            ? label(role) + " · 회사명 (주소 제외)"
            : label(role),
        mappedPort || similarGoods || projectedParty ? true : undefined,
      );
    }
    const quantityRef = (d: ShippingDocument, name: string) => {
      const root = root32(d, name);
      if (root) return root;
      if (
        !whole32(d) ||
        d.items.length !== 1 ||
        !d.collectionCoverage?.items.complete ||
        d.collectionCoverage.items.rowCount !== 1
      )
        return undefined;
      const item = d.items[0],
        f = item.fields[name];
      if (
        !f ||
        f.current.status !== "verified" ||
        f.current.source?.scopeBasis !== "entity_row"
      )
        return undefined;
      return ref32(d, name, f, { itemId: item.id });
    };
    for (const [name, unit, category] of [
      ["quantity", "quantityUnit", "quantity"],
      ["packageCount", "packageUnit", "packaging"],
      ["grossWeight", "grossWeightUnit", "weight"],
      ["netWeight", "netWeightUnit", "weight"],
    ] as const)
      number(
        scope,
        r.id + "/" + name,
        category,
        [
          name === "quantity" ? quantityRef(a, name) : root32(a, name),
          name === "quantity" ? quantityRef(b, name) : root32(b, name),
        ],
        [
          name === "quantity" ? quantityRef(a, unit) : root32(a, unit),
          name === "quantity" ? quantityRef(b, unit) : root32(b, unit),
        ],
        numeric,
        links,
        name === "quantity"
          ? "기재 물품 수량 (합계/단일품목 범위)"
          : "문서 전체 " + label(name),
      );
    const ac = containerViews32(a).sort((a, b) => a.id.localeCompare(b.id)),
      bc = containerViews32(b).sort((a, b) => a.id.localeCompare(b.id));
    const containerSets = [
      ac.map((c) =>
        ref32(a, "containerNumber", c.containerNumber, containerEntry32(c)),
      ),
      bc.map((c) =>
        ref32(b, "containerNumber", c.containerNumber, containerEntry32(c)),
      ),
    ];
    if (containerSets.every((s) => s.length)) {
      const equalSets =
        [...new Set(containerSets[0].map((f) => text32(f.field.current.value)))]
          .sort()
          .join("|") ===
        [...new Set(containerSets[1].map((f) => text32(f.field.current.value)))]
          .sort()
          .join("|");
      const proven =
        [a, b].every((d) => d.collectionCoverage?.containers.complete) &&
        containerSets.every(
          (s) =>
            s.every(verified32) &&
            new Set(s.map((f) => text32(f.field.current.value))).size ===
              s.length,
        );
      const why = [
        ...numeric,
        ...(!proven
          ? ["원문 컨테이너 표의 전체 행 포함을 입증하지 못했습니다."]
          : []),
      ];
      add(
        scope,
        r.id + "/containers",
        "container",
        containerSets.flat(),
        !why.length
          ? equalSets
            ? "confirmed_match"
            : "confirmed_mismatch"
          : equalSets
            ? "provisional_match"
            : "needs_review",
        "컨테이너 목록",
        equalSets
          ? "해당 범위의 컨테이너 목록이 일치합니다."
          : "컨테이너 목록이 다릅니다. 행 누락 또는 다른 화물 범위를 확인해 주세요.",
        why,
        links,
      );
    } else
      add(
        scope,
        r.id + "/containers",
        "container",
        containerSets.flat(),
        "insufficient_information",
        "컨테이너 목록",
        "한쪽에 컨테이너 정보가 없습니다.",
        base,
        links,
      );
    for (const ca of ac) {
      const matches = bc.filter(
        (cb) =>
          has32(cb.containerNumber) &&
          text32(cb.containerNumber.current.value) ===
            text32(ca.containerNumber.current.value),
      );
      const duplicate =
        ac.filter(
          (c) =>
            text32(c.containerNumber.current.value) ===
            text32(ca.containerNumber.current.value),
        ).length > 1;
      if (matches.length !== 1 || duplicate) {
        if (matches.length || duplicate)
          add(
            scope,
            r.id + "/container/" + ca.id,
            "container",
            [
              ref32(a, "containerNumber", ca.containerNumber, {
                containerId: ca.id,
              }),
            ],
            "needs_review",
            "중복 컨테이너 대응",
            "중복 번호 또는 복수 후보를 임의 매칭하지 않습니다.",
            base,
            links,
          );
        continue;
      }
      (r.entityLinks ??= []).push({
        id: key32(r.id, "container", ca.id + "/" + matches[0].id),
        leftDocumentId: a.id,
        leftKind: ca.kind,
        leftId: ca.id,
        rightDocumentId: b.id,
        rightKind: matches[0].kind,
        rightId: matches[0].id,
        status:
          r.status === "evidence_confirmed" &&
          verified32(ref32(a, "containerNumber", ca.containerNumber)) &&
          verified32(ref32(b, "containerNumber", matches[0].containerNumber))
            ? "evidence_confirmed"
            : "proposed",
        reason:
          "같은 선적 관계에서 유일한 동일 컨테이너 번호를 대응했습니다. 포장/중량 범위는 별도로 검사합니다.",
      });
      const cb = matches[0],
        prefix =
          r.id + "/container/" + text32(ca.containerNumber.current.value),
        left = (key: Exclude<keyof typeof ca, "id" | "sealNumbers" | "kind">) =>
          ref32(a, key, ca[key], containerEntry32(ca)),
        right = (
          key: Exclude<keyof typeof cb, "id" | "sealNumbers" | "kind">,
        ) => ref32(b, key, cb[key], containerEntry32(cb));
      const anchorGuard = [
        ...numeric,
        ...(![left("containerNumber"), right("containerNumber")].every(
          verified32,
        )
          ? ["컨테이너 식별자의 근거를 확인해야 합니다."]
          : []),
      ];
      number(
        scope,
        prefix + "/packages",
        "packaging",
        [left("packageCount"), right("packageCount")],
        [left("packageUnit"), right("packageUnit")],
        anchorGuard,
        links,
        `컨테이너 ${ca.containerNumber.current.value} 포장 개수`,
        true,
      );
      number(
        scope,
        prefix + "/weight",
        "weight",
        [left("grossWeight"), right("grossWeight")],
        [left("weightUnit"), right("weightUnit")],
        anchorGuard,
        links,
        `컨테이너 ${ca.containerNumber.current.value} 총중량`,
        true,
      );
      const seals = (c: typeof ca) =>
        new Set((c.sealNumbers ?? []).filter(has32).map((f) => text32(f.current.value))).size;
      const multiple = seals(ca) > 1 || seals(cb) > 1;
      compare(
        scope,
        prefix + "/seal",
        "container",
        [left("sealNumber"), right("sealNumber")],
        [
          ...base,
          ...(![left("containerNumber"), right("containerNumber")].every(
            verified32,
          )
            ? ["컨테이너 식별자의 근거를 확인해야 합니다."]
            : []),
          ...(multiple
            ? ["복수 Seal의 전체 집합과 순서를 확인해야 합니다."]
            : []),
        ],
        links,
        `컨테이너 ${ca.containerNumber.current.value} Seal`,
      );
    }
    const ar = rows(a),
      br = rows(b);
    for (const ra of ar) {
      const description = rowRef(a, ra, "goodsDescription"),
        name = text32(description?.field.current.value),
        matches = br.filter(
          (row) =>
            name &&
            (text32(row.fields.goodsDescription.current.value) === name ||
              (r.status === "evidence_confirmed" &&
                ["partial", "semantic"].includes(
                  goodsEquivalent(
                    description?.field.current.value,
                    row.fields.goodsDescription.current.value,
                  ),
                ) &&
                !!ra.fields.hsCode &&
                !!row.fields.hsCode &&
                verified32(rowRef(a, ra, "hsCode")!) &&
                verified32(rowRef(b, row, "hsCode")!) &&
                text32(ra.fields.hsCode.current.value) ===
                  text32(row.fields.hsCode.current.value))),
        ),
        dups =
          ar.filter(
            (row) =>
              name &&
              text32(row.fields.goodsDescription.current.value) === name,
          ).length > 1;
      if (matches.length !== 1 || dups) {
        add(
          scope,
          r.id + "/goods/" + ra.id,
          "goods",
          description ? [description] : [],
          "needs_review",
          "품목 대응",
          matches.length || dups
            ? "동일 품명의 복수 화물행을 임의로 일대일 연결하지 않습니다."
            : "대응 품목을 유일하게 확인하지 못했습니다. 표준화된 전체 품명·HS·화물 배분을 확인해 주세요.",
          base,
          links,
        );
        continue;
      }
      const rb = matches[0],
        partialName =
          goodsEquivalent(
            description?.field.current.value,
            rb.fields.goodsDescription.current.value,
          ) === "partial",
        descB = rowRef(b, rb, "goodsDescription"),
        hsA = rowRef(a, ra, "hsCode"),
        hsB = rowRef(b, rb, "hsCode"),
        hsConflict =
          hsA &&
          hsB &&
          has32(hsA.field) &&
          has32(hsB.field) &&
          text32(hsA.field.current.value) !== text32(hsB.field.current.value),
        guard = [
          ...numeric,
          ...(partialName
            ? [
                "영문 핵심 품명과 HS는 대응하지만 전체 설명은 부분 일치입니다. 규격/번역을 확인해 주세요.",
              ]
            : []),
          ...(hsConflict
            ? ["같은 품명이지만 HS 식별자가 달라 품목 대응을 확인해야 합니다."]
            : []),
          ...(![description, descB].every((f) => !!f && verified32(f))
            ? ["품명/화물행의 근거를 확인해야 합니다."]
            : []),
        ],
        prefix = r.id + "/goods/" + name;
      (r.entityLinks ??= []).push({
        id: key32(r.id, "goods", ra.id + "/" + rb.id),
        leftDocumentId: a.id,
        leftKind: ra.kind,
        leftId: ra.id,
        rightDocumentId: b.id,
        rightKind: rb.kind,
        rightId: rb.id,
        status:
          r.status === "evidence_confirmed" &&
          description &&
          descB &&
          verified32(description) &&
          verified32(descB) &&
          !hsConflict &&
          !partialName
            ? "evidence_confirmed"
            : "proposed",
        reason:
          "같은 선적의 유일한 전체 품명 대응입니다. 중복 품명/HS 차이는 확정 매칭하지 않습니다.",
      });
      compare(
        scope,
        prefix + "/name",
        "goods",
        [description, descB],
        partialName ? [...base, "전체 품명은 부분 의미 일치입니다."] : base,
        links,
        `품목 ${description!.field.current.value} 품명`,
        partialName ? true : undefined,
      );
      compare(
        scope,
        prefix + "/hs",
        "goods",
        [hsA, hsB],
        hsConflict
          ? [...base, "HS 차이가 있는 품목 대응은 잠정 상태입니다."]
          : base,
        links,
        `품목 ${name} HS Code`,
      );
      if (
        hsA &&
        hsB &&
        hsSix(hsA.field.current.value) &&
        hsSix(hsA.field.current.value) === hsSix(hsB.field.current.value) &&
        text32(hsA.field.current.value) !== text32(hsB.field.current.value)
      )
        compare(
          scope,
          prefix + "/hs6",
          "goods",
          [hsA, hsB],
          base,
          links,
          `품목 ${name} HS 공통 6단위 (전체 세번과 구분)`,
          true,
        );
      for (const [value, unit, category] of [
        ["quantity", "quantityUnit", "quantity"],
        ["packageCount", "packageUnit", "packaging"],
        ["grossWeight", "grossWeightUnit", "weight"],
        ["netWeight", "netWeightUnit", "weight"],
      ] as const)
        number(
          scope,
          prefix + "/" + value,
          category,
          [rowRef(a, ra, value), rowRef(b, rb, value)],
          [rowRef(a, ra, unit), rowRef(b, rb, unit)],
          guard,
          links,
          `품목 ${description!.field.current.value} ${label(value)}`,
        );
    }
    // BL totals against a complete, disjoint set of Manifest rows for that HBL.
    const bl =
        a.detectedType === "house_bl"
          ? a
          : b.detectedType === "house_bl"
            ? b
            : null,
      manifest =
        a.detectedType === "house_manifest"
          ? a
          : b.detectedType === "house_manifest"
            ? b
            : null;
    if (bl && manifest && manifest.cargoRecords.length) {
      const blid = root32(bl, "houseBlNumber"),
        cargo = [...manifest.cargoRecords]
          .sort((a, b) => a.id.localeCompare(b.id))
          .filter(
            (c) =>
              blid &&
              text32(c.fields.houseBlNumber.current.value) ===
                text32(blid.field.current.value),
          );
      for (const row of cargo)
        (r.entityLinks ??= []).push({
          id: key32(r.id, "hbl_cargo", row.id),
          leftDocumentId: bl.id,
          leftKind: "document",
          leftId: bl.id,
          rightDocumentId: manifest.id,
          rightKind: "cargo",
          rightId: row.id,
          status:
            r.status === "evidence_confirmed" &&
            blid &&
            verified32(blid) &&
            verified32(
              ref32(manifest, "houseBlNumber", row.fields.houseBlNumber, {
                cargoId: row.id,
              }),
            )
              ? "evidence_confirmed"
              : "proposed",
          reason:
            "해당 화물행의 명시적 HBL 참조를 원본 HBL에 연결했습니다. 합산 범위는 별도 검증합니다.",
        });
      // Records that only list members of one native manifest row are views of
      // that row; the row's amounts are counted once.
      const rowKey = (c: (typeof cargo)[number]) => {
        const src = c.fields.houseBlNumber.current.source;
        return src?.layout ? `${src.page}/${src.layout.tableId}/${src.layout.rowId}` : c.id;
      };
      const rows = cargo.filter((c, i) => cargo.findIndex((o) => rowKey(o) === rowKey(c)) === i);
      if (rows.length) {
        const containers = rows.map((c) =>
          ref32(manifest, "containerNumber", c.fields.containerNumber, {
            cargoId: c.id,
          }),
        );
        const disjoint =
          rows.length === 1 ||
          (containers.every(verified32) &&
          new Set(containers.map((f) => text32(f.field.current.value))).size ===
            rows.length);
        for (const [name, unit, kind] of [
          ["packageCount", "packageUnit", "packaging"],
          ["grossWeight", "grossWeightUnit", "weight"],
        ] as const) {
          const total = root32(bl, name),
            totalUnit = root32(bl, unit),
            values = rows.map((c) =>
              ref32(manifest, name, c.fields[name], { cargoId: c.id }),
            ),
            units = rows.map((c) =>
              ref32(manifest, unit, c.fields[unit], { cargoId: c.id }),
            ),
            ids = rows.map((c) =>
              ref32(manifest, "houseBlNumber", c.fields.houseBlNumber, {
                cargoId: c.id,
              }),
            ),
            all = [
              ...(total ? [total] : []),
              ...(totalUnit ? [totalUnit] : []),
              ...values,
              ...units,
              ...ids,
              ...containers,
            ];
          const ns = [totalUnit, ...units].map((f) =>
              unit32(f?.field.current.value, kind),
            ),
            validUnits =
              ns.every((n) => n !== null) &&
              new Set(ns.map((n) => n?.unit)).size === 1;
          // A B/L and its own manifest row state the same HBL shipment, so
          // the contract-level "no partial shipment" proof is not needed;
          // an explicit partial or co-packed scope still blocks.
          const explicitScope = [bl, manifest].some((d) =>
            ["partial", "combined_packages"].includes(scope32(d)),
          );
          const why = [
            ...blockers32(bl, manifest, r, true).filter(
              (w) =>
                !w.startsWith("여러 HBL") &&
                (explicitScope || !w.startsWith("전체 선적 범위")),
            ),
            ...(!whole32(bl)
              ? ["HBL 문서 자체의 참조 범위를 확인해야 합니다."]
              : []),
            ...(documents.some(
              (d) =>
                d.id !== bl.id &&
                d.classificationStatus === "classified" &&
                d.detectedType === "house_bl" &&
                identifiers32(d, "houseBlNumber")
                  .filter(verified32)
                  .some(
                    (f) =>
                      blid &&
                      text32(f.field.current.value) ===
                        text32(blid.field.current.value),
                  ),
            )
              ? [
                  "같은 HBL의 복수 원본/버전이 있어 해당 합계의 전체 범위를 확인해야 합니다.",
                ]
              : []),
            ...(manifest.cargoRecords.some(
              (row) =>
                !cargo.some((c) => c.id === row.id) &&
                containers.some(
                  (c) =>
                    text32(c.field.current.value) ===
                    text32(row.fields.containerNumber.current.value),
                ),
            )
              ? [
                  "다른 HBL이 같은 컨테이너를 사용합니다. 공동 포장/중량 배분이 명시되지 않아 합계를 확정하지 않습니다.",
                ]
              : []),
            ...(!manifest.collectionCoverage?.cargoRecords.complete
              ? ["Manifest 화물표 전체 행의 포함 여부가 미확인입니다."]
              : []),
            ...(!disjoint
              ? [
                  "같은 컨테이너의 중복/동시포장 또는 배분 범위가 불명확해 합산하지 않습니다.",
                ]
              : []),
          ];
          if (
            !disjoint ||
            !manifest.collectionCoverage?.cargoRecords.complete
          ) {
            add(
              scope,
              r.id + "/aggregate/" + name,
              kind,
              all,
              "needs_review",
              "HBL별 화물행 " + label(name) + " 합계",
              "중복·범위 확인 전에는 합산하지 않습니다.",
              why,
              links,
            );
            continue;
          }
          if (
            !total ||
            !totalUnit ||
            values.some((v) => !has32(v.field)) ||
            !validUnits
          ) {
            add(
              scope,
              r.id + "/aggregate/" + name,
              kind,
              all,
              "insufficient_information",
              "HBL별 화물행 " + label(name) + " 합계",
              "합산할 수치 또는 호환 단위 정보가 부족합니다.",
              why,
              links,
            );
            continue;
          }
          const sum = values.reduce(
              (s, v, i) =>
                s + Number(v.field.current.value) * ns[i + 1]!.factor,
              0,
            ),
            n = Number(total.field.current.value) * ns[0]!.factor,
            equal = Math.abs(sum - n) <= Math.max(1, sum, n) * 1e-9,
            // Container numbers only prove disjoint rows; one row needs none.
            proof = rows.length === 1 ? all.filter((f) => !containers.includes(f)) : all,
            safe = !why.length && proof.every(verified32);
          add(
            scope,
            r.id + "/aggregate/" + name,
            kind,
            all,
            safe
              ? equal
                ? "confirmed_match"
                : "confirmed_mismatch"
              : equal
                ? "provisional_match"
                : "provisional_mismatch",
            "HBL별 화물행 " + label(name) + " 합계",
            "동일 HBL의 서로 다른 컨테이너 화물행을 중복 없이 합산해 명시된 HBL 합계와 비교했습니다.",
            [
              ...why,
              ...(!proof.every(verified32)
                ? ["원문 미확인 또는 사용자 수정값이 포함됩니다."]
                : []),
            ],
            links,
            [
              {
                documentId: manifest.id,
                value: sum,
                unit: ns[0]!.unit,
                formula: "sum",
                componentKeys: rows.map((c) =>
                  key32(manifest.id, "rows", c.id),
                ),
              },
            ],
          );
        }
      }
    }
  }
  // A declaration prints no HBL. When the manifest rows of a B/L-linked HBL
  // list verified declaration numbers and an uploaded declaration's number is
  // on no manifest row at all, both numbers are shown for review. Never
  // confirmed: nothing in the sources proves that declaration is this shipment.
  for (const decl of documents.filter(
    (d) => d.detectedType === "export_declaration" && d.classificationStatus === "classified",
  )) {
    const own = identifiers32(decl, "declarationNumber").filter(verified32);
    const ownValues = new Set(own.flatMap(identifierValues32));
    if (ownValues.size !== 1 || identifiers32(decl, "houseBlNumber").some(verified32)) continue;
    for (const r of relationships) {
      if (r.status !== "evidence_confirmed") continue;
      const pair = r.documentIds.map((id) => documents.find((d) => d.id === id));
      const bl = pair.find((d) => d?.detectedType === "house_bl"),
        m = pair.find((d) => d?.detectedType === "house_manifest");
      if (!bl || !m || m.classificationStatus !== "classified") continue;
      const rowNumbers = (rows: typeof m.cargoRecords) =>
        rows.flatMap((c) =>
          c.fields.declarationNumber && has32(c.fields.declarationNumber)
            ? [ref32(m, "declarationNumber", c.fields.declarationNumber, { cargoId: c.id })]
            : [],
        ).filter(verified32);
      if (rowNumbers(m.cargoRecords).some((f) => identifierValues32(f).some((v) => ownValues.has(v)))) continue;
      const hbls = new Set(
        identifiers32(bl, "houseBlNumber").filter(verified32).map((f) => text32(f.field.current.value)),
      );
      const listed = rowNumbers(
        m.cargoRecords.filter(
          (c) =>
            hbls.has(text32(c.fields.houseBlNumber.current.value)) &&
            verified32(ref32(m, "houseBlNumber", c.fields.houseBlNumber, { cargoId: c.id })),
        ),
      );
      if (!listed.length) continue;
      add(
        pairScope(decl, m),
        key32(decl.id, "listed-declaration", m.id),
        "reference",
        [...own, ...listed],
        "provisional_mismatch",
        "수출신고번호",
        "적하목록에서 이 House B/L 행에 적힌 수출신고번호가 올린 수출신고필증의 번호와 다릅니다.",
        [
          "수출신고필증에는 House B/L 번호가 없어 이 신고필증이 같은 화물인지 원문으로 입증할 수 없습니다. 적하목록의 신고번호 또는 올린 신고필증이 맞는지 확인해 주세요.",
        ],
        [r.id],
      );
    }
  }
  let triangleStatus: NonNullable<ShippingReview["triangleStatus"]> =
    new Set(documents.map((d) => d.detectedType).filter(Boolean)).size < 3
      ? "insufficient_documents"
      : "not_comparable";
  // Only three-way cliques are eligible. Connectivity/transitivity alone cannot
  // turn three unrelated documents into a triangle, or combine repeated groups.
  for (const bl of documents.filter((d) => d.detectedType === "house_bl"))
    for (const ed of documents.filter(
      (d) => d.detectedType === "export_declaration",
    ))
      for (const mf of documents.filter(
        (d) => d.detectedType === "house_manifest",
      )) {
        const trio = [bl, ed, mf],
          links = relationships.filter((r) =>
            r.documentIds.every((id) => trio.some((d) => d.id === id)),
          );
        if (
          links.length !== 3 ||
          links.some((r) => r.status !== "evidence_confirmed")
        )
          continue;
        const sharedHbl = identifiers32(bl, "houseBlNumber")
          .filter(verified32)
          .filter((f) =>
            [ed, mf].every((d) =>
              identifiers32(d, "houseBlNumber")
                .filter(verified32)
                .some(
                  (g) =>
                    text32(g.field.current.value) ===
                    text32(f.field.current.value),
                ),
            ),
          );
        if (
          new Set(sharedHbl.map((f) => text32(f.field.current.value))).size !==
          1
        )
          continue;
        triangleStatus = "performed";
        const prefix = trio
            .map((d) => d.id)
            .sort()
            .join("|"),
          linkIds = links.map((r) => r.id);
        compare(
          "triangle",
          prefix + "/hbl",
          "reference",
          trio.map((d) =>
            identifiers32(d, "houseBlNumber").find(
              (f) =>
                text32(f.field.current.value) ===
                text32(sharedHbl[0].field.current.value),
            ),
          ),
          [],
          linkIds,
          "검증된 공통 HBL 참조",
        );
        const duplicateDeclarations =
          documents.filter(
            (d) =>
              d.classificationStatus === "classified" &&
              d.detectedType === "export_declaration" &&
              identifiers32(d, "houseBlNumber").some(
                (f) =>
                  text32(f.field.current.value) ===
                  text32(sharedHbl[0].field.current.value),
              ),
          ).length > 1;
        const guard = [
          ...(trio.some((d) => scope32(d) !== "full")
            ? ["부분/미확인/동시포장 범위입니다."]
            : []),
          ...(trio.some((d) => !whole32(d))
            ? ["복수 HBL 문서의 전체 합계를 직접 비교하지 않습니다."]
            : []),
          ...(duplicateDeclarations
            ? [
                "복수 신고의 중복/분할 범위를 확인해야 합니다. 신고 합계를 자동 합산하지 않습니다.",
              ]
            : []),
        ];
        for (const [v, u, kind] of [
          ["packageCount", "packageUnit", "packaging"],
          ["grossWeight", "grossWeightUnit", "weight"],
        ] as const)
          number(
            "triangle",
            prefix + "/" + v,
            kind,
            trio.map((d) => root32(d, v)),
            trio.map((d) => root32(d, u)),
            guard,
            linkIds,
            "3종 공통 " + label(v),
          );
      }
  for (const r of relationships)
    r.entityLinks?.sort((a, b) => a.id.localeCompare(b.id));
  checks.push(...declarationGroupChecks(documents, relationships, options.semantic));
  checks.push(...declarationAllocations(documents, checks));
  checks.sort((a, b) => a.id.localeCompare(b.id));
  const summary = {
    matches: checks.filter((c) => c.assessment === "confirmed_match").length,
    confirmedMismatches: checks.filter(
      (c) => c.assessment === "confirmed_mismatch",
    ).length,
    provisional: checks.filter((c) => c.assessment.startsWith("provisional_"))
      .length,
    needsReview: checks.filter((c) => c.assessment === "needs_review").length,
    insufficient: checks.filter(
      (c) => c.assessment === "insufficient_information",
    ).length,
    notComparable: checks.filter((c) => c.assessment === "not_comparable")
      .length,
    confirmedRelationships: relationships.filter(
      (r) => r.status === "evidence_confirmed",
    ).length,
    userConfirmedRelationships: relationships.filter(
      (r) => r.status === "user_confirmed",
    ).length,
    proposedRelationships: relationships.filter((r) => r.status === "proposed")
      .length,
    conflictingRelationships: relationships.filter(
      (r) => r.status === "conflict",
    ).length,
    pairChecks: checks.filter((c) => c.scope !== "triangle").length,
    triangleChecks: checks.filter((c) => c.scope === "triangle").length,
  };
  return withSemanticReview(withFactReview(
    {
      status: checks.length
        ? checks.every((c) => c.assessment === "confirmed_match")
          ? "complete"
          : "needs_review"
        : "not_performed",
      checks,
      relationships,
      pairStatus: relationships.length ? "performed" : "not_performed",
      triangleStatus,
      summary,
      reason:
        documents.length < 2
          ? "분석된 대상 서류가 부족합니다."
          : triangleStatus === "performed"
            ? "검증된 공통 연결 범위에 한해 삼각대조를 실행했습니다."
            : triangleStatus === "insufficient_documents"
              ? "2종 양자대조를 실행합니다. 삼각대조 대상 3종은 부족합니다."
              : "3종 문서가 있지만 공통 HBL과 모든 양자 연결의 근거를 확정하지 못해 삼각대조를 보류했습니다.",
    },
    documents, options.semantic,
  ), documents, options.semantic);
}
