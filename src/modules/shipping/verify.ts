import type {
  GroundedField,
  PdfDocument,
  PdfPage,
  PdfBlock,
} from "../documents/schema";
import { resolveCitation } from "../ai/citations";
import { verifyField, normalizeText } from "../evidence/verify";
import { numericTokens } from "../evidence/numbers";
import { labelForValue, evidenceBlocks } from "../layout/relations";
import { shippingCell, type EntityScope } from "../layout/shipping-cells";
import { shippingRole, rootTotalRole, unitParents } from "./roles";
import type { Candidate } from "./ai-schema";
import type { ShippingField } from "./schema";
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
      .trim();
    return shippingRole(prefix);
  }
  const match = text.match(/[-+]?\d+(?:[.,]\d+)*/);
  if (!match || !numericTokens(match[0]).includes(value)) return null;
  return shippingRole(text.slice(0, match.index).trim());
}
const literal = (text: string, value: string) =>
  normalizeText(text) === normalizeText(value) ||
  inlineRole(text, value) !== null;
function anchors(blocks: PdfBlock[], value: string | number) {
  if (typeof value === "number")
    return blocks.filter((b) => numericTokens(b.text).includes(value));
  const exact = blocks.filter((b) => literal(b.text, value));
  if (exact.length) return exact;
  const body = blocks.filter((b) => !shippingRole(b.text));
  const joined = body.map((b) => b.text).join(" ");
  return normalizeText(joined) === normalizeText(value) ? body : [];
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
  const finish = () => ({ original: g, current: structuredClone(g) });
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
  const units = unitParents[role];
  const values = units
    ? [
        ...new Set([
          ...anchors(blocks, g.value!),
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
              normalizeText(b.text.slice(number[0].length)) ===
                normalizeText(g.value)
            );
          }),
        ]),
      ]
    : anchors(blocks, g.value!);
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
    if (scope === "document" && (entityHeaders || entityCell)) {
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
    const labels = blocks
      .map((b) => shippingRole(b.text.split(":")[0]))
      .filter((r): r is string => !!r);
    const actual =
      location?.role ??
      values.map((b) => inlineRole(b.text, g.value!)).find(Boolean) ??
      labelForValue(page, values, g.value!, shippingRole);
    const unitValueRoles = values.map(
      (b) =>
        shippingCell(page, [b], scope)?.role ??
        inlineRole(b.text, g.value!) ??
        labelForValue(page, [b], g.value!, shippingRole),
    );
    const allowed =
      unitValueRoles.every((r) => r === role || parents.includes(r ?? "")) &&
      (actual === role ||
        parents.includes(actual ?? "") ||
        labels.some((r) => r === role || parents.includes(r)));
    const unitText = normalizeText(String(g.value));
    const quotedUnit =
      values.length > 0 ||
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
      (owner.tableId.startsWith(`p${page.page}:t`) &&
        blocks.every((b) => {
          const linked = shippingCell(page, [b], scope);
          if (linked?.tableId === owner.tableId && linked.rowId === owner.rowId)
            return true;
          const h = Number(owner.tableId.split(":t")[1]);
          return (
            b.row === h &&
            (parents.includes(shippingRole(b.text) ?? "") ||
              shippingRole(b.text) === role)
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
    values.some((b) => numericTokens(b.text).length !== 1)
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
    location?.role ??
    values.map((b) => inlineRole(b.text, g.value!)).find(Boolean) ??
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
    if (tableOwned && !actual?.startsWith("total")) {
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
    g.source.semanticRole = actual!;
    if (location) g.source.layout = location;
    g.reason = "실제 PDF의 필드 라벨·문자/숫자·열·행 관계를 대조했습니다.";
  }
  return finish();
}
function titleType(text: string) {
  const t = normalizeText(text).replace(/\s*\((?:synthetic|합성)\)\s*$/, "");
  if (
    /^(?:house\s+b\/?l|house bill of lading|h\.?b\.?l\.?)\s*(?:draft|초안)?$/.test(
      t,
    )
  )
    return "house_bl" as const;
  if (
    /^(?:export declaration(?: certificate)?|수출\s*신고\s*필증|수출\s*신고서)$/.test(
      t,
    )
  )
    return "export_declaration" as const;
  if (
    /^(?:house manifest|house cargo manifest|house 적하목록|적하목록 신고 예정자료)$/.test(
      t,
    )
  )
    return "house_manifest" as const;
  return null;
}
function genuineTitles(page: PdfPage) {
  return (page.blocks ?? []).filter(
    (b) =>
      titleType(b.text) &&
      (page.blocks ?? []).filter(
        (other) => other.row === b.row && shippingRole(other.text),
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
  const blocks =
    page && resolved.evidence && evidenceBlocks(resolved.evidence, page);
  const types = new Set(
    pdf.pages.flatMap((p) => genuineTitles(p).map((b) => titleType(b.text))),
  );
  const valid =
    page?.textSource !== "ocr" &&
    !!blocks?.length &&
    blocks.some(
      (b) =>
        genuineTitles(page!).some((t) => t.id === b.id) &&
        titleType(b.text) === type,
    ) &&
    types.size === 1 &&
    type !== "unknown";
  const source = resolved.evidence
    ? {
        fileId: pdf.id,
        fileName: pdf.fileName,
        ...resolved.evidence,
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
      ? "실제 문서 제목과 블록/페이지에서 문서 유형을 독립 확인했습니다."
      : "문서 유형 근거가 부족하거나 복합 문서입니다. 선택 영역을 실제 유형으로 간주하지 않습니다.",
  };
  return { original: field, current: structuredClone(field) };
}
