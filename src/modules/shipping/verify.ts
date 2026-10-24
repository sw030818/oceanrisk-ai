import { nativeDetailGroup, nativeItemBlock } from "../layout/shipping-detail-group";
import type {
  GroundedField,
  PdfDocument,
  PdfPage,
  PdfBlock,
} from "../documents/schema";
import { resolveCitation } from "../ai/citations";
import { verifyField, normalizeText } from "../evidence/verify";
import { physicalLines, spanText } from "../layout/physical-spans";
import { numericTokens } from "../evidence/numbers";
import { evidenceBlocks } from "../layout/relations";
import { shippingLabelForValue as labelForValue } from "../layout/shipping-label";
import { shippingCell, type EntityScope } from "../layout/shipping-cells";
import {
  geometricRole,
  nativeCell,
  nativeDocumentField,
  nativeDocumentFieldAmbiguous,
  cellHeading,
  packageGoodsContext,
} from "../layout/shipping-geometry";
import { shippingRole, rootTotalRole, unitParents, withoutSubfieldMarker, compoundLabel } from "./roles";
import { containerWithSize } from "./review-evidence";
import { nativeGoodsContext } from "./goods-context";
import { cargoCountAtoms } from "./cargo-description";
import { atomRole, countAtoms } from "./count-atoms";
import type { Candidate } from "./ai-schema";
import type { ShippingField } from "./schema";
import { shapeProblem, numberIsIdentifier, foreignLineLabel } from "./value-shape";
type Location = NonNullable<
  NonNullable<GroundedField<unknown>["source"]>["layout"]
