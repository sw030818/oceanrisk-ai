import { z } from "zod";
import { evidenceSchema } from "../documents/schema";
import {
  shippingTypes,
  shippingFields,
  numericShippingFields,
  type ShippingFieldKey,
  shippingFieldLabels,
  type ShippingType,
} from "./catalog";
import type { PdfDocument } from "../documents/schema";
export const shippingTypeSchema = z.enum(shippingTypes);
const sourceSchema = evidenceSchema.extend({
  scopeBasis: z.enum(["document_field", "entity_row"]).optional(),
  fileId: z.string().min(1),
  fileName: z.string().min(1),
  blocks: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        x: z.number().finite(),
        y: z.number().finite(),
        width: z.number().nonnegative(),
        height: z.number().nonnegative(),
        row: z.number().int().nonnegative(),
      }),
    )
    .max(12)
    .optional(),
  semanticRole: z.string().optional(),
  provenance: z.enum(["pdf_text", "ocr"]).optional(),
  layout: z
    .object({
      tableId: z.string(),
      rowId: z.string(),
      role: z.string(),
      unit: z.string().nullable(),
    })
    .optional(),
});
const valueSchema = z
  .union([
    z.string().max(300),
    z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
  ])
  .nullable();
const groundedSchema = z.object({
  value: valueSchema,
  status: z.enum(["verified", "unverified", "missing", "user_edited"]),
  reason: z.string(),
  source: sourceSchema.nullable(),
  verificationCode: z
    .enum([
      "verified",
      "missing_value",
      "missing_evidence",
      "quote_mismatch",
      "value_mismatch",
      "role_mismatch",
      "ambiguous_cell",
      "row_mismatch",
      "context_unverified",
      "user_edited",
      "ocr_unverified",
      "page_missing",
      "block_missing",
      "duplicate_block",
      "citation_too_long",
    ])
    .optional(),
});
// Original extraction and editable current state remain separate. A correction
// can never masquerade as a verified AI extraction.
export const shippingFieldSchema = z
  .object({
    original: groundedSchema,
    current: groundedSchema,
    recovery: z
      .object({
        method: z.enum(["native", "targeted_ai"]),
        field: groundedSchema,
        failureCode: z.enum([
          "MISSING_EXTRACTION",
          "WRONG_FIELD_ASSIGNMENT",
          "WRONG_ENTITY_ASSIGNMENT",
          "INVALID_CITATION",
          "NORMALIZED_VALUE_AS_LITERAL",
          "TRUE_VALUE_MISMATCH",
          "AMBIGUOUS_SOURCE",
          "OCR_UNVERIFIED",
          "SOURCE_NOT_PRESENT",
          "NOT_APPLICABLE",
        ]),
        target: z.string().max(200),
      })
      .optional(),
  })
  .superRefine((field, ctx) => {
    const recovered = field.recovery?.field;
    if (
      recovered &&
      (field.original.status === "verified" ||
        recovered.status !== "verified" ||
        recovered.source?.provenance !== "pdf_text" ||
        !recovered.source ||
        recovered.value === null)
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Recovery must preserve verified originals and independently verified native evidence",
      });
    const proof = recovered ?? field.original;
    if (field.original.status === "user_edited")
      ctx.addIssue({
        code: "custom",
        message: "Original extraction cannot be a user correction",
      });
    if (
      field.current.status === "verified" &&
      JSON.stringify(field.current) !== JSON.stringify(proof)
    )
      ctx.addIssue({
        code: "custom",
        message: "A modified field cannot acquire verified provenance",
      });
    if (
      field.current.value !== field.original.value &&
      field.current.status !== "user_edited" &&
      JSON.stringify(field.current) !== JSON.stringify(recovered)
    )
      ctx.addIssue({
        code: "custom",
        message: "A changed value must preserve user correction provenance",
      });
    for (const part of [
      field.original,
      field.current,
      ...(recovered ? [recovered] : []),
    ])
      if (part.status === "verified" && part.source?.provenance === "ocr")
        ctx.addIssue({
          code: "custom",
          message: "OCR is not independently verified native PDF text",
        });
    for (const part of [
      field.original,
      field.current,
      ...(field.recovery ? [field.recovery.field] : []),
    ])
      if (part.status === "verified" && (!part.source || part.value === null))
        ctx.addIssue({
          code: "custom",
          message: "Verified fields require a value and literal evidence",
        });
  });
