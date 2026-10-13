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
import {
  geometricRole,
  nativeCell,
  nativeDocumentField,
  cellHeading,
} from "../layout/shipping-geometry";
import { shippingRole, rootTotalRole, unitParents } from "./roles";
import { atomRole, countAtoms } from "./count-atoms";
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
  normalizeText(text.replace(/^[()]|[()]$/g, "")) === normalizeText(value) ||
  normalizeText(text.replace(/^\(?HS\s+/i, "").replace(/\)$/, "")) ===
    normalizeText(value) ||
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
  const finish = () => {
    const p = pdf.pages.find((p) => p.page === g.source?.page);
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
  const contextualAtom = (b: PdfBlock) => {
    const parent = geometricRole(page, b);
    return parent &&
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
      !(values.length && values.every((b) => nativeDocumentField(page, b)))
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
    const labels = blocks
      .map((b) => shippingRole(b.text.split(":")[0]))
      .filter((r): r is string => !!r);
    const actual =
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
          page.cells?.length && countAtoms(b.text).length && !contextualAtom(b),
      ) &&
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
      ((owner.tableId.startsWith(`p${page.page}:t`) ||
        owner.tableId.startsWith(`p${page.page}:box`)) &&
        blocks.every((b) => {
          const linked = shippingCell(page, [b], scope);
          if (linked?.tableId === owner.tableId && linked.rowId === owner.rowId)
            return true;
          const h = Number(owner.tableId.split(":t")[1]);
          const cell = nativeCell(page, b),
            heading = cell && cellHeading(page, cell);
          const parent =
            shippingRole(b.text) ??
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
    values.some((b) => numericTokens(b.text).length !== 1 && !contextualAtom(b))
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
      !values.every((b) => nativeDocumentField(page, b))
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
    g.source.semanticRole = actual!;
    if (location) g.source.layout = location;
    g.reason = "실제 PDF의 필드 라벨·문자/숫자·열·행 관계를 대조했습니다.";
  }
  return finish();
}
function titleType(text: string) {
  const t = normalizeText(text)
    .replace(/\s*\((?:synthetic|합성)\)\s*$/, "")
    .replace(/^(?:\(\d{1,3}\)|\d{1,3}[.)])\s*(?=[A-Za-z가-힣])/, "")
    .replace(/^\((.*)\)$/, "$1");
  const korean = t.replace(/(?<=[가-힣])\s+(?=[가-힣])/g, "");
  if (
    /^(?:house\s+b\/?l|house bill of lading|h\.?b\.?l\.?)\s*(?:draft|초안)?$/.test(
      t,
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
    /^(?:house manifest|house cargo manifest|house 적하목록|적하목록 신고 예정자료)$/.test(
      t,
    )
  )
    return "house_manifest" as const;
  return null;
}
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
  const masterTitle = titles.some((t) =>
    /^(?:master (?:bill of lading|b\/?l)|m\.?b\.?l\.?)$/i.test(t.text.trim()),
  );
  const known = new Set(titles.map((t) => titleType(t.text)).filter(Boolean));
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
    const house = (page?.blocks ?? []).filter((b) =>
      /^house\s*b\/?l\s*\/\s*(?:ocean|sea) freight$/i.test(b.text.trim()),
    );
    const issuer =
      house.length === 1
        ? (page?.blocks ?? []).find((b) => {
            if (
              !/^(?:carrier\s*\/\s*forwarder|carrier|freight forwarder|issued by|issuer|발행자|운송주선인)\s*:?$/i.test(
                b.text.trim(),
              ) ||
              b.y >= house[0].y
            )
              return false;
            const cell = nativeCell(page!, house[0]),
              labelCell = nativeCell(page!, b);
            if (cell) return cell === labelCell;
            return (
              Math.abs(b.x - house[0].x) <=
                Math.max(b.height, house[0].height) * 2 &&
              house[0].y - b.y <= Math.max(b.height, house[0].height) * 6
            );
          })
        : undefined;
    const master = titles.some((t) =>
      /^(?:master (?:bill of lading|b\/?l)|m\.?b\.?l\.?)$/i.test(t.text.trim()),
    );
    valid =
      valid &&
      !!title &&
      house.length === 1 &&
      !!issuer &&
      !master &&
      (cited(title) || house.every((h) => blocks!.some((b) => b.id === h.id)));
    if (valid)
      blocks = [...title!.g, issuer!, ...house].filter(
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