>;
function inlineRole(text: string, value: string | number): string | null {
  const normalized = normalizeText(text),
    v = normalizeText(String(value));
  if (typeof value === "string") {
    if (!normalized.endsWith(v)) return null;
    const prefix = normalized
      .slice(0, -v.length)
      .trim()
      .replace(/[:=#-]$/, "")
      .trim()
      // "(통관고유부호) 보람-1-44-1-01-2": a bracketed label before the value.
      .replace(/^\((.+)\)$/, "$1");
    return shippingRole(prefix);
  }
  const match = text.match(/[-+]?\d+(?:[.,]\d+)*/);
  if (!match || !numericTokens(match[0]).includes(value)) return null;
  return shippingRole(text.slice(0, match.index).trim());
}
// A sub-field marker of a compound column ("C) ", "/", "1) ") is not part of
// the printed value; which sub-field it marks is checked separately.
// "BLRU0350340 / 40GP": the ISO size/type code printed after a container
// number is not part of the container's identity.
const containerOnly = (text: string, value: string) => {
  const m = text.normalize("NFKC").match(containerWithSize);
  return !!m && /^[A-Z]{4}\s?\d{6}\s?\d$/i.test(value.trim()) &&
    normalizeText(m[1] + m[2] + m[3]) === normalizeText(value.replace(/\s/g, ""));
};
const literal = (text: string, value: string) =>
  normalizeText(text) === normalizeText(value) ||
  containerOnly(text, value) ||
  normalizeText(withoutSubfieldMarker(text)) === normalizeText(value) ||
  normalizeText(text.replace(/^[()]|[()]$/g, "")) === normalizeText(value) ||
  normalizeText(text.replace(/^\(?HS\s+/i, "").replace(/\)$/, "")) ===
    normalizeText(value) ||
  inlineRole(text, value) !== null;
function anchors(blocks: PdfBlock[], value: string | number) {
  if (typeof value === "number")
    return blocks.filter((b) => numericTokens(b.text).includes(value));
  const exact = blocks.filter((b) => literal(b.text, value));
  if (exact.length) return exact;
  // A citation may include a numbered/split label as well as the value. Match
  // complete literal block spans, not a string substring or the entire quote.
  const matches: PdfBlock[] = [];
  for (let start = 0; start < blocks.length; start++)
    for (
      let end = start + 1;
      end <= Math.min(blocks.length, start + 12);
      end++
    ) {
      const span = blocks.slice(start, end);
      if (normalizeText(spanText(span)) === normalizeText(value))
        matches.push(...span);
    }
  return [...new Map(matches.map((b) => [b.id, b])).values()];
}
function fail(
  g: GroundedField<string | number>,
  code: GroundedField<unknown>["verificationCode"],
  reason: string,
) {
  return {
    ...g,
    status: "unverified" as const,
    verificationCode: code,
    reason,
  };
}
export function verifyShippingField(
  candidate: Candidate,
  pdf: PdfDocument,
  role: string,
  scope: EntityScope = "document",
  owner?: Location,
): ShippingField {
  const resolved = resolveCitation(candidate, pdf);
  let g = verifyField(resolved, pdf);
  const finish = () => {
    const p = pdf.pages.find((p) => p.page === g.source?.page);
    if (g.source && p) g.source.provenance = p.textSource ?? "pdf_text";
    if (g.status === "verified" && g.source && p?.cells?.length) {
      if (scope !== "document" && g.source.layout)
        g.source.scopeBasis = "entity_row";
      else if (
        scope === "document" &&
        g.source.blocks?.some((b) => nativeDocumentField(p, b))
      )
        g.source.scopeBasis = "document_field";
    }
    return { original: g, current: structuredClone(g) };
  };
  const page = pdf.pages.find((p) => p.page === g.source?.page);
  if (page?.textSource === "ocr") {
    if (g.source) {
      g.source.provenance = "ocr";
      delete g.source.blocks;
      delete g.source.layout;
    }
    g = fail(
      g,
      "ocr_unverified",
      "OCR 인식 문자열과 대조했지만 PDF 이미지에서 독립 확인한 원문은 아닙니다. 숫자·단위·페이지를 원본에서 직접 확인해 주세요.",
    );
    return finish();
  }
  // The value's own shape is independent of its citation: a bare "(250)"
  // cannot be a product name whether or not a block was cited.
  const shape = g.value === null ? null : shapeProblem(role, g.value);
  if (shape) {
    g = fail(g, "not_field_value", shape);
    return finish();
  }
  if (g.status !== "verified" || !page) return finish();
  const blocks = g.source && evidenceBlocks(g.source, page);
  if (!blocks?.length) {
    g = fail(
      g,
      "missing_evidence",
      "필드 검증에는 해당 페이지의 실제 블록 ID가 필요합니다.",
    );
    return finish();
  }
  if (
    typeof g.value === "string" &&
    blocks.some((b) => {
      const roles = [...b.text.matchAll(/(?:^|[\/;|])\s*([^:\/;|]+):/g)]
        .map((m) => shippingRole(m[1]))
        .filter(Boolean);
      return new Set(roles).size > 1;
    })
  ) {
    g = fail(
      g,
      "ambiguous_cell",
      "여러 필드 라벨을 포함한 문자열 전체를 하나의 필드 값으로 사용하지 않습니다.",
    );
    return finish();
  }
  if (
    role.startsWith("portOf") &&
    scope === "document" &&
    page.cells?.length &&
    blocks.every(
      (b) =>
        !nativeDocumentField(page, b) && inlineRole(b.text, g.value!) !== role &&
        (nativeCell(page,b) || labelForValue(page,[b],g.value!,shippingRole)!==role),
    )
  ) {
    g = fail(
      g,
      "role_mismatch",
      "항구 라벨이 있는 실제 원문 셀과 연결되지 않은 주소·국가·인접 셀은 항구 근거로 승인하지 않습니다.",
    );
    return finish();
  }
  if (
    role === "hsCode" &&
    (typeof g.value !== "string" || !/^\d[0-9. -]*\d$/.test(g.value.trim()))
  ) {
    g = fail(
      g,
      "value_mismatch",
      "HS 필드는 인용 라벨을 제외한 실제 숫자 세번을 확인해야 합니다.",
    );
    return finish();
  }
  if (role === "goodsDescription" && typeof g.value === "string" && countAtoms(g.value).length) {
    g = fail(g, "role_mismatch", "수량·포장 주석만으로는 상품명을 입증하지 않습니다.");
    return finish();
  }
  if (scope === "document" && valuesInDetail()) {
    g=fail(g,"row_mismatch","명시적 품목 카드에 속한 값을 문서 전체 합계로 승격하지 않습니다.");
    return finish();
  }
  function valuesInDetail() {
    return blocks!.some(b=>!!nativeDetailGroup(page!,b)||!!nativeItemBlock(page!,b));
  }
  const units = unitParents[role];
  // A line labelled as a document total ("Total No. of Packages (in words)")
  // inside a body column states the whole document's figure, not a row's.
  const totalLine = (b: PdfBlock) => /^total/.test(geometricRole(page, b) ?? "");
  const contextualAtom = (b: PdfBlock) => {
    const parent = geometricRole(page, b);
    if (
      ["quantity", "quantityUnit"].includes(role) &&
      ["packageCount", "totalPackageCount"].includes(parent ?? "") &&
      !packageGoodsContext(page, b)
    )
      return null;
    // Explicit count annotation inside a native goods cell of this owner row.
    // No document total, footer, neighbouring row, OCR, model or weight inference.
    const annotation = parent === "goodsDescription" &&
      (scope === "item" || scope === "cargo") && !!owner && !!nativeCell(page, b) &&
      (() => { const row = shippingCell(page, [b], scope); return row?.tableId === owner.tableId && row.rowId === owner.rowId; })();
    return annotation ? (() => {
      const base = role === "packageUnit" ? "packageCount" : role.replace(/Unit$/, "");
      const matching = cargoCountAtoms(b.text).filter(a => a.role === base && (typeof g.value === "number" ? a.value === g.value : a.unit.toLowerCase() === String(g.value).toLowerCase()));
      return matching.length === 1 ? matching[0].role : null;
    })() : parent &&
      [
        "quantity",
        "packageCount",
        "totalQuantity",
        "totalPackageCount",
      ].includes(parent)
      ? atomRole(b.text, g.value!, role)
      : null;
  };
  const values = units
    ? [
        ...new Set([
          ...anchors(blocks, g.value!),
          ...blocks.filter((b) => !!contextualAtom(b)),
          ...blocks.filter((b) => {
            // A literal "500PCS" / "320 KG" cell supplies the printed unit,
            // but only its independently checked parent column and owner row can
            // establish the role. No numeric substring or global text search.
            if (
              typeof g.value !== "string" ||
              numericTokens(b.text).length !== 1
            )
              return false;
            const number = b.text.match(/^\s*[-+]?\d+(?:[.,]\d+)*/);
            return (
              !!number &&
              normalizeText(
                b.text.slice(number[0].length).replace(/[()]/g, ""),
              ) === normalizeText(g.value)
            );
          }),
        ]),
      ]
    : anchors(blocks, g.value!);
  if (
    scope === "document" &&
    values.some((b) => nativeDocumentFieldAmbiguous(page, b, role))
  ) {
    g = fail(
      g,
      "row_mismatch",
      "같은 원문 셀에 해당 수치의 여러 행이 있어 한 행을 문서 전체 기재값으로 확정할 수 없습니다.",
    );
    return finish();
  }
  if (typeof g.value === "number" && values.some((b) => numberIsIdentifier(b.text, g.value as number))) {
    g = fail(g, "not_field_value", "모델·번호·유형 표기 뒤의 숫자는 수량·포장·중량 값으로 사용하지 않습니다.");
    return finish();
  }
  if (scope !== "document") {
    const label = foreignLineLabel(page, values, role, scope, g.value!);
    if (label) {
      g = fail(g, "not_field_value", `'${label}:' 라벨이 붙은 문장의 값은 품목·컨테이너·화물 표의 행 값으로 사용하지 않습니다.`);
      return finish();
    }
  }
  const locations = values
    .map((b) => shippingCell(page, [b], scope))
    .filter((l): l is Location => !!l);
  const location = locations[0] ?? null;
  if (g.source) {
    delete g.source.layout;
    delete g.source.semanticRole;
    if (location) g.source.layout = location;
  }
  if (units) {
    const entityHeaders = blocks.some((b) => {
      const headers = (page.blocks ?? []).filter(
        (h) => h.row === b.row && shippingRole(h.text),
      );
      return (
        headers.length >= 2 &&
        headers.some((h) =>
          [
            "goodsDescription",
            "tradeDescription",
            "containerNumber",
            "houseBlNumber",
          ].includes(shippingRole(h.text)!),
        )
      );
    });
    const entityCell = values.some((b) =>
      ["item", "container", "cargo"].some((s) =>
        shippingCell(page, [b], s as EntityScope),
      ),
    );
    if (
      scope === "document" &&
      (entityHeaders || entityCell) &&
      !(values.length && values.every((b) => nativeDocumentField(page, b) || totalLine(b)))
    ) {
      g = fail(
        g,
        "row_mismatch",
        "개별 표의 단위 헤더/셀을 문서 전체 합계의 단위로 확정하지 않습니다.",
      );
      return finish();
    }
    const parents =
      scope === "container" && role === "weightUnit"
        ? ["grossWeight", "totalGrossWeight", "grossWeightUnit"]
        : units;
    const unitText = normalizeText(String(g.value));
    // "14. 1)총중량(KGS) 2)총용적(CBM)": the unit printed on the matching part
    // of a compound column header is that column's explicit unit header.
    const compoundUnit = (b: PdfBlock) =>
      compoundLabel(b.text)?.parts.find(
        (p) => p.role && parents.includes(p.role) && p.unit && normalizeText(p.unit) === unitText,
      )?.role ?? null;
    const labels = blocks
      .map((b) => shippingRole(b.text.split(":")[0]) ?? compoundUnit(b))
      .filter((r): r is string => !!r);
    const actual =
      values.map(b => contextualAtom(b)).find(Boolean) ??
      location?.role ??
      values
        .map(
          (b) =>
            contextualAtom(b) ??
            geometricRole(page, b) ??
            inlineRole(b.text, g.value!),
        )
        .find(Boolean) ??
      labelForValue(page, values, g.value!, shippingRole);
    const unitValueRoles = values.map(
      (b) =>
        contextualAtom(b) ??
        shippingCell(page, [b], scope)?.role ??
        geometricRole(page, b) ??
        inlineRole(b.text, g.value!) ??
        labelForValue(page, [b], g.value!, shippingRole),
    );
    const allowed =
      !values.some(
        (b) =>
          nativeCell(page,b) && countAtoms(b.text).length && !contextualAtom(b),
      ) &&
      unitValueRoles.every((r) => r === role || parents.includes(r ?? "")) &&
      (actual === role ||
        parents.includes(actual ?? "") ||
        labels.some((r) => r === role || parents.includes(r)));
    const quotedUnit =
      values.length > 0 ||
      blocks.some((b) => !!compoundUnit(b)) ||
      blocks.some((b) => {
        const nums = numericTokens(b.text),
          r =
            shippingRole(b.text.split(":")[0]) ??
            (nums.length === 1 ? inlineRole(b.text, nums[0]) : null);
        if (!r || !parents.includes(r)) return false;
        const start = b.text.match(/[-+]?\d+(?:[.,]\d+)*/)?.index;
        const suffix = b.text.includes(":")
          ? normalizeText(b.text).split(":").slice(1).join(":").trim()
          : start !== undefined
            ? normalizeText(b.text.slice(start))
            : "";
        return (
          normalizeText(b.text).endsWith("(" + unitText + ")") ||
          (numericTokens(suffix).length === 1 &&
            suffix.endsWith(unitText) &&
            !/[/:;]/.test(suffix))
        );
      });
    const rowOkay =
      !owner ||
      ((owner.tableId.startsWith(`p${page.page}:t`) ||
        owner.tableId.startsWith(`p${page.page}:box`) || owner.tableId.startsWith(`p${page.page}:detail`) || owner.tableId.startsWith(`p${page.page}:item`) || owner.tableId.startsWith(`p${page.page}:list`)) &&
        blocks.every((b) => {
          const linked = shippingCell(page, [b], scope);
          if (linked?.tableId === owner.tableId && linked.rowId === owner.rowId)
            return true;
          const h = Number(owner.tableId.split(":t")[1]);
          const cell = nativeCell(page, b),
            heading = cell && cellHeading(page, cell);
          const parent =
            shippingRole(b.text) ??
            compoundUnit(b) ??
            (heading?.blocks.some((v) => v.id === b.id) ? heading.role : null);
          return (
            (b.row === h ||
              (owner.tableId.startsWith(`p${page.page}:box`) &&
                (nativeCell(page, b)?.y ===
                  Number(owner.tableId.split(":box")[1]) ||
                  blocks.some(
                    (v) =>
                      shippingCell(page, [v], scope)?.tableId === owner.tableId,
                  )))) &&
            (parents.includes(parent ?? "") || parent === role)
          );
        }));
    if (!allowed || !quotedUnit || !rowOkay)
      g = fail(
        g,
        rowOkay ? "role_mismatch" : "row_mismatch",
        "단위는 실제 수량/포장/중량 라벨과 같은 행 또는 해당 표의 명시적 단위 헤더에 연결되어야 합니다.",
      );
    else if (g.source) {
      if (!location && owner)
        g.source.layout = { ...owner, role, unit: String(g.value) };
      g.source.semanticRole = role;
      g.reason = "해당 필드의 실제 단위 셀/헤더와 원문을 대조했습니다.";
    }
    return finish();
  }
  if (!values.length) {
    g = fail(
      g,
      "value_mismatch",
      "추출값 전체를 실제 원문 셀에서 확인하지 못했습니다.",
    );
    return finish();
  }
  if (
    typeof g.value === "number" &&
    values.some((b) => numericTokens(withoutSubfieldMarker(b.text)).length !== 1 && !contextualAtom(b))
  ) {
    g = fail(
      g,
      "ambiguous_cell",
      "인용한 숫자 블록에 여러 수치가 있어 해당 필드의 값 하나로 확정하지 않습니다.",
    );
    return finish();
  }
  if (
    (values.length > 1 && typeof g.value === "number") ||
    new Set(locations.map((l) => l.tableId + "/" + l.rowId)).size > 1
  ) {
    g = fail(
      g,
      "ambiguous_cell",
      "같은 숫자의 여러 셀 또는 서로 다른 행을 인용해 유일한 근거를 확인하지 못했습니다.",
    );
    return finish();
  }
  if (values.length > 1) {
    const ordered = [...values].sort((a, b) => a.y - b.y || a.x - b.x);
    if (
      !ordered.every(
        (b) =>
          nativeCell(page, b) &&
          nativeCell(page, b) === nativeCell(page, ordered[0]),
      ) &&
      ordered.some(
        (b, i) =>
          i > 0 &&
          (Math.abs(b.x - ordered[0].x) >
            Math.max(b.height, ordered[0].height) * 2 ||
            b.y - ordered[i - 1].y >
              Math.max(b.height, ordered[i - 1].height) * 2),
      )
    ) {
      g = fail(
        g,
        "row_mismatch",
        "분리된 문자열이 다른 열/행 구역을 가로질러 원문 값으로 연결되지 않습니다.",
      );
      return finish();
    }
  }
  const actual =
    values.map((b) => contextualAtom(b)).find(Boolean) ??
    location?.role ??
    values
      .map(
        (b) =>
          contextualAtom(b) ??
          geometricRole(page, b) ??
          inlineRole(b.text, g.value!),
      )
      .find(Boolean) ??
    labelForValue(page, values, g.value!, shippingRole);
  const compatible =
    actual === role || (scope === "document" && rootTotalRole[role] === actual);
  if (!compatible) {
    g = fail(
      g,
      "role_mismatch",
      "값은 존재하지만 해당 필드의 실제 라벨/열 의미와 다릅니다.",
    );
    return finish();
  }
  if (scope === "document") {
    const tableOwned = values.some((b) =>
      ["item", "container", "cargo"].some((s) =>
        shippingCell(page, [b], s as EntityScope),
      ),
    );
    if (
      tableOwned &&
      !actual?.startsWith("total") &&
      !values.every((b) => nativeDocumentField(page, b) || totalLine(b))
    ) {
      g = fail(
        g,
        "row_mismatch",
        "개별 품목/컨테이너/화물 행의 값을 문서 전체 필드나 합계로 확정하지 않습니다.",
      );
      return finish();
    }
  } else if (
    !location ||
    (!owner &&
      ![
        "goodsDescription",
        "tradeDescription",
        "containerNumber",
        "houseBlNumber",
      ].includes(role)) ||
    (owner &&
      (location.rowId !== owner.rowId || location.tableId !== owner.tableId))
  ) {
    g = fail(
      g,
      "row_mismatch",
      "품목/컨테이너/화물 식별자와 동일 표의 같은 행에 연결하지 못했습니다.",
    );
    return finish();
  }
  if (g.source) {
    if (role === "goodsDescription") {
      const context = nativeGoodsContext(page, values, scope);
      if (context) {
        const source = { ...g.source, goodsContext: context };
        g.source = source;
      }
    }
    g.source.semanticRole = actual!;
    if (location) g.source.layout = location;
    g.reason = "실제 PDF의 필드 라벨·문자/숫자·열·행 관계를 대조했습니다.";
  }
  return finish();
}
function titleType(text: string): 'house_bl'|'export_declaration'|'house_manifest'|null {
  const t = normalizeText(text)
    .replace(/\s*\((?:synthetic|합성)\)\s*$/, "")
    .replace(/^(?:\(\d{1,3}\)|\d{1,3}[.)])\s*(?=[A-Za-z가-힣])/, "")
    .replace(/^\((.*)\)$/, "$1");
  const korean = t.replace(/(?<=[가-힣])\s+(?=[가-힣])/g, "");
  if (
    /^(?:house\s+b\/?l|house bill of lading|house\s*선하증권|하우스\s*선하증권|h\.?b\.?l\.?)\s*(?:draft|초안)?$/.test(
      korean,
    )
  )
    return "house_bl" as const;
  if (
    /^(?:export declaration(?: certificate)?|수출신고필증|수출신고서)$/.test(
      korean,
    )
  )
    return "export_declaration" as const;
  if (
    /^(?:house manifest|house cargo manifest|(?:house|하우스)\s*적하목록|적하목록 신고 예정자료|혼재화물적하목록(?:\((?:해상|항공)(?:수출|수입)\))?|(?:sea |air )?consolidated cargo manifest)$/.test(
      korean,
    )
  )
    return "house_manifest" as const;
  // Bilingual headings are two independently recognized titles of the SAME
  // type. An arbitrary suffix, mixed document types, or body mention is not a
  // title. Spaced separators avoid splitting the B/L abbreviation itself.
  const parts=korean.split(/\s+[\/|]\s+/);
  if(parts.length>1){const types=parts.map(titleType);if(types.every(type=>!!type&&type===types[0]))return types[0];}
  return null;
}
function titleSignals(text:string){
  const type=titleType(text);if(type)return[type];
  return text.split(/\s+[\/|]\s+/).flatMap(part=>{const found=titleType(part);return found?[found]:[];});
}
function masterTitleSignal(text:string){
  return text.split(/\s+[\/|]\s+/).some(part=>/^(?:master (?:bill of lading|b\/?l)|m\.?b\.?l\.?|sea export cargo manifest)$/i.test(part.trim()) ||
    /^적하목록\((?:해상|항공)수출\)$/.test(part.normalize("NFKC").replace(/\s+/g,"")));
}
// Explicit House issuance printed on a plain "Bill of Lading": a House B/L
// statement, an NVOCC carrier clause or a FIATA FBL. A generic carrier/agent
// clause is not House evidence.
const houseIssuance = (text: string) =>
  (/\bhouse\s*(?:b\/?l|bill of lading)\b/i.test(text) && /\b(?:issued|as carrier|signed)\b/i.test(text) && !/^\s*master\b/i.test(text)) ||
  /\bNVOCC\b|non[- ]vessel[- ]operating common carrier|\bFIATA\b/i.test(text);
function titleCandidates(page: PdfPage) {
  const bs = (page.blocks ?? []).filter(
    (b) => b.y < (page.height ?? 842) * 0.17,
  );
  const groups: PdfBlock[][] = bs.map((b) => [b]);
  for (const b of bs) {
    const peers = bs.filter((p) => p.row === b.row).sort((a, b) => a.x - b.x);
    if (
      peers.length > 1 &&
      peers.length <= 12 &&
      peers.every(
        (p, i) =>
          !i || p.x - (peers[i - 1].x + peers[i - 1].width) < p.height * 2,
      )
    )
      groups.push(peers);
  }
  for (const b of bs) {
    const vertical = bs
      .filter(
        (p) =>
          Math.abs(p.x - b.x) <= Math.max(p.height, b.height) * 2 &&
          p.y >= b.y &&
          p.y - b.y <= Math.max(p.height, b.height) * 3.5 &&
          Math.abs(p.height - b.height) < 2,
      )
      .sort((a, b) => a.y - b.y);
    for (let n = 2; n <= Math.min(3, vertical.length); n++) {
      const g = vertical.slice(0, n);
      if (
        g.every(
          (p, i) =>
            !i || p.y - g[i - 1].y <= Math.max(p.height, g[i - 1].height) * 2.2,
        )
      )
        groups.push(g);
    }
  }
  return groups.filter(
    (g) =>
      (page.blocks ?? []).filter(
        (b) => b.row === g[0].row && shippingRole(b.text),
      ).length < 2,
  );
}
export function verifyClassification(
  type: string,
  citation: Candidate["evidence"],
  pdf: PdfDocument,
): ShippingField {
  const resolved = resolveCitation({ value: type, evidence: citation }, pdf);
  const page =
    resolved.evidence &&
    pdf.pages.find((p) => p.page === resolved.evidence!.page);
  let blocks =
    page && resolved.evidence && evidenceBlocks(resolved.evidence, page);
  const titles = pdf.pages.flatMap((p) =>
    titleCandidates(p).map((g) => ({
      p,
      g,
      text: g.map((b) => b.text).join(" "),
    })),
  );
  const masterTitle = titles.some(t=>masterTitleSignal(t.text));
  const known = new Set(titles.flatMap(t=>titleSignals(t.text)));
  const cited = (t: { g: PdfBlock[] }) =>
    t.g.every((b) => blocks?.some((c) => c.id === b.id));
  let valid =
    !!page &&
    page.textSource !== "ocr" &&
    !!blocks?.length &&
    type !== "unknown" &&
    known.size <= 1;
  let title = titles.find(
    (t) => t.p === page && titleType(t.text) === type && cited(t),
  );
  if (type === "house_bl" && !title) {
    title = titles.find(
      (t) => t.p === page && /^bill of lading$/i.test(t.text.trim()),
    );
    const phrases = page ? physicalLines(page) : [];
    const house = phrases.filter((g) =>
      /^house\s*b\/?l\s*\/\s*(?:ocean|sea) freight$/i.test(spanText(g).trim()),
    );
    const issuer =
      house.length === 1
        ? phrases.find((g) => {
            if (
              !/^(?:carrier\s*\/\s*forwarder|carrier|freight forwarder|issued by|issuer|발행자|운송주선인)\s*:?$/i.test(
                spanText(g).trim(),
              )
            )
              return false;
            const h = house[0][0],
              b = g[0];
            const hc = nativeCell(page!, h),
              ic = nativeCell(page!, b);
            // Same independently drawn issuer cell, or a bounded local issuer section.
            return (
              b.y < h.y &&
              (hc
                ? hc === ic
                : Math.abs(b.x - h.x) <= Math.max(b.height, h.height) * 2 &&
                  h.y - b.y <= Math.max(b.height, h.height) * 6)
            );
          })
        : undefined;
    const master = titles.some(t=>masterTitleSignal(t.text));
    const statements = phrases.filter((g) => houseIssuance(spanText(g)));
    const legacy = house.length === 1 && !!issuer;
    valid =
      valid &&
      !!title &&
      (legacy || statements.length > 0) &&
      !master &&
      (cited(title) ||
        (legacy ? house[0] : statements.flat()).every((h) => blocks!.some((b) => b.id === h.id)) ||
        statements.some((g) => g.some((h) => blocks!.some((b) => b.id === h.id))));
    if (valid)
      blocks = [...title!.g, ...(legacy ? [...issuer!, ...house[0]] : statements[0])].filter(
        (b, i, bs) => bs.findIndex((x) => x.id === b.id) === i,
      );
  } else valid = valid && !!title;
  if (known.size && !known.has(type as "house_bl")) valid = false;
  if (type === "house_bl" && masterTitle) valid = false;
  const source = resolved.evidence
    ? {
        fileId: pdf.id,
        fileName: pdf.fileName,
        ...resolved.evidence,
        ...(valid && blocks
          ? {
              quote: blocks.map((b) => b.text).join("\n"),
              segments: blocks.map((b) => ({ blockId: b.id, quote: b.text })),
            }
          : {}),
        blocks: blocks ?? undefined,
        semanticRole: "documentType",
        ...(page?.textSource === "ocr"
          ? { provenance: "ocr" as const, blocks: undefined }
          : {}),
      }
    : null;
  const field: GroundedField<string> = {
    value: type,
    status: valid ? "verified" : "unverified",
    verificationCode: valid
      ? "verified"
      : (resolved.evidenceIssue ?? "context_unverified"),
    source,
    reason: valid
      ? type === "house_bl"
        ? "실제 제목과 House 표시·페이지를 독립 확인했습니다."
        : "실제 문서 제목·페이지에서 유형을 독립 확인했습니다."
      : type === "unknown"
        ? "AI 문서 유형 후보가 없습니다. 원문 제목을 확인해 주세요."
        : "유형 후보는 있으나 실제 제목/발행 문맥 근거를 확인하지 못했습니다. 선택 영역은 유형 근거가 아닙니다.",
  };
  return { original: field, current: structuredClone(field) };
}

// Repair only a contradictory TYPE on an already cited, explicit native title.
// Missing/fabricated citations, unknown candidates, OCR, generic/master titles
// and mixed supported titles remain unverified. Never consult upload slots.
export function recoverCitedClassification(
  input: ShippingField,
  pdf: PdfDocument,
): ShippingField {
  const original = input.original,
    source = original.source;
  if (
    original.status === "verified" ||
    original.value === "unknown" ||
    original.verificationCode !== "context_unverified" ||
    !source?.segments?.length
  )
    return input;
  const page = pdf.pages.find((p) => p.page === source.page);
  if (!page || page.textSource === "ocr") return input;
  const all = pdf.pages.flatMap((p) =>
    titleCandidates(p).map((g) => ({
      p,
      g,
      text: g.map((b) => b.text).join(" "),
    })),
  );
  const known = new Set(all.flatMap(t=>titleSignals(t.text)));
  if (
    known.size !== 1 ||
    all.some(t=>masterTitleSignal(t.text))
  )
    return input;
  const title = all.find(
    (t) =>
      t.p === page &&
      titleType(t.text) &&
      t.g.every((b) => source.segments!.some((s) => s.blockId === b.id)),
  );
  if (!title) return input;
  const type = titleType(title.text)!;
  if (type === original.value) return input;
  const tested = verifyClassification(
    type,
    { page: page.page, blockIds: title.g.map((b) => b.id) },
    pdf,
  );
  if (tested.current.status !== "verified") return input;
  tested.current.source!.provenance = "pdf_text";
  tested.current.reason =
    "인용된 실제 제목의 명시적 유형과 AI 유형 후보가 충돌해, 원문 제목으로 독립 복구했습니다. 최초 AI 후보는 보존합니다.";
  return {
    ...input,
    current: structuredClone(tested.current),
    recovery: {
      method: "native",
      field: structuredClone(tested.current),
      target: "documentType",
      failureCode: "WRONG_FIELD_ASSIGNMENT",
    },
  };
}