export type ShippingField = z.infer<typeof shippingFieldSchema>;
const semanticField = (key: string) =>
  shippingFieldSchema.superRefine((field, ctx) => {
    const numeric = numericShippingFields.has(key as ShippingFieldKey);
    for (const part of [
      field.original,
      field.current,
      ...(field.recovery ? [field.recovery.field] : []),
    ])
      if (
        part.value !== null &&
        typeof part.value !== (numeric ? "number" : "string")
      )
        ctx.addIssue({
          code: "custom",
          message: "Field value type does not match its semantic role",
        });
  });
const textFields = (keys: readonly string[]) =>
  z
    .object(Object.fromEntries(keys.map((key) => [key, semanticField(key)])))
    .strict();
export const shipmentItemSchema = z.object({
  id: z.string().min(1),
  fields: textFields([
    "goodsDescription",
    "hsCode",
    "tradeDescription",
    "netWeight",
    "netWeightUnit",
    "quantity",
    "quantityUnit",
    "packageCount",
    "packageUnit",
    "grossWeight",
    "grossWeightUnit",
    "declaredWeight",
    "declaredWeightUnit",
  ]),
});
export const containerSchema = z.object({
  id: z.string().min(1),
  containerNumber: semanticField("containerNumber"),
  sealNumber: semanticField("sealNumber"),
  sealNumbers: z.array(semanticField("sealNumber")).max(30).optional(),
  packageCount: semanticField("packageCount"),
  packageUnit: semanticField("packageUnit"),
  grossWeight: semanticField("grossWeight"),
  weightUnit: semanticField("weightUnit"),
});
export const shipmentReferenceSchema = z.object({
  id: z.string().min(1),
  kind: z.enum([
    "house_bl",
    "export_declaration",
    "booking",
    "shipment",
    "other",
  ]),
  number: semanticField("referenceNumber"),
});
const common = {
  recoverySummary: z
    .object({
      targets: z.number().int().nonnegative(),
      nativeApplied: z.number().int().nonnegative(),
      aiApplied: z.number().int().nonnegative(),
      unresolved: z.number().int().nonnegative(),
      nativeDurationMs: z.number().nonnegative(),
      failures: z.record(z.string(), z.number().int().nonnegative()),
      extraRequests: z.number().int().min(0).max(1),
      deferred: z.boolean(),
    })
    .optional(),
  id: z.string().min(1),
  fileName: z.string().min(1),
  detectedType: shippingTypeSchema.nullable(),
  classificationStatus: z.enum(["not_performed", "classified", "needs_review"]),
  fields: z.record(z.string(), shippingFieldSchema),
  additionalFields: z
    .array(
      z
        .object({
          id: z.string().min(1),
          label: z.string().min(1).max(100),
          meaning: z.string().min(1).max(100),
          field: shippingFieldSchema,
        })
        .strict(),
    )
    .max(100)
    .default([]),
  items: z.array(shipmentItemSchema).max(100),
  containers: z.array(containerSchema).max(100),
  references: z.array(shipmentReferenceSchema).max(100),
  informationWarnings: z.array(z.string().max(200)).max(100).default([]),
  extractionStatus: z.enum(["not_performed", "partial", "complete"]),
  factCoverage: z
    .object({
      items: z.object({
        complete: z.boolean(),
        rows: z.array(z.string()).max(100),
      }),
      containers: z.object({
        complete: z.boolean(),
        rows: z.array(z.string()).max(100),
      }),
      cargoRecords: z.object({
        complete: z.boolean(),
        rows: z.array(z.string()).max(100),
      }),
      limitations: z
        .array(
          z.enum(["partial", "combined_packages", "incomplete_table", "ocr"]),
        )
        .max(4),
    })
    .optional(),
  collectionCoverage: z
    .object({
      items: z.object({
        complete: z.boolean(),
        rowCount: z.number().int().nonnegative(),
      }),
      containers: z.object({
        complete: z.boolean(),
        rowCount: z.number().int().nonnegative(),
      }),
      cargoRecords: z.object({
        complete: z.boolean(),
        rowCount: z.number().int().nonnegative(),
      }),
    })
    .optional(),
};
export const shippingDocumentSchema = z
  .object({
    nativeScopeLimitation: z.enum(["partial", "combined_packages"]).optional(),
    ...common,
    uploadType: shippingTypeSchema,
    fieldType: shippingTypeSchema.nullable().optional(),
    classification: shippingFieldSchema.optional(),
    cargoRecords: z
      .array(
        z.object({
          id: z.string().min(1),
          fields: textFields([
            ...shippingFields.house_manifest,
            "containerNumber",
            "sealNumber",
          ]).extend({
            hsCode: semanticField("hsCode").default(legacyCargoField),
            quantity: semanticField("quantity").default(legacyCargoField),
            quantityUnit:
              semanticField("quantityUnit").default(legacyCargoField),
          }),
        }),
      )
      .max(100)
      .default([]),
  })
  .strict()
  .superRefine((doc, ctx) => {
    const type = doc.fieldType === undefined ? doc.uploadType : doc.fieldType;
    const allowed = type
      ? shippingFields[type]
      : Object.keys(shippingFieldLabels);
    const parsed = textFields(allowed).safeParse(doc.fields);
    if (!parsed.success)
      ctx.addIssue({
        code: "custom",
        message: "Fields do not match their classified semantic document type",
      });
  });
