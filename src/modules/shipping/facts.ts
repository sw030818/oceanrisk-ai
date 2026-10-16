import { goodsComparisonValue } from "./goods-context";
// Native facts and derived HBL scopes. Never mutate original/current fields.
import type { ShippingDocument } from "./schema";
import {
  identifiers32,
  root32,
  ref32,
  refKey32,
  scope32,
  text32,
  unit32,
  verified32,
  has32,
  type FieldRef,
} from "./review-evidence";
import { contextualCarton, goodsCore } from "./equivalence";
export type FactReason =
  | "FIELD_NOT_EXTRACTED"
  | "FIELD_NOT_APPLICABLE"
  | "EVIDENCE_UNVERIFIED"
  | "USER_EDITED"
  | "SCOPE_UNRESOLVED"
  | "UNIT_INCOMPATIBLE"
  | "RELATIONSHIP_UNVERIFIED"
  | "PARTIAL_SHIPMENT"
  | "COMBINED_PACKAGES"
  | "DUPLICATE_CARGO"
  | "AGGREGATION_INCOMPLETE"
  | "SOURCE_CONFLICT"
  | "DECLARATION_SCOPE_UNRESOLVED";
export type FactScope =
  | "document_total"
  | "hbl_total"
  | "item_row"
  | "container"
  | "cargo_row"
  | "declaration_total"
  | "verified_aggregation"
  | "partial"
  | "unknown";
export type NumericMeaning =
  | "quantity"
  | "packageCount"
  | "grossWeight"
  | "netWeight";
