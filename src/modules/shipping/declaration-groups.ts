import { goodsCore,hsSix } from "./equivalence";
import { goodsComparisonValue } from "./goods-context";
import { matchProductRows } from './product-matching';
import type { SemanticReport } from './semantic-schema';
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
  identifierValues32,
} from "./review-evidence";
export function declarationGroupChecks(
  docs: ShippingDocument[],
  relations: ShippingRelationship[],
  semantic?: SemanticReport,
): ShippingCheck[] {
  const checks: ShippingCheck[] = [];
  for (const bl of docs.filter((d) => d.detectedType === "house_bl")) {
    const linked = docs.filter(
      (d) =>
        d.detectedType === "export_declaration" &&
        relations.some(
          (r) =>
            r.status === "evidence_confirmed" &&
            (r.sharedRoles.includes("houseBlNumber") ||
              r.sharedRoles.includes("declarationNumber")) &&
            !r.conflictRoles.includes("houseBlNumber") &&
            r.documentIds.includes(bl.id) &&
            r.documentIds.includes(d.id),
        ),
    );
    if (linked.length < 2) continue;
    const own = linked.map((d) => root32(d, "declarationNumber"));
    const expected = new Set(
      identifiers32(bl, "declarationNumber")
        .filter(verified32)
        .flatMap(identifierValues32),
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
      ...identifiers32(bl, "declarationNumber"),
      ...own.filter((f): f is NonNullable<typeof f> => !!f),
      ...refs.flatMap((r) => Object.values(r)),
      ...target.flatMap((r) => Object.values(r)),
    ];
    const blockers: string[] = [];
    if (identifiers32(bl, "declarationNumber").some((f) =>
      !verified32(f) || !identifierValues32(f).length))
      blockers.push("신고 참조 목록의 근거 또는 구성원 구분이 미확인입니다.");
    const blNumbers = new Set(
      identifiers32(bl, "houseBlNumber")
        .filter(verified32)
        .map((f) => text32(f.field.current.value)),
    );
    if (
      docs.some(
        (d) =>
          d.id !== bl.id &&
          d.classificationStatus === "classified" &&
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
    if (
      [bl, ...linked].some(
        (d) =>
          scope32(d) === "partial" ||
          scope32(d) === "combined_packages" ||
          (scope32(d) !== "full" && !d.factCoverage?.items.complete),
      )
    )
      blockers.push("부분선적 또는 전체 신고 포함 범위가 미확인입니다.");
    if (
      [bl, ...linked].some(
        (d) =>
          d.fields.shipmentScope?.current.status === 'user_edited' || (d.fields.shipmentScope?.current.value != null &&
          d.fields.shipmentScope.current.status !== "verified"),
      )
    )
      blockers.push("선적 범위의 사용자 수정 또는 미확인 근거가 있습니다.");
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
    const literalKeys=(rs:typeof refs)=>rs.map(r=>goodsCore(goodsComparisonValue(r.description.field))+"/"+text32(r.hs.field.current.value));
    if([literalKeys(refs),literalKeys(target)].some(keys=>new Set(keys).size!==keys.length))blockers.push("복수 신고 또는 HBL에 중복 품목이 있어 명시적 배분 없이 합산하지 않습니다.");
    if([...refs,...target].some(r=>typeof r.quantity.field.current.value!=='number'||!Number.isFinite(r.quantity.field.current.value)||r.quantity.field.current.value<0||r.quantity.field.current.value>Number.MAX_SAFE_INTEGER))blockers.push('수량의 안전한 숫자 형식을 확인하지 못했습니다.');
    if(docs.some(d=>d.detectedType==='export_declaration'&&d.classificationStatus==='classified'&&!linked.some(v=>v.id===d.id)&&identifiers32(d,'houseBlNumber').some(f=>verified32(f)&&blNumbers.has(text32(f.field.current.value)))))
      blockers.push('같은 검증 HBL의 신고서 일부가 명시된 신고 참조 관계 밖에 있습니다.');
    const structuralBlockerCount=blockers.length;
    const mapping = matchProductRows(refs.map(r=>r.description),target.map(r=>r.description),docs,semantic);
    if (!mapping.complete) blockers.push("HBL 전체 품목 집합과 신고 품목 집합이 정확히 대응하지 않습니다.");
    else if (!mapping.strong) blockers.push("AI 언어 대응은 있으나 유일한 원문 품목 식별자 근거가 부족합니다.");
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
    const rowMismatches:{id:string;delta:number}[]=[];
    // A bad counterpart elsewhere cannot veto an independently proved row.
    // Full declaration membership is still required separately for a total.
    if (bl.classificationStatus==='classified'&&!bl.nativeScopeLimitation&&!["partial","combined_packages"].includes(scope32(bl))&&bl.fields.shipmentScope?.current.status!=='user_edited'&&(bl.fields.shipmentScope?.current.value==null||bl.fields.shipmentScope.current.status==='verified')&&bl.collectionCoverage?.items.complete&&docs.filter(d=>d.detectedType==='house_bl'&&identifiers32(d,'houseBlNumber').some(f=>verified32(f)&&blNumbers.has(text32(f.field.current.value)))).length===1)
      for (const [i, row] of refs.entries()) {
        const mapped = mapping.matches.find(m=>m.left===row.description),
          index = target.findIndex((r) => r.description===mapped?.right),
          matched = target[index];
        const owner=docs.find(d=>d.id===row.description.documentId)!;
        if(!mapped||mapped.proof==='ai_only'||!matched||owner.classificationStatus!=='classified'||owner.nativeScopeLimitation||!owner.collectionCoverage?.items.complete||['partial','combined_packages'].includes(scope32(owner))||owner.fields.shipmentScope?.current.status==='user_edited'||(owner.fields.shipmentScope?.current.value!=null&&owner.fields.shipmentScope.current.status!=='verified')||![...Object.values(row),...Object.values(matched)].every(verified32)||!units[i]||!units[refs.length+index]||units[i]!.unit!==units[refs.length+index]!.unit||[row,matched].some(r=>typeof r.quantity.field.current.value!=='number'||!Number.isFinite(r.quantity.field.current.value)||r.quantity.field.current.value<0||r.quantity.field.current.value>Number.MAX_SAFE_INTEGER))continue;
        const equal =
          Number(row.quantity.field.current.value) * units[i]!.factor ===
          Number(matched.quantity.field.current.value) *
            units[refs.length + index]!.factor;
        const rowId=key32(bl.id,"check","declaration-group-item-"+row.description.documentId+"/"+row.description.itemId);
        if(hsSix(row.hs.field.current.value)!==hsSix(matched.hs.field.current.value)){
          const hsId=rowId+'/hs';checks.push({id:hsId,title:'대응 품목의 HS 공통 6자리 충돌',scope:'house_bl_declaration',category:'goods',assessment:'confirmed_mismatch',importance:'high',relationshipIds:[],fields:[row.description,row.hs,matched.description,matched.hs],rootCauseIds:[hsId],rootCauseKind:'value_conflict',explanation:'동일한 원문 품명과 유일한 명시 제품 식별자로 대응한 행에서 검증된 HS 공통 6자리가 다릅니다. 수량 일치와 별개인 분류 기재 차이입니다.',followUp:'해당 품목의 세번 기재와 분류 근거를 확인해 주세요.',comparison:{meaning:'hsCode',hbl:null,scope:'original_check',reasonCodes:[],relatedCheckIds:[],facts:[]}});
        }
        if(!equal)rowMismatches.push({id:rowId,delta:Number(row.quantity.field.current.value)*units[i]!.factor-Number(matched.quantity.field.current.value)*units[refs.length+index]!.factor});
        checks.push({
          id: rowId,
          scope: "document",
          category: "quantity",
          title: "복수 신고 대응 품목 수량",
          importance: equal ? "info" : structuralBlockerCount===0 ? "high" : "attention",
          assessment: equal ? "confirmed_match" : structuralBlockerCount===0 ? "confirmed_mismatch" : "provisional_mismatch",
          ...(!equal?{rootCauseIds:[rowId],rootCauseKind:'value_conflict' as const}:{}),
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
            "해당 신고의 원문 품목을 같은 검증 HBL의 유일한 품목행에 대응해 기재 수량을 비교했습니다. 전체 신고 포함·합산 여부는 별도 검사이며, 포함 범위가 미확정일 때 수량 차이는 잠정으로 보호합니다.",
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
      ...(!structuralBlockerCount?{declarationMembership:{hblDocumentId:bl.id,declarationDocumentIds:linked.map(d=>d.id),itemMappings:mapping.matches.filter(m=>m.proof!=='ai_only').map(m=>({documentId:m.left.documentId,itemId:m.left.itemId!,targetItemId:m.right.itemId!,proof:m.proof}))},...(!mapping.strong?{rootCauseIds:["declaration-product-map/"+bl.id]}:{})}:{}),
      ...(!blockers.length&&!same&&rowMismatches.length&&Math.abs(rowMismatches.reduce((n,r)=>n+r.delta,0)-(left-right))<=Math.max(1,Math.abs(left),Math.abs(right))*1e-9?{rootCauseIds:rowMismatches.map(r=>r.id),rootCauseKind:'value_conflict' as const}:{}),
      explanation: blockers.length
        ? "신고 합산의 포함·중복·행 근거 조건을 충족하지 못했습니다."
        : "명시된 전체 신고 목록과 서로 다른 검증된 품목 집합의 물품 수량을 합산했습니다. 포장/중량을 물품 수량에 포함하지 않았습니다.",
      uncertainties: blockers,
      followUp:
        "신고 목록·전체 품목 포함·분할 배분을 확인해 주세요. 같은 품목이나 공동 포장은 자동 합산하지 않습니다.",
      ...(!blockers.length
        ? {
            declarationCoverage: {
              hblDocumentId: bl.id,
              declarationDocumentIds: linked.map((d) => d.id),
              itemMappings: mapping.matches.map(m=>({documentId:m.left.documentId,itemId:m.left.itemId!,targetItemId:m.right.itemId!,proof:m.proof})),
            },
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
