import { linkDeclarationDependencies } from "./dependency-causes";
import { directHsConflicts } from "./direct-hs-conflicts";
import type { SemanticReport } from "./semantic-schema";
import { goodsComparisonValue } from "./goods-context";
import type { ShippingDocument } from "./schema";
import type {
  ShippingReview,
  ShippingCheck,
  ShippingAssessment,
} from "./review-model";
import {
  resolveHblFact,
  factHbl,
  numericMeaning,
  type NumericMeaning,
  type FactReason,
  type ShipmentFact,
} from "./facts";
import {
  identifiers32,
  identifierValues32,
  root32,
  ref32,
  refKey32,
  has32,
  text32,
  verified32,
  type FieldRef,
} from "./review-evidence";
import { resolveDeclarationScopes } from "./declaration-scope";
import { directGoodsConflicts } from "./direct-goods-conflicts";
import { withReviewIssues } from "./issues";
import { compareGoods } from "./goods-semantics";
import { contextualPort } from "./port-context";
import { hsSix, goodsCore } from "./equivalence";
import { shippingValues } from "./fields";
import { partyMatch32 } from "./parties";
const subject = (c: ShippingCheck, meaning: string) =>
  c.category === "container"
    ? meaning === "sealNumber"
      ? /seal/i.test(c.title ?? "")
      : meaning === "containerNumber" && !/seal/i.test(c.title ?? "")
    : c.fields.some((f) => f.fieldName === meaning);