export const numericMeaning = {
  quantity: {
    unit: "quantityUnit",
    category: "quantity",
    title: "기재 물품 수량 (합계/단일품목 범위)",
  },
  packageCount: {
    unit: "packageUnit",
    category: "packaging",
    title: "문서 전체 포장 개수",
  },
  grossWeight: {
    unit: "grossWeightUnit",
    category: "weight",
    title: "문서 전체 총중량",
  },
  netWeight: {
    unit: "netWeightUnit",
    category: "weight",
    title: "문서 전체 순중량",
  },
} as const;
export interface ShipmentFact {
  alternatives?: ShipmentFact[];
  unmappedRefs?: FieldRef[];
  id: string;
  documentId: string;
  documentType: ShippingDocument["detectedType"];
  meaning: NumericMeaning;
  hbl: string | null;
  scope: FactScope;
  refs: FieldRef[];
  unitRefs: FieldRef[];
  originalValues: (string | number | null)[];
  originalUnits: (string | number | null)[];
  value: number | null;
  unit: string | null;
  verified: boolean;
  userEdited: boolean;
  derivation:
    | "literal"
    | "single_native_row"
    | "sum_native_rows"
    | "user_override";
  componentKeys: string[];
  scopeEvidence: string[];
  reasons: FactReason[];
}
export const factHbl = (doc: ShippingDocument) => {
  const ids = [
    ...new Set(
      identifiers32(doc, "houseBlNumber")
        .filter(verified32)
        .map((f) => text32(f.field.current.value)),
    ),
  ];
  return ids.length === 1 ? ids[0] : null;
};
const rowKey = (f: FieldRef) => {
  const s = f.field.current.source;
  return s?.layout ? `${s.page}/${s.layout.tableId}/${s.layout.rowId}` : null;
};
function normalized(ref: FieldRef | undefined, meaning: NumericMeaning) {
  const category = numericMeaning[meaning].category;
  return category === "packaging" && contextualCarton(ref)
    ? { unit: "CTNS", factor: 1 }
    : unit32(ref?.field.current.value, category);
}
function makeFact(
  doc: ShippingDocument,
  meaning: NumericMeaning,
  refs: FieldRef[],
  units: FieldRef[],
  scope: FactScope,
  derivation: ShipmentFact["derivation"],
  reasons: FactReason[],
  scopeEvidence: string[],
): ShipmentFact {
  const ns = units.map((u) => normalized(u, meaning));
  if (
    !refs.length ||
    units.length !== refs.length ||
    refs.some((f) => !has32(f.field)) ||
    units.some((f) => !has32(f.field))
  )
    reasons.push("FIELD_NOT_EXTRACTED");
  if (refs.length && [...refs, ...units].some((f) => !verified32(f)))
    reasons.push(
      [...refs, ...units].some((f) => f.field.current.status === "user_edited")
        ? "USER_EDITED"
        : "EVIDENCE_UNVERIFIED",
    );
  if (
    units.length &&
    (ns.some((n) => !n) || new Set(ns.map((n) => n?.unit)).size !== 1)
  )
    reasons.push("UNIT_INCOMPATIBLE");
  const value =
    !(
      derivation === "sum_native_rows" &&
      (reasons.includes("AGGREGATION_INCOMPLETE") ||
        reasons.includes("DUPLICATE_CARGO") ||
        reasons.includes("COMBINED_PACKAGES"))
    ) &&
    refs.length &&
    ns.length === refs.length &&
    refs.every((f) => typeof f.field.current.value === "number") &&
    ns.every(Boolean)
      ? refs.reduce(
          (s, f, i) => s + Number(f.field.current.value) * ns[i]!.factor,
          0,
        )
      : null;
  if (
    value !== null &&
    (!Number.isFinite(value) || value > Number.MAX_SAFE_INTEGER)
  )
    reasons.push("SOURCE_CONFLICT");
  return {
    id: doc.id + "/fact/" + meaning,
    documentId: doc.id,
    documentType: doc.detectedType,
    meaning,
    hbl: factHbl(doc),
    scope,
    refs,
    unitRefs: units,
    originalValues: refs.map((f) => f.field.original.value),
    originalUnits: units.map((f) => f.field.original.value),
    value,
    unit: ns[0]?.unit ?? null,
    verified:
      [...refs, ...units].length > 0 && [...refs, ...units].every(verified32),
    userEdited: [...refs, ...units].some(
      (f) => f.field.current.status === "user_edited",
    ),
    derivation,
    componentKeys: refs.map(refKey32),
    scopeEvidence: [...new Set(scopeEvidence)].sort(),
    reasons: [...new Set(reasons)].sort(),
  };
}
// Coverage is produced independently from every actual PDF row by groundShipping,
// not by the model's array length. Old/OCR snapshots cannot create this proof.
function nativeRows(
  doc: ShippingDocument,
  kind: "items" | "containers" | "cargoRecords",
  anchors: FieldRef[],
) {
  const c = doc.factCoverage?.[kind];
  return (
    !!c?.complete &&
    c.rows.length === anchors.length &&
    c.rows.length > 0 &&
    anchors.every((f) => verified32(f) && c.rows.includes(rowKey(f) ?? "")) &&
    new Set(anchors.map(rowKey)).size === anchors.length
  );
}
export function resolveHblFact(
  doc: ShippingDocument,
  meaning: NumericMeaning,
  documents: ShippingDocument[],
  ignoreRoot = false,
  targetHbl?: string,
): ShipmentFact {
  const unitKey = numericMeaning[meaning].unit,
    reasons: FactReason[] = [],
    hbl = targetHbl ?? factHbl(doc),
    uniqueHbl = factHbl(doc),
    scope = scope32(doc);
  if (!hbl) reasons.push("SCOPE_UNRESOLVED");
  if (doc.factCoverage?.limitations.includes("ocr"))
    reasons.push("EVIDENCE_UNVERIFIED");
  if (scope === "partial") reasons.push("PARTIAL_SHIPMENT");
  if (scope === "combined_packages" && meaning !== "quantity")
    reasons.push("COMBINED_PACKAGES");
  if (doc.classificationStatus !== "classified")
    reasons.push("EVIDENCE_UNVERIFIED");
  if (
    doc.detectedType === "export_declaration" &&
    hbl &&
    documents.filter(
      (d) =>
        d.classificationStatus === "classified" &&
        d.detectedType === "export_declaration" &&
        factHbl(d) === hbl,
    ).length > 1
  )
    reasons.push("DECLARATION_SCOPE_UNRESOLVED");
  if (
    hbl &&
    documents.filter(
      (d) =>
        d.classificationStatus === "classified" &&
        d.detectedType === "house_bl" &&
        factHbl(d) === hbl,
    ).length > 1
  )
    reasons.push("DUPLICATE_CARGO");
  const numericFields = [
    doc.fields[meaning],
    ...doc.additionalFields
      .filter((f) => f.meaning === meaning)
      .map((f) => f.field),
  ];
  const unitFields = [
    doc.fields[unitKey],
    ...doc.additionalFields
      .filter((f) => f.meaning === unitKey)
      .map((f) => f.field),
  ];
  const childFields = [
    ...doc.items.flatMap((i) => [i.fields[meaning], i.fields[unitKey]]),
    ...doc.cargoRecords.flatMap((c) => [c.fields[meaning], c.fields[unitKey]]),
    ...doc.containers.flatMap((c) => [
      (c as unknown as Record<string, import("./schema").ShippingField>)[
        meaning
      ],
      meaning === "grossWeight"
        ? c.weightUnit
        : meaning === "packageCount"
          ? c.packageUnit
          : undefined,
    ]),
  ];
  const childEdited = childFields.some(
    (f) => f?.current.status === "user_edited",
  );
  if (
    [
      ...numericFields,
      ...unitFields,
      ...childFields,
      doc.fields.shipmentScope,
    ].some((f) => f?.current.status === "user_edited")
  )
    reasons.push("USER_EDITED");
  const directNumeric = numericFields.find(
    (f) => f?.current.status === "user_edited",
  );
  const directUnit = unitFields.find(
    (f) => f?.current.status === "user_edited",
  );
  if (!ignoreRoot && (directNumeric || directUnit)) {
    const numeric = directNumeric
        ? ref32(doc, meaning, directNumeric)
        : root32(doc, meaning),
      ownUnit = directUnit
        ? ref32(doc, unitKey, directUnit)
        : root32(doc, unitKey);
    const inherited = !directUnit
      ? resolveHblFact(doc, meaning, documents, true, hbl ?? undefined)
      : null;
    const units = ownUnit
      ? [ownUnit]
      : inherited?.scopeEvidence.length && inherited.unitRefs.every(verified32)
        ? [inherited.unitRefs[0]]
        : [];
    return makeFact(
      doc,
      meaning,
      numeric ? [numeric] : [],
      units,
      "unknown",
      "user_override",
      [...reasons, "USER_EDITED"],
      inherited?.scopeEvidence ?? [],
    );
  }
  const root = root32(doc, meaning),
    unit = root32(doc, unitKey);
  const rootNative =
    root &&
    unit &&
    [root, unit].every(
      (f) =>
        verified32(f) &&
        (f.field.current.source?.scopeBasis === "document_field" ||
          (f.field.current.source?.provenance === "pdf_text" &&
            !f.field.current.source?.layout &&
            !!f.field.current.source?.semanticRole)),
    );
  // A document containing several HBLs cannot lend its document total to one HBL.
  if (!ignoreRoot && !childEdited && rootNative && hbl && uniqueHbl === hbl) {
    const printed = makeFact(
      doc,
      meaning,
      [root],
      [unit],
      doc.detectedType === "export_declaration"
        ? "declaration_total"
        : "document_total",
      "literal",
      reasons,
      ["native_document_label", "unique_verified_hbl"],
    );
    const derived = resolveHblFact(doc, meaning, documents, true, hbl);
    if (derived.reasons.length === 0 && derived.value !== null) {
      printed.alternatives = [derived];
      if (
        derived.unit === printed.unit &&
        Math.abs(derived.value - printed.value!) >
          Math.max(1, Math.abs(derived.value), Math.abs(printed.value!)) * 1e-9
      )
        printed.reasons = [
          ...new Set([...printed.reasons, "SOURCE_CONFLICT" as const]),
        ].sort();
    }
    return printed;
  }
  const options: {
    refs: FieldRef[];
    units: FieldRef[];
    anchors: FieldRef[];
    kind: "items" | "containers" | "cargoRecords";
    names: string[];
  }[] = [];
  const itemRows = [...(uniqueHbl === hbl ? doc.items : [])]
    .sort((a, b) => a.id.localeCompare(b.id))
    .filter(
      (i) =>
        has32(i.fields.goodsDescription) || has32(i.fields.tradeDescription),
    );
  options.push({
    kind: "items",
    refs: itemRows.map((i) =>
      ref32(doc, meaning, i.fields[meaning], { itemId: i.id }),
    ),
    units: itemRows.map((i) =>
      ref32(doc, unitKey, i.fields[unitKey], { itemId: i.id }),
    ),
    anchors: itemRows.map((i) =>
      ref32(
        doc,
        "goodsDescription",
        has32(i.fields.goodsDescription)
          ? i.fields.goodsDescription
          : i.fields.tradeDescription,
        { itemId: i.id },
      ),
    ),
    names: itemRows.map((i) =>
      goodsCore(
        goodsComparisonValue(i.fields.goodsDescription) ??
          goodsComparisonValue(i.fields.tradeDescription),
      ),
    ),
  });
  const cargo = [...doc.cargoRecords]
    .sort((a, b) => a.id.localeCompare(b.id))
    .filter((c) => hbl && text32(c.fields.houseBlNumber.current.value) === hbl);
  if (meaning !== "netWeight")
    options.push({
      kind: "cargoRecords",
      refs: cargo.map((c) =>
        ref32(doc, meaning, c.fields[meaning], { cargoId: c.id }),
      ),
      units: cargo.map((c) =>
        ref32(doc, unitKey, c.fields[unitKey], { cargoId: c.id }),
      ),
      anchors: cargo.map((c) =>
        ref32(doc, "houseBlNumber", c.fields.houseBlNumber, { cargoId: c.id }),
      ),
      names: cargo.map((c) => text32(c.fields.containerNumber.current.value)),
    });
  if (
    uniqueHbl === hbl &&
    (meaning === "packageCount" || meaning === "grossWeight")
  )
    options.push({
      kind: "containers",
      refs: [...doc.containers]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((c) => ref32(doc, meaning, c[meaning], { containerId: c.id })),
      units: [...doc.containers]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((c) =>
          ref32(
            doc,
            unitKey,
            meaning === "grossWeight" ? c.weightUnit : c.packageUnit,
            { containerId: c.id },
          ),
        ),
      anchors: [...doc.containers]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((c) =>
          ref32(doc, "containerNumber", c.containerNumber, {
            containerId: c.id,
          }),
        ),
      names: [...doc.containers]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((c) => text32(c.containerNumber.current.value)),
    });
  // Prefer a complete actual row representation, never sum overlapping item,
  // cargo and container views of the same native cells together.
  options.sort(
    (a, b) =>
      Number(
        b.kind === "cargoRecords" && doc.detectedType === "house_manifest",
      ) -
      Number(
        a.kind === "cargoRecords" && doc.detectedType === "house_manifest",
      ),
  );
  const validFacts: ShipmentFact[] = [],
    invalidFacts: ShipmentFact[] = [];
  for (const o of options) {
    if (
      !o.refs.length ||
      o.refs.some((f) => !has32(f.field)) ||
      o.units.some((f) => !has32(f.field))
    )
      continue;
    const local = [...reasons];
    const complete = nativeRows(
      doc,
      o.kind,
      o.kind === "cargoRecords"
        ? doc.cargoRecords.map((c) =>
            ref32(doc, "houseBlNumber", c.fields.houseBlNumber, {
              cargoId: c.id,
            }),
          )
        : o.anchors,
    );
    if (!complete) local.push("AGGREGATION_INCOMPLETE");
    if (o.names.some((n) => !n) || new Set(o.names).size !== o.names.length)
      local.push("DUPLICATE_CARGO");
    if (o.kind === "cargoRecords") {
      if (
        doc.cargoRecords.some(
          (c) =>
            !cargo.includes(c) &&
            cargo.some(
              (r) =>
                text32(c.fields.containerNumber.current.value) ===
                text32(r.fields.containerNumber.current.value),
            ),
        ) &&
        meaning !== "quantity"
      )
        local.push("COMBINED_PACKAGES");
      if (
        cargo.some(
          (c) =>
            !verified32(
              ref32(doc, "containerNumber", c.fields.containerNumber, {
                cargoId: c.id,
              }),
            ),
        )
      )
        local.push("EVIDENCE_UNVERIFIED");
    }
    // Packages/weights of multiple products may share packing. Only independent
    // verified container/cargo rows can be summed without explicit allocation.
    if (o.kind === "items" && o.refs.length > 1 && meaning !== "quantity")
      local.push("COMBINED_PACKAGES");
    if (
      o.kind === "items" &&
      o.refs.length > 1 &&
      meaning === "quantity" &&
      itemRows.some(
        (i) =>
          !verified32(ref32(doc, "hsCode", i.fields.hsCode, { itemId: i.id })),
      )
    )
      local.push("SCOPE_UNRESOLVED");
    if (!hbl) local.push("SCOPE_UNRESOLVED");
    if (doc.factCoverage?.limitations.includes("incomplete_table"))
      local.push("AGGREGATION_INCOMPLETE");
    if (doc.factCoverage?.limitations.includes("ocr"))
      local.push("EVIDENCE_UNVERIFIED");
    const out = makeFact(
      doc,
      meaning,
      o.refs,
      o.units,
      o.refs.length === 1 ? "hbl_total" : "verified_aggregation",
      o.refs.length === 1 ? "single_native_row" : "sum_native_rows",
      local,
      complete
        ? [
            "all_native_rows_included",
            uniqueHbl === hbl
              ? "unique_verified_hbl"
              : "explicit_verified_cargo_hbl",
            ...o.anchors.map((f) => rowKey(f)!),
          ]
        : [],
    );
    out.hbl = hbl;
    if (out.reasons.length === 0) validFacts.push(out);
    else invalidFacts.push(out);
  }
  if (validFacts.length) {
    const first = validFacts[0];
    if (validFacts.length > 1) {
      first.alternatives = validFacts.slice(1);
      if (
        first.alternatives.some(
          (f) =>
            f.unit !== first.unit ||
            Math.abs(f.value! - first.value!) >
              Math.max(1, Math.abs(f.value!), Math.abs(first.value!)) * 1e-9,
        )
      )
        first.reasons.push("SOURCE_CONFLICT");
    }
    return first;
  }
  if (invalidFacts.length) {
    const out = invalidFacts[0];
    if (out.reasons.includes("PARTIAL_SHIPMENT")) out.scope = "partial";
    else if (
      out.reasons.some((r) =>
        [
          "AGGREGATION_INCOMPLETE",
          "SCOPE_UNRESOLVED",
          "DUPLICATE_CARGO",
          "COMBINED_PACKAGES",
        ].includes(r),
      )
    )
      out.scope = "unknown";
    return out;
  }
  if (hbl && uniqueHbl !== hbl && root) {
    const out = makeFact(
      doc,
      meaning,
      [],
      [],
      "unknown",
      "literal",
      [...reasons, "SCOPE_UNRESOLVED"],
      [],
    );
    out.hbl = hbl;
    out.unmappedRefs = [root, ...(unit ? [unit] : [])];
    out.originalValues = [root.field.original.value];
    out.originalUnits = unit ? [unit.field.original.value] : [];
    return out;
  }
  // Missing/unsafe data remains visible. No fictitious derived verified field.
  const fallback = options.find(
    (o) => o.refs.length && o.refs.some((f) => has32(f.field)),
  );
  if (!ignoreRoot && root && unit && uniqueHbl === hbl)
    return makeFact(
      doc,
      meaning,
      [root],
      [unit],
      "unknown",
      "literal",
      [...reasons, "SCOPE_UNRESOLVED"],
      [],
    );
  if (fallback)
    return makeFact(
      doc,
      meaning,
      fallback.refs,
      fallback.units,
      "unknown",
      fallback.refs.length === 1 ? "single_native_row" : "sum_native_rows",
      [
        ...reasons,
        "AGGREGATION_INCOMPLETE",
        ...(fallback.names.length !== new Set(fallback.names).size
          ? ["DUPLICATE_CARGO" as const]
          : []),
      ],
      [],
    );
  return makeFact(
    doc,
    meaning,
    [],
    [],
    "unknown",
    "literal",
    [...reasons, "FIELD_NOT_EXTRACTED"],
    [],
  );
}
