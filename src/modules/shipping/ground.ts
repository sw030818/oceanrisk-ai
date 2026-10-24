import { collectionCoverage32, nativeFactCoverage } from "./coverage";
import { shippingValues } from "./fields";
import {
  shippingWireSchema,
  type ShippingWire,
  type Candidate,
  itemFieldKeys,
  cargoFieldKeys,
} from "./ai-schema";
import {
  shippingFields,
  shippingFieldLabels,
  type ShippingType,
} from "./catalog";
import {
  createShippingDocument,
  shippingDocumentSchema,
  type ShippingDocument,
  type ShippingField,
} from "./schema";
import {
  verifyShippingField,
  verifyClassification,
  recoverCitedClassification,
} from "./verify";
import type { PdfDocument } from "../documents/schema";
import { cellRole } from "./value-shape";
import { requiredFields } from "./form-fields";
import { normalizeText } from "../evidence/verify";
import type { EntityScope } from "../layout/shipping-cells";
export function groundShipping(
  raw: unknown,
  pdf: PdfDocument,
  slot: ShippingType,
): ShippingDocument {
  const wire = shippingWireSchema.parse(raw);
  const classification = recoverCitedClassification(
    verifyClassification(wire.type, wire.typeEvidence, pdf),
    pdf,
  );
  const type =
    classification.current.status === "verified"
      ? (classification.current.value as ShippingType)
      : wire.type === "unknown"
        ? null
        : wire.type;
  const doc = createShippingDocument(pdf, slot);
  const nativeText = pdf.pages
    .filter((p) => p.textSource !== "ocr")
    .map((p) => p.text)
    .join("\n");
  const nativeLines = nativeText.split(/\r?\n/);
  if (
    nativeLines.some(
      (line) =>
        /partial\s+shipment|부분\s*선적|분할\s*선적/i.test(line) &&
        !/no[- ]partial|not partial|not permitted|not allowed|부분\s*선적\s*없음|분할\s*선적\s*없음|불가|금지/i.test(
          line,
        ),
    )
  )
    doc.nativeScopeLimitation = "partial";
  else if (
    /co[- ]?pack|combined packages|공동\s*포장|동시\s*포장/i.test(nativeText)
  )
    doc.nativeScopeLimitation = "combined_packages";
  doc.fieldType = type;
  doc.detectedType = type;
  doc.classification = classification;
  doc.classificationStatus =
    classification.current.status === "verified"
      ? "classified"
      : "needs_review";
  const keys: readonly string[] = type
    ? shippingFields[type]
    : Object.keys(shippingFieldLabels);
  doc.fields = Object.fromEntries(
    keys.map((key) => [key, verifyShippingField(wire.fields[key], pdf, key)]),
  );
  doc.additionalFields = Object.entries(wire.fields)
    .filter(([key, f]) => !keys.includes(key) && f.value !== null)
    .map(([key, f], i) => ({
      id: `extra-${i + 1}`,
      label: shippingFieldLabels[key as keyof typeof shippingFieldLabels],
      meaning: key,
      field: verifyShippingField(f, pdf, key),
    }));
  const entity = (
    fields: Record<string, Candidate>,
    scope: EntityScope,
    anchorKey: string,
  ) => {
    const anchor = verifyShippingField(
      fields[anchorKey],
      pdf,
      anchorKey,
      scope,
    );
    const owner = anchor.original.source?.layout;
    const grounded = Object.fromEntries(
      Object.entries(fields).map(([key, c]) => [
        key,
        key === anchorKey
          ? anchor
          : verifyShippingField(c, pdf, key, scope, owner),
      ]),
    );
    if (anchor.original.status !== "verified")
      for (const [key, f] of Object.entries(grounded))
        if (key !== anchorKey && f.original.status === "verified") {
          f.original = {
            ...f.original,
            status: "unverified",
            verificationCode: "row_mismatch",
            reason:
              "식별자/품명 근거가 미확인이어서 해당 행의 값을 확정하지 않습니다.",
          };
          f.current = structuredClone(f.original);
        }
    return grounded;
  };
  doc.items = wire.items.map((i, index) => ({
    id: `item-${index + 1}`,
    fields: entity(
      i.fields,
      "item",
      i.fields.goodsDescription.value !== null
        ? "goodsDescription"
        : "tradeDescription",
    ),
  }));
  doc.containers = wire.containers.map((c, index) => {
    const { sealNumbers, ...fields } = c,
      grounded = entity(fields, "container", "containerNumber");
    const owner = grounded.containerNumber.original.source?.layout;
    return {
      id: `container-${index + 1}`,
      containerNumber: grounded.containerNumber,
      sealNumber: grounded.sealNumber,
      sealNumbers: sealNumbers.map((s) => {
        const f = verifyShippingField(s, pdf, "sealNumber", "container", owner);
        if (
          grounded.containerNumber.original.status !== "verified" &&
          f.original.status === "verified"
        ) {
          f.original = {
            ...f.original,
            status: "unverified",
            verificationCode: "row_mismatch",
            reason:
              "컨테이너 식별자 근거가 미확인이어서 Seal 연결을 확정하지 않습니다.",
          };
          f.current = structuredClone(f.original);
        }
        return f;
      }),
      packageCount: grounded.packageCount,
      packageUnit: grounded.packageUnit,
      grossWeight: grounded.grossWeight,
      weightUnit: grounded.weightUnit,
    };
  });
  doc.cargoRecords = wire.cargoRecords.map((r, index) => ({
    id: `cargo-${index + 1}`,
    fields: entity(r.fields, "cargo", "houseBlNumber"),
  }));
  // An entity whose identifying value provably cannot be that field (a bare
  // count "(250)" as goods, a labelled TOTAL line) is not a table row. It is
  // kept as a rejected candidate and left out of comparisons, but only while
  // another entity of the same kind stands on verified evidence; otherwise it
  // stays visible as an unverified entity.
  // A goods value printed in a titled form box outside the item table (a
  // "화물명세" summary restating the table) is not another item row. Applies
  // only when the same document proves an item in a plain table cell, so a
  // single boxed item ("Description of Goods" box) is never touched.
  const goodsAnchor = (i: (typeof doc.items)[number]) =>
    i.fields.goodsDescription.original.value !== null ? i.fields.goodsDescription : i.fields.tradeDescription;
  const placement = (f: ShippingField) => {
    const src = f.original.source;
    const page = pdf.pages.find((p) => p.page === src?.page);
    if (!page || page.textSource === "ocr" || src?.fileId !== pdf.id || !src.segments?.length) return null;
    // A cited title ("화물명세") is not part of the value; keep it as a title.
    const value = normalizeText(String(f.original.value ?? ""));
    const ids = src.segments.map((s) => s.blockId);
    const valueIds = ids.filter((id) => {
      const b = page.blocks?.find((v) => v.id === id);
      return !!b && value.includes(normalizeText(b.text));
    });
    return cellRole(page, valueIds.length ? valueIds : ids);
  };
  const placed = doc.items.map((i) => ({ item: i, at: placement(goodsAnchor(i)) }));
  if (placed.some((p) => p.at?.kind === "table" && goodsAnchor(p.item).original.status === "verified"))
    for (const p of placed) {
      if (p.at?.kind !== "labelled") continue;
      const f = goodsAnchor(p.item);
      f.original = {
        ...f.original,
        status: "unverified",
        verificationCode: "not_field_value",
        reason: `품목표 밖 제목 칸('${p.at.label}')의 값입니다. 같은 서류의 품목표 행과 구분해 별도 품목으로 쓰지 않습니다.`.slice(0, 300),
      };
      f.current = structuredClone(f.original);
    }
  const rejected: NonNullable<ShippingDocument["rejectedCandidates"]> = [];
  const keepEntities = <T extends { id: string }>(
    kind: "item" | "container" | "cargo",
    list: T[],
    anchorOf: (e: T) => ShippingField,
  ) => {
    const isPhantom = (e: T) => anchorOf(e).original.verificationCode === "not_field_value";
    if (!list.some((e) => !isPhantom(e) && anchorOf(e).original.status === "verified")) return list;
    return list.filter((e) => {
      if (!isPhantom(e)) return true;
      const a = anchorOf(e).original;
      rejected.push({ kind, id: e.id, value: a.value === null ? null : String(a.value).slice(0, 300), reason: a.reason.slice(0, 300) });
      return false;
    });
  };
  doc.items = keepEntities("item", doc.items, (i) =>
    i.fields.goodsDescription.original.value !== null ? i.fields.goodsDescription : i.fields.tradeDescription,
  );
  doc.containers = keepEntities("container", doc.containers, (c) => c.containerNumber);
  doc.cargoRecords = keepEntities("cargo", doc.cargoRecords, (c) => c.fields.houseBlNumber);
  doc.rejectedCandidates = rejected;
  const roles = {
    house_bl: "houseBlNumber",
    export_declaration: "declarationNumber",
    booking: "bookingReference",
    shipment: "shipmentReference",
    other: "otherReference",
  };
  doc.references = wire.references.map((r, index) => ({
    id: `reference-${index + 1}`,
    kind: r.kind,
    number: verifyShippingField(r.number, pdf, roles[r.kind]),
  }));
  // Do not silently duplicate a cited row as multiple independent entries.
  for (const rows of [
    doc.items.map((i) => i.fields),
    doc.containers.map(
      (c) =>
        Object.fromEntries(
          Object.entries(c).filter(([k]) => !["id", "sealNumbers"].includes(k)),
        ) as Record<string, ShippingField>,
    ),
    doc.cargoRecords.map((c) => c.fields),
  ]) {
    const addr = (r: Record<string, ShippingField>) => {
      const a = Object.values(r).find((f) => f?.original.source?.layout)
        ?.original.source;
      return a?.layout
        ? `${a.page}/${a.layout.tableId}/${a.layout.rowId}`
        : null;
    };
    const addresses = rows.map(addr);
    const duplicate = (f: ShippingField) => {
      f.original = {
        ...f.original,
        status: "unverified",
        verificationCode: "ambiguous_cell",
        reason:
          "동일 원문 행을 여러 항목으로 중복 추출해 독립 항목으로 확정하지 않습니다.",
      };
      f.current = structuredClone(f.original);
    };
    // One consolidated-manifest cargo row may list several containers, seals
    // and goods lines. Records that only split those list members, with
    // identical single values (HBL, parties, totals), are views of ONE row: the
    // first keeps the single values, the others keep only their own list member.
    const isCargo = rows.length > 0 && rows.every((r) => "houseBlNumber" in r && !("tradeDescription" in r));
    const members = ["containerNumber", "sealNumber", "goodsDescription"];
    // Shared identity values tie every view to its shipment; only amounts
    // would double-count, so only those are withheld from later views.
    const identity = ["houseBlNumber", "declarationNumber", "shipper", "consignee", "notifyParty"];
    const key = (f: ShippingField | undefined) => f?.original.value === null || f?.original.value === undefined ? null : normalizeText(String(f.original.value));
    const groups = new Map<string, number[]>();
    addresses.forEach((a, i) => { if (a) groups.set(a, [...(groups.get(a) ?? []), i]); });
    for (const ids of groups.values()) {
      if (ids.length < 2) continue;
      const group = ids.map((i) => rows[i]);
      const scalars = Object.keys(group[0]).filter((k) => !members.includes(k));
      const agree = scalars.every((k) => new Set(group.map((r) => key(r[k])).filter((v) => v !== null)).size <= 1);
      const memberSig = group.map((r) => members.map((k) => key(r[k]) ?? "").join("|"));
      const distinct = new Set(memberSig).size === group.length && memberSig.every((m) => m.replace(/\|/g, "") !== "");
      if (isCargo && agree && distinct) {
        // The AI's repeated value stays in `original` for audit; the view no
        // longer offers it for comparison because the first record carries it.
        group.slice(1).forEach((r) => {
          for (const k of scalars)
            if (r[k] && r[k].original.value !== null && !identity.includes(k)) {
              const empty = { value: null, status: "missing" as const, verificationCode: "missing_value" as const, source: null, reason: "같은 화물 행의 첫 기록에 이미 반영된 값입니다. 이 기록은 컨테이너·품목 줄만 나타냅니다." };
              r[k].original = { ...empty };
              r[k].current = { ...empty };
            }
        });
        continue;
      }
      for (const row of group) for (const f of Object.values(row)) if (f.original.value !== null) duplicate(f);
    }
  }
  for (const c of doc.containers)
    if (c.containerNumber.original.status !== "verified")
      for (const f of c.sealNumbers ?? [])
        if (f.original.status === "verified") {
          f.original = {
            ...f.original,
            status: "unverified",
            verificationCode: "row_mismatch",
            reason:
              "컨테이너 식별자 또는 행이 미확인이라 Seal 연결을 확정하지 않습니다.",
          };
          f.current = structuredClone(f.original);
        }
  // A value the AI repeated at another scope (a row value copied into a
  // document field, a document total copied into a row, a row's HBL repeated
  // as a free reference) is refused for that scope. When the same document
  // already verifies the same meaning with the identical value, the copy adds
  // nothing and cannot hide a conflict; it is withheld instead of being shown
  // as unverified evidence.
  {
    const alias: Record<string, string> = { weightUnit: "grossWeightUnit" };
    // level: "document" (document field or free reference) or "row" (an
    // item/cargo/container entity). Only copies between the two levels count.
    const entries: { role: string; field: ShippingField; level: "document" | "row" }[] = [];
    const push = (role: string, f: ShippingField | undefined, level: "document" | "row") => {
      if (f) entries.push({ role: alias[role] ?? role, field: f, level });
    };
    for (const [k, f] of Object.entries(doc.fields)) push(k, f, "document");
    for (const a of doc.additionalFields) push(a.meaning, a.field, "document");
    for (const i of doc.items) for (const [k, f] of Object.entries(i.fields)) push(k, f as ShippingField, "row");
    for (const c of doc.cargoRecords) for (const [k, f] of Object.entries(c.fields)) push(k, f as ShippingField, "row");
    for (const c of doc.containers)
      for (const k of ["containerNumber", "sealNumber", "packageCount", "packageUnit", "grossWeight", "weightUnit"] as const)
        push(k, c[k], "row");
    const same = (a: unknown, b: unknown) =>
      typeof a === "number" || typeof b === "number"
        ? Number(a) === Number(b)
        : normalizeText(String(a)) === normalizeText(String(b));
    // Only an exact copy: the same value citing printed text the verified field
    // already cites. A wrong-row citation of an equal number stays unverified.
    const blocksOf = (f: ShippingField) => (f.original.source?.segments ?? []).map((x) => x.blockId);
    const verifiedElsewhere = (role: string, f: ShippingField, level: "document" | "row") =>
      entries.some(
        (e) =>
          e.field !== f && e.level !== level && e.role === role && e.field.original.status === "verified" &&
          e.field.original.value !== null && same(e.field.original.value, f.original.value) &&
          (() => {
            const mine = blocksOf(f), theirs = new Set(blocksOf(e.field));
            return mine.length > 0 && mine.some((id) => theirs.has(id)) &&
              mine.every((id) => theirs.has(id) || !/\d|[A-Za-z가-힣]{2}/.test(f.original.source?.segments?.find((x) => x.blockId === id)?.quote ?? ""));
          })(),
      );
    const scopeOnly = (f: ShippingField) =>
      f.original.value !== null && f.original.status !== "verified" &&
      ["row_mismatch", "role_mismatch"].includes(f.original.verificationCode ?? "");
    const withhold = (f: ShippingField) => {
      const empty = {
        value: null, status: "missing" as const, verificationCode: "missing_value" as const, source: null,
        reason: "같은 값이 이 서류의 다른 위치에서 원문 확인되어, 다른 범위에 중복 기재된 AI 값은 비교에 쓰지 않습니다.",
      };
      f.original = { ...empty };
      f.current = { ...empty };
    };
    // Document fields only, and only when exactly one row carries that meaning:
    // then the single row's value is the document's value. Row fields are never
    // withheld (a row citing a document total stays unverified).
    const singleRow = (role: string) =>
      entries.filter((e) => e.level === "row" && e.role === role && e.field.original.value !== null).length === 1;
    for (const e of entries)
      if (e.level === "document" && singleRow(e.role) && scopeOnly(e.field) && verifiedElsewhere(e.role, e.field, e.level))
        withhold(e.field);
    const refRole: Record<string, string[]> = {
      house_bl: ["houseBlNumber"],
      export_declaration: ["declarationNumber"],
      other: ["houseBlNumber", "declarationNumber", "masterBlNumber"],
    };
    for (const r of doc.references)
      if (scopeOnly(r.number) && (refRole[r.kind] ?? []).some((role) => verifiedElsewhere(role, r.number, "document")))
        withhold(r.number);
  }
  const all = shippingValues(doc);
  const required: string[] = (type && requiredFields[type]) || requiredFields.house_bl;
  const present = (key: string) =>
    [
      doc.fields[key],
      ...doc.items.map((i) => i.fields[key]),
      ...doc.cargoRecords.map((c) => c.fields[key]),
      ...doc.containers.map(
        (c) => (c as unknown as Record<string, ShippingField>)[key],
      ),
    ].some(
      (f) => f?.original.value !== null && f?.original.value !== undefined,
    );
  doc.informationWarnings = required
    .filter((key) => !present(key))
    .map(
      (key) =>
        `${shippingFieldLabels[key as keyof typeof shippingFieldLabels]} 정보가 추출되지 않았습니다. 원문을 확인해 주세요.`,
    );
  for (const r of rejected)
    doc.informationWarnings.push(
      `AI가 ${r.kind === "item" ? "품목" : r.kind === "container" ? "컨테이너" : "화물 행"}으로 제안한 '${(r.value ?? "").slice(0, 40)}'은 원문 해당 표의 값이 아니어서 비교에서 제외했습니다.`,
    );
  doc.extractionStatus =
    rejected.length === 0 &&
    doc.informationWarnings.length === 0 &&
    doc.classificationStatus === "classified" &&
    all.every(
      (f) => f.original.value === null || f.original.status === "verified",
    )
      ? "complete"
      : "partial";
  doc.collectionCoverage = collectionCoverage32(doc, pdf);
  doc.factCoverage = nativeFactCoverage(doc, pdf);
  if (
    pdf.pages.some(
      (p) =>
        p.textSource === "ocr" ||
        p.ocrStatus === "candidate" ||
        p.ocrStatus === "failed",
    )
  )
    for (const c of Object.values(doc.collectionCoverage)) c.complete = false;
  const requiredCollections =
    type === "house_manifest"
      ? (["cargoRecords", "containers"] as const)
      : (["items", "containers"] as const);
  for (const key of requiredCollections) {
    const coverage = doc.collectionCoverage[key];
    if (coverage.rowCount > 0 && !coverage.complete) {
      doc.informationWarnings.push(
        "실제 PDF 표의 " +
          (key === "cargoRecords"
            ? "화물"
            : key === "containers"
              ? "컨테이너"
              : "품목") +
          " 행 일부가 누락되거나 행 근거가 미확인입니다. 전체 포함 범위를 확인해 주세요.",
      );
      doc.extractionStatus = "partial";
    }
  }
  return shippingDocumentSchema.parse(doc);
}
export function emptyShippingWire(
  type: ShippingWire["type"] = "unknown",
): ShippingWire {
  const f = { value: null, evidence: null };
  return shippingWireSchema.parse({
    type,
    typeEvidence: null,
    fields: Object.fromEntries(
      Object.keys(shippingFieldLabels).map((k) => [k, f]),
    ),
    items: [],
    containers: [],
    cargoRecords: [],
    references: [],
  });
}
export { itemFieldKeys, cargoFieldKeys };