export type ShippingDocument = z.infer<typeof shippingDocumentSchema>;
// Many-to-many, explicit scope links; never assume a BL/declaration is 1:1.
export const shipmentRelationshipSchema = z.object({
  id: z.string().min(1),
  documentIds: z.array(z.string().min(1)).min(2).max(100),
  itemIds: z.array(z.string()).max(100),
  containerIds: z.array(z.string()).max(100),
  referenceIds: z.array(z.string()).max(100),
  status: z.enum([
    "proposed",
    "user_confirmed",
    "evidence_confirmed",
    "conflict",
  ]),
  scope: z.enum(["unknown", "full", "partial", "combined_packages"]),
  reason: z.string(),
  entityLinks: z
    .array(
      z.object({
        id: z.string(),
        leftDocumentId: z.string(),
        leftKind: z.enum(["document", "item", "container", "cargo"]),
        leftId: z.string(),
        rightDocumentId: z.string(),
        rightKind: z.enum(["document", "item", "container", "cargo"]),
        rightId: z.string(),
        status: z.enum(["proposed", "evidence_confirmed"]),
        reason: z.string(),
      }),
    )
    .max(500)
    .optional(),
  entityRefs: z
    .array(
      z.object({
        documentId: z.string(),
        kind: z.enum(["document", "item", "container", "cargo", "reference"]),
        entityId: z.string(),
      }),
    )
    .max(1000)
    .optional(),
});
function entryIdentities(
  docs: ShippingDocument[],
  kind: "item" | "container" | "reference",
) {
  const entries = docs.flatMap((d) =>
    (kind === "item"
      ? d.items
      : kind === "container"
        ? d.containers
        : d.references
    ).map((r) => ({ doc: d.id, id: r.id })),
  );
  return new Set(
    entries.flatMap((e) => [
      [e.doc, kind, e.id].map(encodeURIComponent).join("/"),
      ...(entries.filter((r) => r.id === e.id).length === 1 ? [e.id] : []),
    ]),
  );
}
export const shippingCaseSchema = z
  .object({
    documents: z.array(shippingDocumentSchema).max(100),
    relationships: z.array(shipmentRelationshipSchema).max(100),
  })
  .superRefine((c, ctx) => {
    const ids = new Set(c.documents.map((d) => d.id));
    if (ids.size !== c.documents.length)
      ctx.addIssue({ code: "custom", message: "Duplicate document IDs" });
    for (const link of c.relationships) {
      if (
        new Set(link.documentIds).size !== link.documentIds.length ||
        link.documentIds.some((id) => !ids.has(id))
      )
        ctx.addIssue({
          code: "custom",
          message: "Relationship contains invalid document IDs",
        });
      const linkedDocuments = c.documents.filter((d) =>
        link.documentIds.includes(d.id),
      );
      const entryIds = {
        itemIds: entryIdentities(linkedDocuments, "item"),
        containerIds: entryIdentities(linkedDocuments, "container"),
        referenceIds: entryIdentities(linkedDocuments, "reference"),
      };
      for (const ref of link.entityRefs ?? []) {
        const d = linkedDocuments.find((d) => d.id === ref.documentId),
          rows = d
            ? ref.kind === "item"
              ? d.items
              : ref.kind === "container"
                ? d.containers
                : ref.kind === "cargo"
                  ? d.cargoRecords
                  : ref.kind === "reference"
                    ? d.references
                    : [{ id: d.id }]
            : [];
        if (rows.filter((r) => r.id === ref.entityId).length !== 1)
          ctx.addIssue({
            code: "custom",
            message: "Invalid qualified entity relationship",
          });
      }
      for (const binding of link.entityLinks ?? [])
        for (const side of ["left", "right"] as const) {
          const docId =
              side === "left"
                ? binding.leftDocumentId
                : binding.rightDocumentId,
            kind = side === "left" ? binding.leftKind : binding.rightKind,
            id = side === "left" ? binding.leftId : binding.rightId;
          const d = linkedDocuments.find((d) => d.id === docId),
            rows = d
              ? kind === "document"
                ? [{ id: d.id }]
                : kind === "item"
                  ? d.items
                  : kind === "container"
                    ? d.containers
                    : d.cargoRecords
              : [];
          if (rows.filter((r) => r.id === id).length !== 1)
            ctx.addIssue({
              code: "custom",
              message: "Invalid qualified row correspondence",
            });
        }
      for (const key of ["itemIds", "containerIds", "referenceIds"] as const)
        if (
          new Set(link[key]).size !== link[key].length ||
          link[key].some((id) => !entryIds[key].has(id))
        )
          ctx.addIssue({
            code: "custom",
            message: "Relationship refers to absent entries",
          });
    }
  });
function legacyCargoField(): ShippingField {
  const field = emptyShippingField();
  field.original.reason =
    "이전 분석 결과에 이 화물 필드가 포함되어 있지 않습니다.";
  field.current = structuredClone(field.original);
  return field;
}
export function emptyShippingField(): ShippingField {
  const field = {
    value: null,
    status: "missing" as const,
    reason:
      "AI가 이 필드를 아직 추출하지 않았습니다. PDF 원문에서 직접 확인할 수 있습니다.",
    verificationCode: "missing_value" as const,
    source: null,
  };
  return { original: { ...field }, current: { ...field } };
}
export function createShippingDocument(
  pdf: PdfDocument,
  uploadType: ShippingType,
): ShippingDocument {
  return shippingDocumentSchema.parse({
    id: pdf.id,
    fileName: pdf.fileName,
    uploadType,
    detectedType: null,
    classificationStatus: "not_performed",
    extractionStatus: "not_performed",
    fields: Object.fromEntries(
      shippingFields[uploadType].map((key) => [key, emptyShippingField()]),
    ),
    items: [],
    containers: [],
    references: [],
  });
}
