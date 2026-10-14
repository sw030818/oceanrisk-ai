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
import { verifyShippingField, verifyClassification } from "./verify";
import type { PdfDocument } from "../documents/schema";
import type { EntityScope } from "../layout/shipping-cells";
export function groundShipping(
  raw: unknown,
  pdf: PdfDocument,
  slot: ShippingType,
): ShippingDocument {
  const wire = shippingWireSchema.parse(raw);
  const classification = verifyClassification(
    wire.type,
    wire.typeEvidence,
    pdf,
  );
  const type = wire.type === "unknown" ? null : wire.type;
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
    classification.original.status === "verified"
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
    rows.forEach((row, i) => {
      if (
        addresses[i] &&
        addresses.filter((a) => a === addresses[i]).length > 1
      )
        for (const f of Object.values(row))
          if (f.original.value !== null) {
            f.original = {
              ...f.original,
              status: "unverified",
              verificationCode: "ambiguous_cell",
              reason:
                "동일 원문 행을 여러 항목으로 중복 추출해 독립 항목으로 확정하지 않습니다.",
            };
            f.current = structuredClone(f.original);
          }
    });
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
  const all = shippingValues(doc);
  const required =
    type === "export_declaration"
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
  doc.extractionStatus =
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