// Aggregate quantity checks carry reference and goods fields as prerequisites;
// their subject is still quantity, not the first prerequisite in the array.
const originalMeaning=(c:ShippingCheck)=>c.category==='quantity'&&c.fields.some(f=>f.fieldName==='quantity')?'quantity':c.fields.find(f=>!f.fieldName.endsWith('Unit'))?.fieldName??c.category;
const titles: Record<string, string> = {
  houseBlNumber: "검증된 공통 HBL 참조",
  declarationNumber: "수출신고 참조",
  containerNumber: "컨테이너 목록",
  sealNumber: "Seal 번호",
  portOfLoading: "선적항 / POL",
  portOfDischarge: "양하항 / POD",
  goodsDescription: "화물 품명 의미",
  hsCode: "HS 공통 6단위 (전체 세번과 구분)",
  shipper: "Shipper / 송하인",
  consignee: "Consignee / 수하인",
};
const codes: Record<FactReason, string> = {
  FIELD_NOT_EXTRACTED: "비교에 필요한 값 또는 단위가 추출되지 않았습니다.",
  FIELD_NOT_APPLICABLE: "서류별 고유항목으로 대조 대상이 없습니다.",
  EVIDENCE_UNVERIFIED: "해당 필드/행의 실제 원문 근거를 확인하지 못했습니다.",
  USER_EDITED: "사용자 수정값은 원문 검증 성공과 구분합니다.",
  SCOPE_UNRESOLVED: "HBL 기재 화물의 전체 포함 범위를 입증하지 못했습니다.",
  UNIT_INCOMPATIBLE: "의미가 같은 호환 단위가 아닙니다.",
  RELATIONSHIP_UNVERIFIED: "검증된 같은 선적 연결이 부족하거나 충돌합니다.",
  PARTIAL_SHIPMENT: "부분선적 또는 배분 범위입니다.",
  COMBINED_PACKAGES: "공동포장/중량 배분을 확인해야 합니다.",
  DUPLICATE_CARGO: "화물/원본의 중복을 배제하지 못했습니다.",
  AGGREGATION_INCOMPLETE:
    "실제 PDF 전체 행과 계산 구성행의 포함을 확인하지 못했습니다.",
  SOURCE_CONFLICT: "같은 의미의 원문 기재값이 서로 충돌합니다.",
  DECLARATION_SCOPE_UNRESOLVED: "복수 신고의 포함/배분 범위를 확인해야 합니다.",
};
const roots = (d: ShippingDocument, role: string, hbl: string): FieldRef[] => {
  if (role === "houseBlNumber" || role === "declarationNumber")
    return identifiers32(d, role).filter(
      (f) =>
        has32(f.field) &&
        (role !== "houseBlNumber" || text32(f.field.current.value) === hbl),
    );
  const rs: FieldRef[] = [];
  if (factHbl(d) === hbl) {
    const f = root32(d, role);
    if (f) rs.push(f);
  }
  for (const c of d.cargoRecords)
    if (
      text32(c.fields.houseBlNumber.current.value) === hbl &&
      verified32(
        ref32(d, "houseBlNumber", c.fields.houseBlNumber, { cargoId: c.id }),
      ) &&
      has32(c.fields[role])
    )
      rs.push(ref32(d, role, c.fields[role], { cargoId: c.id }));
  if (factHbl(d) === hbl) {
    if (role === "containerNumber")
      for (const c of d.containers)
        if (has32(c.containerNumber))
          rs.push(ref32(d, role, c.containerNumber, { containerId: c.id }));
    if (role === "sealNumber")
      for (const c of d.containers)
        for (const f of c.sealNumbers?.length ? c.sealNumbers : [c.sealNumber])
          if (has32(f)) rs.push(ref32(d, role, f, { containerId: c.id }));
    if (role === "goodsDescription" || role === "hsCode")
      for (const i of d.items)
        if (has32(i.fields[role]))
          rs.push(ref32(d, role, i.fields[role], { itemId: i.id }));
  }
  return rs.sort((a, b) => refKey32(a).localeCompare(refKey32(b)));
};
export function withFactReview(
  review: ShippingReview,
  documents: ShippingDocument[],
  semantic?: SemanticReport,
): ShippingReview {
  if (
    !documents.some((d) => d.factCoverage) ||
    review.status === "not_performed"
  )
    return review;
  const primary: ShippingCheck[] = [],
    relations = review.relationships ?? [],
    covered = new Set<string>();
  const grouped = new Map<string, ShippingDocument[]>();
  for (const d of documents)
    for (const h of new Set(
      identifiers32(d, "houseBlNumber")
        .filter(verified32)
        .map((f) => text32(f.field.current.value)),
    ))
      grouped.set(h, [...(grouped.get(h) ?? []), d]);
  const add = (
    ds: ShippingDocument[],
    hbl: string,
    meaning: string,
    category: ShippingCheck["category"],
    refs: FieldRef[],
    assessment: ShippingAssessment,
    reasons: FactReason[],
    facts: ShipmentFact[] = [],
  ) => {
    const links = relations.filter((r) =>
        r.documentIds.every((id) => ds.some((d) => d.id === id)),
      ),
      id =
        "fact35/" +
        encodeURIComponent(hbl) +
        "/" +
        ds
          .map((d) => d.id)
          .sort()
          .map(encodeURIComponent)
          .join("|") +
        "/" +
        meaning;
    const related = review.checks.filter(
      (c) =>
        c.relationshipIds.some((id) => links.some((r) => r.id === id)) &&
        c.category === category &&
        subject(c, meaning),
    );
    if (facts.length)
      for (const c of related) {
        const subjects = c.fields.filter((f) => f.fieldName === meaning);
        const aliases =
          subjects.length > 0 &&
          subjects.every((f) => {
            const fact = facts.find((v) => v.documentId === f.documentId);
            if (!fact) return false;
            if (
              [...fact.refs, ...(fact.unmappedRefs ?? [])].some(
                (v) => refKey32(v) === refKey32(f),
              )
            )
              return true;
            return (
              fact.reasons.length === 0 &&
              fact.refs.length === 1 &&
              verified32(f) &&
              f.field.current.value === fact.refs[0].field.current.value &&
              (ds.find((d) => d.id === f.documentId)?.factCoverage?.items.rows
                .length === 1 ||
                !!f.cargoId) &&
              !!f.field.current.source?.layout?.tableId
            );
          });
        if (aliases) covered.add(c.id);
      }
    else
      for (const c of related) {
        const subjects = c.fields.filter((f) => f.fieldName === meaning);
        if (
          subjects.length &&
          subjects.every((f) => refs.some((v) => refKey32(v) === refKey32(f)))
        )
          covered.add(c.id);
      }
    primary.push({
      id,
      scope:
        ds.length === 3
          ? "triangle"
          : links[0]?.documentIds.length === 2
            ? (review.checks.find((c) =>
                c.relationshipIds.includes(links[0].id),
              )?.scope ?? "document")
            : "document",
      category,
      documentIds: ds.map((d) => d.id).sort(),
      title:
        meaning in numericMeaning
          ? numericMeaning[meaning as NumericMeaning].title
          : (titles[meaning] ?? meaning),
      assessment,
      importance:
        assessment === "confirmed_mismatch"
          ? "high"
          : assessment === "confirmed_match" || assessment === "not_applicable"
            ? "info"
            : "attention",
      fields: [...new Map(refs.map((f) => [refKey32(f), f])).values()].sort(
        (a, b) => refKey32(a).localeCompare(refKey32(b)),
      ),
      relationshipIds: links.map((r) => r.id).sort(),
      explanation: "",
      followUp:
        assessment === "confirmed_match"
          ? "검증된 기재값의 출처와 계산 범위를 확인해 주세요."
          : assessment === "not_applicable"
            ? "해당 문서의 고유정보로 보존합니다."
            : "원본 작성자에게 판정 사유와 해당 HBL/품목/화물 범위를 확인해 주세요.",
      uncertainties: reasons.map((r) => codes[r]),
      comparison: {
        meaning,
        hbl,
        scope: "hbl_record",
        reasonCodes: [...new Set(reasons)].sort(),
        relatedCheckIds: related.map((c) => c.id).sort(),
        facts,
      },
      computedValues: facts
        .filter(
          (f) =>
            f.derivation !== "literal" &&
            f.value !== null &&
            f.reasons.length === 0,
        )
        .map((f) => ({
          documentId: f.documentId,
          value: f.value!,
          unit: f.unit!,
          formula:
            f.derivation === "single_native_row"
              ? ("single_row" as const)
              : ("sum" as const),
          componentKeys: f.componentKeys,
        })),
    });
    primary.at(-1)!.explanation = facts.length
      ? "검증된 원문·전체 표 커버리지·같은 HBL 기재 화물 범위의 정보를 비교했습니다. 행 연결/계산값은 원본 합계 추출과 구분하며 전체 무역계약 이행을 주장하지 않습니다."
      : "같은 의미의 원문 기재값을 같은 선적의 명시적 참조 범위에서 대조했습니다.";
  };
  for (const [hbl, cluster] of [...grouped].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const ds = [...cluster].sort((a, b) => a.id.localeCompare(b.id));
    const clique = (set: ShippingDocument[]) =>
      set.every((a, i) =>
        set
          .slice(i + 1)
          .every((b) =>
            relations.some(
              (r) =>
                r.documentIds.includes(a.id) &&
                r.documentIds.includes(b.id) &&
                r.status === "evidence_confirmed",
            ),
          ),
      );
    const unique = new Set(ds.map((d) => d.detectedType)).size === ds.length;
    const groups =
      unique && ds.length <= 3 && clique(ds)
        ? [ds]
        : relations
            .filter((r) =>
              r.documentIds.every((id) => ds.some((d) => d.id === id)),
            )
            .map((r) => ds.filter((d) => r.documentIds.includes(d.id)));
    for (const group of groups) {
      if (group.length < 2) continue;
      const declarationSubset =
        group.some((d) => d.detectedType === "export_declaration") &&
        (ds.filter(
          (d) =>
            d.classificationStatus === "classified" &&
            d.detectedType === "export_declaration",
        ).length > 1 ||
          group.some(
            (d) =>
              d.detectedType !== "export_declaration" &&
              new Set(
                identifiers32(d, "declarationNumber")
                  .filter(verified32)
                  .flatMap(identifierValues32),
              ).size > 1,
          ));
      const linked = clique(group),
        base: FactReason[] = linked ? [] : ["RELATIONSHIP_UNVERIFIED"];
      for (const meaning of Object.keys(numericMeaning) as NumericMeaning[]) {
        const facts = group.map((d) =>
          resolveHblFact(d, meaning, documents, false, hbl),
        );
        const active = facts.filter((f) =>
          [...f.refs, ...(f.unmappedRefs ?? [])].some(
            (r) => typeof r.field.current.value === "number",
          ),
        );
        const optional = meaning === "netWeight" || meaning === "quantity";
        const reasons = [...base, ...facts.flatMap((f) => f.reasons)],
          refs = facts.flatMap((f) => [...f.refs, ...f.unitRefs]);
        if (optional && active.length < 2) {
          add(
            group,
            hbl,
            meaning,
            numericMeaning[meaning].category,
            refs,
            "not_applicable",
            ["FIELD_NOT_APPLICABLE"],
            facts,
          );
          continue;
        }
        // Quantity is optional on transport forms, mandatory on the declaration.
        const selected = optional ? active : facts;
        const relevant = [...base, ...selected.flatMap((f) => f.reasons)];
        const present =
          selected.length >= 2 && selected.every((f) => f.value !== null);
        const compatible = new Set(selected.map((f) => f.unit)).size === 1;
        const same =
          present &&
          selected.every(
            (f) =>
              Math.abs(f.value! - selected[0].value!) <=
              Math.max(1, Math.abs(f.value!), Math.abs(selected[0].value!)) *
                1e-9,
          );
        const status: ShippingAssessment = relevant.includes(
          "UNIT_INCOMPATIBLE",
        )
          ? "not_comparable"
          : !present
            ? selected.some((f) => f.unmappedRefs?.length)
              ? "needs_review"
              : "insufficient_information"
            : !compatible
              ? "not_comparable"
              : relevant.length
                ? same
                  ? "provisional_match"
                  : "provisional_mismatch"
                : same
                  ? "confirmed_match"
                  : "confirmed_mismatch";
        add(
          group,
          hbl,
          meaning,
          numericMeaning[meaning].category,
          refs,
          status,
          !present
            ? reasons
            : !compatible
              ? [...relevant, "UNIT_INCOMPATIBLE"]
              : relevant,
          facts,
        );
      }
      for (const role of [
        "houseBlNumber",
        "declarationNumber",
        "containerNumber",
        "sealNumber",
        "portOfLoading",
        "portOfDischarge",
        "shipper",
        "consignee",
        "goodsDescription",
        "hsCode",
      ]) {
        const sets = group.map((d) => ({ doc: d, refs: roots(d, role, hbl) }));
        const available = sets.filter((s) => s.refs.length),
          core = [
            "houseBlNumber",
            "containerNumber",
            "sealNumber",
            "portOfLoading",
            "portOfDischarge",
          ].includes(role);
        const category: ShippingCheck["category"] =
          role === "houseBlNumber" || role === "declarationNumber"
            ? "reference"
            : role.includes("portOf")
              ? "port"
              : role === "shipper" || role === "consignee"
                ? "party"
                : role === "goodsDescription" || role === "hsCode"
                  ? "goods"
                  : "container";
        const refs = available.flatMap((s) => s.refs);
        if (
          role === "declarationNumber" &&
          group.every((d) => d.detectedType === "export_declaration")
        ) {
          add(group, hbl, role, category, refs, "not_applicable", [
            "FIELD_NOT_APPLICABLE",
          ]);
          continue;
        }
        if (available.length < 2) {
          add(
            group,
            hbl,
            role,
            category,
            refs,
            core ? "insufficient_information" : "not_applicable",
            core ? [...base, "FIELD_NOT_EXTRACTED"] : ["FIELD_NOT_APPLICABLE"],
          );
          continue;
        }
        const valid = available.map((s) => ({
          ...s,
          verified: s.refs.filter(verified32),
        }));
        const reasons = [...base];
        if (role === "declarationNumber" && valid.some((s) =>
          s.verified.some((f) => !identifierValues32(f).length)))
          reasons.push("EVIDENCE_UNVERIFIED");
        if (valid.some((s) => !s.verified.length))
          reasons.push(
            refs.some((f) => f.field.current.status === "user_edited")
              ? "USER_EDITED"
              : "EVIDENCE_UNVERIFIED",
          );
        if (core && available.length !== group.length)
          reasons.push("FIELD_NOT_EXTRACTED");
        const bound = (f: FieldRef) => {
          const d = documents.find((d) => d.id === f.documentId)!;
          if (role === "hsCode") {
            const goods = group.flatMap((d) =>
              roots(d, "goodsDescription", hbl).filter(verified32),
            );
            if (
              goods.some((f, i) =>
                goods
                  .slice(i + 1)
                  .some(
                    (g) =>
                      f.documentId !== g.documentId &&
                      ["partial", "insufficient"].includes(
                        compareGoods(
                          goodsComparisonValue(f.field),
                          goodsComparisonValue(g.field),
                        ).status,
                      ),
                  ),
              )
            )
              reasons.push("SCOPE_UNRESOLVED");
          }
          if (role === "sealNumber") {
            const c = f.containerId
                ? d.containers.find((c) => c.id === f.containerId)
                : null,
              cargo = f.cargoId
                ? d.cargoRecords.find((c) => c.id === f.cargoId)
                : null;
            const cn = c
              ? ref32(d, "containerNumber", c.containerNumber, {
                  containerId: c.id,
                })
              : cargo
                ? ref32(d, "containerNumber", cargo.fields.containerNumber, {
                    cargoId: cargo.id,
                  })
                : null;
            const ids = roots(d, "containerNumber", hbl)
              .filter(verified32)
              .map((r) => text32(r.field.current.value));
            const owner =
              cn && verified32(cn)
                ? text32(cn.field.current.value)
                : new Set(ids).size === 1 && d.factCoverage?.containers.complete
                  ? ids[0]
                  : null;
            if (!owner) {
              reasons.push("SCOPE_UNRESOLVED");
              return "unbound:" + text32(f.field.current.value);
            }
            return owner + ":" + text32(f.field.current.value);
          }
          if (role === "hsCode") {
            const item = f.itemId
                ? d.items.find((i) => i.id === f.itemId)
                : null,
              cargo = f.cargoId
                ? d.cargoRecords.find((c) => c.id === f.cargoId)
                : null;
            const only =
              d.factCoverage?.items.complete && d.items.length === 1
                ? d.items[0]
                : null;
            const g = item
              ? ref32(d, "goodsDescription", item.fields.goodsDescription, {
                  itemId: item.id,
                })
              : cargo
                ? ref32(d, "goodsDescription", cargo.fields.goodsDescription, {
                    cargoId: cargo.id,
                  })
                : only
                  ? ref32(d, "goodsDescription", only.fields.goodsDescription, {
                      itemId: only.id,
                    })
                  : root32(d, "goodsDescription");
            if (!g || !verified32(g)) {
              reasons.push("SCOPE_UNRESOLVED");
              return "unbound:" + text32(f.field.current.value);
            }
            const owner = goodsCore(goodsComparisonValue(g.field));
            if (!owner) reasons.push("SCOPE_UNRESOLVED");
            return (
              (owner || "unbound") +
              ":" +
              (hsSix(f.field.current.value) ?? text32(f.field.current.value))
            );
          }
          return text32(f.field.current.value);
        };
        const normalize = (f: FieldRef) =>
          role === "sealNumber" || role === "hsCode"
            ? bound(f)
            : role.startsWith("portOf")
              ? (() => { const code = contextualPort(f, group); if (!code) reasons.push("SCOPE_UNRESOLVED"); return code ?? text32(f.field.current.value); })()
              : role === "hsCode"
                ? (hsSix(f.field.current.value) ??
                  text32(f.field.current.value))
                : role === "goodsDescription"
                  ? (() => {
                      const core = goodsCore(goodsComparisonValue(f.field));
                      if (!core) reasons.push("SCOPE_UNRESOLVED");
                      return core || "unbound:" + text32(f.field.current.value);
                    })()
                  : text32(f.field.current.value);
        const ns = valid.map((s) =>
          [...new Set((s.verified.length ? s.verified : s.refs).flatMap((f) =>
            role === "declarationNumber" ? identifierValues32(f) : [normalize(f)]))]
            .sort()
            .join("|"),
        );
        let same = ns.every((n) => n === ns[0]);
        // Equal printed codes can agree without claiming gazetteer coverage.
        // Different unresolved codes/names cannot prove a geographic conflict.
        if (role.startsWith("portOf") && !same && valid.some(s =>
          (s.verified.length ? s.verified : s.refs).some(f => !contextualPort(f, group, true)))) reasons.push("SCOPE_UNRESOLVED");
        let membership = false;
        if (role === "declarationNumber" && declarationSubset) {
          const expected = new Set(
            valid
              .filter((s) => s.doc.detectedType !== "export_declaration")
              .flatMap((s) =>
                s.verified.flatMap(identifierValues32),
              ),
          );
          const actual = valid
            .filter((s) => s.doc.detectedType === "export_declaration")
            .flatMap((s) =>
              s.verified.flatMap(identifierValues32),
            );
          membership =
            expected.size > 1 &&
            actual.length > 0 &&
            actual.every((n) => expected.has(n));
          same = membership;
        }
        if (
          declarationSubset &&
          ["goodsDescription", "hsCode", "containerNumber", "sealNumber"].includes(role)
        )
          reasons.push("DECLARATION_SCOPE_UNRESOLVED");
        if (role === "hsCode") {
          const owners = group.map((d) =>
            roots(d, "goodsDescription", hbl).filter(verified32),
          );
          // HS sets can only be compared on aligned product owners. A different
          // product with the same HS must not create a spurious HS-number error.
          if (
            owners.some((left, i) =>
              owners.some(
                (right, j) =>
                  i !== j &&
                  left.some(
                    (f) =>
                      !right.some(
                        (g) =>
                          goodsCore(goodsComparisonValue(f.field)) ===
                            goodsCore(goodsComparisonValue(g.field)) ||
                          compareGoods(
                            goodsComparisonValue(f.field),
                            goodsComparisonValue(g.field),
                          ).status === "semantic",
                      ),
                  ),
              ),
            )
          )
            reasons.push("SCOPE_UNRESOLVED");
        }
        if (role === "hsCode" && reasons.includes("SCOPE_UNRESOLVED")) {
          const literalSets = valid.map((s) =>
            [
              ...new Set(
                (s.verified.length ? s.verified : s.refs).map(
                  (f) =>
                    hsSix(f.field.current.value) ??
                    text32(f.field.current.value),
                ),
              ),
            ]
              .sort()
              .join("|"),
          );
          if (literalSets[0] && literalSets.every((s) => s === literalSets[0]))
            same = true;
        }
        if (role === "sealNumber") {
          const containers = group.map((d) =>
            [
              ...new Set(
                roots(d, "containerNumber", hbl)
                  .filter(verified32)
                  .map((f) => text32(f.field.current.value)),
              ),
            ]
              .sort()
              .join("|"),
          );
          if (!containers[0] || containers.some((ids) => ids !== containers[0]))
            reasons.push("SCOPE_UNRESOLVED");
        }
        if (role === "goodsDescription" && !same) {
          // Unknown translation or partial descriptions cannot establish a
          // confirmed product conflict merely because canonical strings differ.
          const candidates = valid.flatMap((s) =>
            s.verified.length ? s.verified : s.refs,
          );
          const pairs = candidates.flatMap((f, i) =>
            candidates
              .slice(i + 1)
              .filter((g) => g.documentId !== f.documentId)
              .map(
                (g) =>
                  compareGoods(goodsComparisonValue(f.field), goodsComparisonValue(g.field))
                    .status,
              ),
          );
          if (
            pairs.length &&
            pairs.every((status) =>
              ["exact", "semantic", "partial"].includes(status),
            )
          )
            same = true;
          if (
            candidates.some((f, i) =>
              candidates
                .slice(i + 1)
                .some((g) =>
                  ["partial", "insufficient"].includes(
                    compareGoods(goodsComparisonValue(f.field), goodsComparisonValue(g.field))
                      .status,
                  ),
                ),
            )
          )
            reasons.push("SCOPE_UNRESOLVED");
        }
        if (role === "shipper" || role === "consignee") {
          const matches = valid
            .slice(1)
            .map((s) => partyMatch32(valid[0].verified[0], s.verified[0]));
          same = matches.every((m) => m.same === true);
          if (matches.some((m) => !m.certain || m.addressConflict))
            reasons.push("SCOPE_UNRESOLVED");
        }
        if (
          role === "goodsDescription" &&
          (valid.some(
            (s) =>
              !(s.doc.items.length
                ? s.doc.factCoverage?.items.complete
                : s.doc.factCoverage?.cargoRecords.complete),
          ) ||
            valid.some((s) => {
              const rows = (
                s.doc.items.length ? s.doc.items : s.doc.cargoRecords
              ).map((i) => goodsCore(goodsComparisonValue(i.fields.goodsDescription)));
              return rows.length !== new Set(rows).size;
            }))
        )
          reasons.push("SCOPE_UNRESOLVED");
        add(
          group,
          hbl,
          role,
          category,
          valid.flatMap((s) => (s.verified.length ? s.verified : s.refs)),
          reasons.length
            ? same
              ? "provisional_match"
              : "provisional_mismatch"
            : same
              ? "confirmed_match"
              : "confirmed_mismatch",
          reasons,
        );
        if (membership) {
          primary.at(-1)!.title = "명시된 신고 목록 포함 여부";
          primary.at(-1)!.explanation =
            "HBL의 검증된 전체 신고 목록에 해당 신고번호가 포함됩니다. 개별 신고서를 전체 HBL 품목 집합과 같다고 간주하지 않으며, 합산은 별도의 전체 포함·독립 품목 검사를 따릅니다.";
        }
      }
    }
  }
  // Required document information is separate from optional cross-document fields.
  for (const doc of documents) {
    const required =
      doc.detectedType === "export_declaration"
        ? [
            "declarationNumber",
            "exporter",
            "goodsDescription",
            "hsCode",
            "quantity",
            "quantityUnit",
          ]
        : [
            "houseBlNumber",
            "shipper",
            "consignee",
            "goodsDescription",
            "packageCount",
            "grossWeight",
            "portOfLoading",
            "portOfDischarge",
          ];
    for (const role of required) {
      const refs: FieldRef[] = [];
      const root = root32(doc, role);
      if (root) refs.push(root);
      for (const i of doc.items)
        if (i.fields[role] && has32(i.fields[role]))
          refs.push(ref32(doc, role, i.fields[role], { itemId: i.id }));
      for (const c of doc.cargoRecords)
        if (c.fields[role] && has32(c.fields[role]))
          refs.push(ref32(doc, role, c.fields[role], { cargoId: c.id }));
      for (const c of doc.containers) {
        const f = (
          c as unknown as Record<string, import("./schema").ShippingField>
        )[role];
        if (f && has32(f))
          refs.push(ref32(doc, role, f, { containerId: c.id }));
      }
      if (refs.some(verified32)) continue;
      const present = refs.some((f) => has32(f.field));
      const category: ShippingCheck["category"] = role.includes("Number")
        ? "reference"
        : role === "quantity" || role === "quantityUnit"
          ? "quantity"
          : role === "grossWeight"
            ? "weight"
            : role === "packageCount"
              ? "packaging"
              : role.startsWith("portOf")
                ? "port"
                : role === "goodsDescription" || role === "hsCode"
                  ? "goods"
                  : "party";
      if (
        primary.some(
          (c) =>
            c.category === category &&
            c.comparison?.meaning === role &&
            c.comparison.facts.some((f) => f.documentId === doc.id) &&
            c.assessment !== "not_applicable",
        )
      )
        continue;
      add(
        [doc],
        factHbl(doc) ?? doc.id,
        role,
        category,
        refs,
        present ? "needs_review" : "insufficient_information",
        [present ? "EVIDENCE_UNVERIFIED" : "FIELD_NOT_EXTRACTED"],
      );
      primary.at(-1)!.scope = "document";
      primary.at(-1)!.comparison!.scope = "document_record";
      primary.at(-1)!.title = "문서 필수정보 · " + (titles[role] ?? role);
    }
  }
  // Validate printed totals against independently complete native row totals.
  for (const doc of documents)
    for (const meaning of Object.keys(numericMeaning) as NumericMeaning[]) {
      const fact = resolveHblFact(doc, meaning, documents);
      for (const alt of fact.alternatives ?? [])
        if (
          fact.value !== null &&
          alt.value !== null &&
          fact.unit === alt.unit &&
          alt.reasons.length === 0 &&
          Math.abs(fact.value - alt.value) >
            Math.max(1, Math.abs(fact.value), Math.abs(alt.value)) * 1e-9
        ) {
          add(
            [doc],
            fact.hbl ?? doc.id,
            meaning,
            numericMeaning[meaning].category,
            [...fact.refs, ...fact.unitRefs, ...alt.refs, ...alt.unitRefs],
            "confirmed_mismatch",
            ["SOURCE_CONFLICT"],
            [fact, alt],
          );
          primary.at(-1)!.comparison!.scope = "document_record";
          primary.at(-1)!.id +=
            "/self/" + alt.componentKeys.map(encodeURIComponent).join("|");
          primary.at(-1)!.title =
            "문서 기재 합계와 검증된 행 합계 · " +
            numericMeaning[meaning].title;
        }
    }
  // Preserve uncovered legacy diagnostics and actual failures. Document-specific
  // optional fields with no counterpart are explicitly inapplicable, never errors.
  for (const c of review.checks) {
    if (covered.has(c.id)) continue;

    const optional =
      (c.category === "reference" &&
        c.fields.every((f) => f.fieldName !== "houseBlNumber")) ||
      c.category === "party" ||
      c.category === "goods" ||
      c.fields.some(
        (f) => f.fieldName === "netWeight" || f.fieldName === "netWeightUnit",
      );
    const bothMissing = c.fields.length === 0;
    const secondaryNumeric =
      ["weight", "quantity", "packaging"].includes(c.category) &&
      c.fields.some((f) =>
        primary.some(
          (p) =>
            p.comparison?.scope === "hbl_record" &&
            p.comparison.meaning === f.fieldName &&
            p.comparison.facts.some(
              (fact) =>
                fact.documentId === f.documentId && fact.reasons.length === 0,
            ),
        ),
      );
    const inapplicable =
      c.assessment === "insufficient_information" &&
      (optional || bothMissing || secondaryNumeric) &&
      c.scope !== "document";
    primary.push(
      inapplicable
        ? {
            ...c,
            assessment: "not_applicable",
            importance: "info",
            comparison: {
              meaning: originalMeaning(c),
              hbl: null,
              scope: "original_check",
              reasonCodes: ["FIELD_NOT_APPLICABLE"],
              relatedCheckIds: [c.id],
              facts: [],
            },
            explanation: codes.FIELD_NOT_APPLICABLE,
          }
        : {
            ...c,
            comparison: {
              meaning: originalMeaning(c),
              hbl: null,
              scope: "original_check",
              reasonCodes: c.fields.some(
                (f) => has32(f.field) && !verified32(f),
              )
                ? ["EVIDENCE_UNVERIFIED"]
                : c.assessment === "insufficient_information"
                  ? ["FIELD_NOT_EXTRACTED"]
                  : c.assessment.startsWith("provisional")
                    ? ["SCOPE_UNRESOLVED"]
                    : [],
              relatedCheckIds: [c.id],
              facts: [],
            },
          },
    );
  }
  resolveDeclarationScopes(primary, review.checks, documents, relations, semantic);
  directGoodsConflicts(documents, review, primary);
  directHsConflicts(documents, relations, primary);
  primary.sort((a, b) => a.id.localeCompare(b.id));
  for (const d of documents) {
    if (
      d.extractionStatus === "not_performed" ||
      d.classificationStatus === "classified"
    )
      continue;
    const refs = d.classification
      ? [ref32(d, "documentType", d.classification)]
      : [];
    add([d], "", "documentType", "reference", refs, "needs_review", [
      "EVIDENCE_UNVERIFIED",
    ]);
    primary.at(-1)!.title = "문서 유형의 원문 근거 확인 필요";
  }
  const outcomes = {
    matches: primary.filter((c) => c.assessment === "confirmed_match").length,
    mismatches: primary.filter((c) => c.assessment === "confirmed_mismatch")
      .length,
    review: primary.filter(
      (c) =>
        c.assessment.startsWith("provisional") ||
        c.assessment === "needs_review",
    ).length,
    requiredMissing: primary.filter(
      (c) => c.assessment === "insufficient_information",
    ).length,
    notApplicable: primary.filter((c) => c.assessment === "not_applicable")
      .length,
    notComparable: primary.filter((c) => c.assessment === "not_comparable")
      .length,
    evidenceFailed: documents.reduce(
      (n, d) =>
        n +
        shippingValues(d).filter(
          (f) => f.original.value !== null && f.original.status !== "verified",
        ).length,
      0,
    ),
    evidenceUnverified: documents.reduce(
      (n, d) =>
        n +
        shippingValues(d).filter(
          (f) => f.current.value !== null && f.current.status === "unverified",
        ).length,
      0,
    ),
    evidenceRecovered: documents.reduce(
      (n, d) =>
        n +
        shippingValues(d).filter(
          (f) => f.recovery && f.current.status === "verified",
        ).length,
      0,
    ),
    checksExecuted: review.checks.length,
    independentChecks: primary.length,
  };
  linkDeclarationDependencies(primary,review.checks,documents);
  return withReviewIssues(
    { ...review, primaryChecks: primary, outcomes },
    documents,
  );
}
