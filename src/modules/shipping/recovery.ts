import type { PdfDocument } from "../documents/schema";
import type { ShippingDocument, ShippingField } from "./schema";
import { shippingDocumentSchema, emptyShippingField } from "./schema";
import { shippingCell, type EntityScope } from "../layout/shipping-cells";
import {
  geometricRole,
  nativeCell,
  nativeDocumentField,
} from "../layout/shipping-geometry";
import { shippingRole, unitParents, rootTotalRole } from "./roles";
import { labelForValue } from "../layout/relations";
import { numericShippingFields } from "./catalog";
import { physicalLines, spanText } from "../layout/physical-spans";
import { portMeaning } from "./ports";
import { numericTokens } from "../evidence/numbers";
import { countAtoms } from "./count-atoms";
import { verifyShippingField } from "./verify";
import { independentlyVerified } from "./effective";
import { collectionCoverage32, nativeFactCoverage } from "./coverage";
import type { Candidate } from "./ai-schema";
export type FailureCode = NonNullable<ShippingField["recovery"]>["failureCode"];
export interface RecoveryTarget {
  id: string;
  role: string;
  scope: EntityScope;
  entityId: string;
  field: ShippingField;
  owner?: NonNullable<
    NonNullable<ShippingField["current"]["source"]>["layout"]
  >;
}
const eligible = new Set([
  "houseBlNumber",
  "declarationNumber",
  "containerNumber",
  "sealNumber",
  "packageCount",
  "packageUnit",
  "grossWeight",
  "grossWeightUnit",
  "netWeight",
  "netWeightUnit",
  "vessel",
  "voyage",
  "weightUnit",
  "quantity",
  "quantityUnit",
  "portOfLoading",
  "portOfDischarge",
  "goodsDescription",
  "hsCode",
  "shipper",
  "consignee",
]);
export function recoveryTargets(doc: ShippingDocument): RecoveryTarget[] {
  // A caller explicitly withholding a previously verified type is an unsupported
  // snapshot, not an unverified-title case. Preserve that existing opt-out.
  if (
    doc.classificationStatus !== "classified" &&
    doc.classification?.current.status === "verified"
  )
    return [];
  const out: RecoveryTarget[] = [];
  const add = (
    fields: Record<string, ShippingField>,
    scope: EntityScope,
    id: string,
    anchor?: ShippingField,
  ) => {
    const owner =
      anchor && independentlyVerified(anchor)
        ? anchor.current.source?.layout
        : undefined;
    const anchorRole =
      scope === "item"
        ? "goodsDescription"
        : scope === "container"
          ? "containerNumber"
          : "houseBlNumber";
    for (const [role, field] of Object.entries(fields))
      if (
        eligible.has(role) &&
        field.current.status !== "user_edited" &&
        !independentlyVerified(field) &&
        field.original.status !== "verified" &&
        (scope === "document" || owner || role === anchorRole)
      )
        out.push({
          id: `${scope}/${id}/${role}`,
          role,
          scope,
          entityId: id,
          field,
          owner,
        });
  };
  add(doc.fields, "document", doc.id);
  for (const extra of doc.additionalFields)
    add({ [extra.meaning]: extra.field }, "document", doc.id + "#" + extra.id);
  for (const ref of doc.references)
    if (ref.kind === "house_bl" || ref.kind === "export_declaration")
      add(
        {
          [ref.kind === "house_bl" ? "houseBlNumber" : "declarationNumber"]:
            ref.number,
        },
        "document",
        doc.id + "#" + ref.id,
      );
  for (const i of doc.items)
    add(
      i.fields,
      "item",
      i.id,
      i.fields.goodsDescription.current.value !== null
        ? i.fields.goodsDescription
        : i.fields.tradeDescription,
    );
  for (const c of doc.containers)
    add(
      Object.fromEntries(
        Object.entries(c).filter(([k]) => !["id", "sealNumbers"].includes(k)),
      ) as Record<string, ShippingField>,
      "container",
      c.id,
      c.containerNumber,
    );
  for (const c of doc.containers)
    for (const [index, s] of (c.sealNumbers ?? []).entries()) {
      if (
        independentlyVerified(c.containerNumber) &&
        s.original.status !== "verified" &&
        s.current.status !== "user_edited" &&
        !independentlyVerified(s)
      )
        out.push({
          id: `container/${c.id}/sealNumbers/${index}`,
          role: "sealNumber",
          scope: "container",
          entityId: c.id,
          field: s,
          owner: c.containerNumber.current.source?.layout,
        });
    }
  for (const c of doc.cargoRecords)
    add(c.fields, "cargo", c.id, c.fields.houseBlNumber);
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
export function failureCode(t: RecoveryTarget): FailureCode {
  const f = t.field.original,
    c = f.verificationCode;
  if (c === "ocr_unverified") return "OCR_UNVERIFIED";
  if (f.value === null) return "MISSING_EXTRACTION";
  if (c === "row_mismatch") return "WRONG_ENTITY_ASSIGNMENT";
  if (c === "role_mismatch") return "WRONG_FIELD_ASSIGNMENT";
  if (
    [
      "missing_evidence",
      "page_missing",
      "block_missing",
      "quote_mismatch",
      "duplicate_block",
    ].includes(c ?? "")
  )
    return "INVALID_CITATION";
  if (c === "ambiguous_cell") return "AMBIGUOUS_SOURCE";
  if (c === "value_mismatch" && t.role.startsWith("portOf"))
    return "NORMALIZED_VALUE_AS_LITERAL";
  return "TRUE_VALUE_MISMATCH";
}
// Candidate search is confined to independently identified roles and owner rows.
// Approval happens separately in verifyShippingField, never in this generator.
export function nativeCandidates(
  pdf: PdfDocument,
  t: RecoveryTarget,
): Candidate[] {
  const out: Candidate[] = [];
  if (
    pdf.pages.reduce((n, p) => n + (p.blocks?.length ?? 0), 0) > 1000 ||
    pdf.pages.reduce((n, p) => n + (p.cells?.length ?? 0), 0) > 1000
  )
    return out;
  for (const p of pdf.pages) {
    if (p.textSource === "ocr") continue;
    const joined = new Set<string>();
    if (!numericShippingFields.has(t.role as never) && !unitParents[t.role])
      for (const line of physicalLines(p)) {
        if (line.length < 2 || shippingRole(spanText(line))) continue;
        const value = spanText(line);
        if (t.role.startsWith("portOf") && !portMeaning(value)) continue;
        const c = {
          value,
          evidence: { page: p.page, blockIds: line.map((b) => b.id) },
        };
        // Same verifier, same ownership, real IDs; never global value search.
        if (
          verifyShippingField(c, pdf, t.role, t.scope, t.owner).current
            .status === "verified"
        ) {
          out.push(c);
          for (const b of line) joined.add(b.id);
        }
      }
    for (const b of p.blocks ?? []) {
      if (joined.has(b.id)) continue;
      if (!unitParents[t.role] && shippingRole(b.text)) continue;
      const link = shippingCell(p, [b], t.scope);
      const headingRole = shippingRole(b.text);
      const unitHeading =
        !!t.owner &&
        !!headingRole &&
        (unitParents[t.role] ?? []).includes(headingRole);
      if (
        t.scope !== "document" &&
        !unitHeading &&
        (!link ||
          (t.owner &&
            (link.tableId !== t.owner.tableId || link.rowId !== t.owner.rowId)))
      )
        continue;
      if (
        t.scope !== "document" &&
        !t.owner &&
        t.field.original.value !== null &&
        String(t.field.original.value).trim().toLowerCase() !==
          b.text.trim().toLowerCase()
      )
        continue;
      // A form value may be followed by an address or country in another cell.
      // The heading alone must not promote those neighbouring cells into a port.
      if (
        t.scope === "document" &&
        t.role.startsWith("portOf") &&
        p.cells?.length &&
        !nativeDocumentField(p, b)
      )
        continue;
      const probe = numericTokens(b.text)[0] ?? b.text;
      const role =
        link?.role ??
        geometricRole(p, b) ??
        shippingRole(b.text.split(":")[0]) ??
        labelForValue(p, [b], probe, shippingRole);
      const parents = unitParents[t.role] ?? [];
      const atoms = countAtoms(b.text).filter(
        (a) => a.role === t.role.replace(/Unit$/, ""),
      );
      if (
        role !== t.role &&
        rootTotalRole[t.role] !== role &&
        !parents.includes(role ?? "") &&
        !atoms.length
      )
        continue;
      const numeric = numericShippingFields.has(t.role as never);
      let stripped = b.text
        .replace(/^([^:]+):\s*/, (_whole, label: string) =>
          [t.role, rootTotalRole[t.role]].includes(shippingRole(label) ?? "")
            ? ""
            : _whole,
        )
        .trim();
      if (t.role === "hsCode") {
        const labelled = stripped.match(
          /^\(?HS(?:\s+CODE)?\s*:?\s*([0-9][0-9. -]*[0-9])\)?$/i,
        );
        if (labelled) stripped = labelled[1].trim();
      }
      if (
        t.role === "goodsDescription" &&
        stripped.split(/\s*\/\s*/).some((s) => countAtoms(s).length)
      )
        continue;
      const vals: (string | number)[] = numeric
        ? atoms.length
          ? atoms.map((a) => a.value)
          : numericTokens(stripped)
        : parents.length
          ? (stripped.match(
              /\b(?:PCS|EA|PIECES?|CTNS?|CARTONS?|CT|PKGS?|KGS?|TONNES?|TONS?|MT|M3|CBM)\b/gi,
            ) ?? [])
          : [stripped];
      for (const value of vals)
        if (
          value !== "" &&
          (typeof value === "string"
            ? value.length <= 300
            : Number.isFinite(value) &&
              value >= 0 &&
              value <= Number.MAX_SAFE_INTEGER)
        )
          out.push({ value, evidence: { page: p.page, blockIds: [b.id] } });
    }
  }
  return out;
}
export function mergeRecovery(
  pdf: PdfDocument,
  t: RecoveryTarget,
  candidate: Candidate,
  method: "native" | "targeted_ai",
): boolean {
  if (
    t.field.original.status === "verified" ||
    t.field.current.status === "user_edited" ||
    independentlyVerified(t.field)
  )
    return false;
  const tested = verifyShippingField(candidate, pdf, t.role, t.scope, t.owner);
  if (
    tested.current.status !== "verified" ||
    tested.current.source?.provenance !== "pdf_text"
  )
    return false;
  if (
    typeof candidate.value !==
    (numericShippingFields.has(t.role as never) ? "number" : "string")
  )
    return false;
  if (method === "targeted_ai") {
    const possibilities = nativeCandidates(pdf, t)
      .map((c) => verifyShippingField(c, pdf, t.role, t.scope, t.owner))
      .filter((f) => f.current.status === "verified");
    if (possibilities.length > 1) {
      if (typeof candidate.value === "number") return false;
      const source = tested.current.source!,
        page = pdf.pages.find((p) => p.page === source.page)!;
      const blocks = (source.segments ?? [])
        .map((s) => page.blocks?.find((b) => b.id === s.blockId))
        .filter((b) => !!b);
      const cell = blocks[0] && nativeCell(page, blocks[0]);
      if (
        !cell ||
        possibilities.some(
          (f) =>
            f.current.source?.page !== source.page ||
            f.current.source?.segments?.some((s) => {
              const b = page.blocks?.find((b) => b.id === s.blockId);
              return (
                !b ||
                nativeCell(page, b) !== cell ||
                !blocks.some((v) => v.id === b.id)
              );
            }),
        )
      )
        return false;
    }
  }
  const code = failureCode(t);
  t.field.recovery = {
    method,
    field: structuredClone(tested.current),
    target: t.id,
    failureCode: code,
  };
  t.field.current = structuredClone(tested.current);
  return true;
}
export function refreshRecoveryCoverage(
  doc: ShippingDocument,
  pdf: PdfDocument,
) {
  doc.collectionCoverage = collectionCoverage32(doc, pdf);
  doc.factCoverage = nativeFactCoverage(doc, pdf);
}
export function recoverNative(
  input: ShippingDocument,
  pdf: PdfDocument,
): ShippingDocument {
  const start = performance.now(),
    doc = structuredClone(input),
    targets = recoveryTargets(doc);
  if (
    doc.classificationStatus !== "classified" &&
    doc.classification?.current.status === "verified"
  )
    return doc;
  if (doc.classificationStatus !== "classified")
    doc.informationWarnings = [
      ...new Set([
        ...doc.informationWarnings,
        "문서 유형이 미확인이므로 개별 원문 근거 복구와 서류 간 확정 판정을 구분합니다.",
      ]),
    ];
  // A printed document-level goods count/unit may not be a native wire field
  // for a transport form. Preserve it as an explicitly native additional field,
  // never invent an initial AI value or borrow a product quantity from elsewhere.
  for (const role of [
    "quantity",
    "quantityUnit",
    "houseBlNumber",
    "declarationNumber",
  ])
    if (
      !doc.fields[role] &&
      !doc.additionalFields.some((f) => f.meaning === role)
    ) {
      const field = emptyShippingField(),
        t: RecoveryTarget = {
          id: `document/${doc.id}#native-${role}/${role}`,
          role,
          scope: "document",
          entityId: doc.id,
          field,
        };
      if (
        nativeCandidates(pdf, t).some(
          (c) =>
            verifyShippingField(c, pdf, role).current.status === "verified",
        )
      ) {
        doc.additionalFields.push({
          id: `native-${role}`,
          meaning: role,
          label: role,
          field,
        });
        targets.push(t);
      }
    }
  const failures: Record<string, number> = {};
  let applied = 0;
  const attempted = new Set<ShippingField>();
  // Recompute owners after anchor recovery, then inspect newly eligible fields.
  // Two bounded passes; no repeated processing of a failed target.
  for (let pass = 0; pass < 2; pass++) {
    for (const t of targets) {
      if (attempted.has(t.field)) continue;
      attempted.add(t.field);
      const verified = nativeCandidates(pdf, t)
        .map((c) => ({
          c,
          f: verifyShippingField(c, pdf, t.role, t.scope, t.owner),
        }))
        .filter(
          (v) =>
            v.f.current.status === "verified" &&
            v.f.current.source?.provenance === "pdf_text",
        );
      // A repeated literal in different source locations is ambiguous, even when
      // its numeric values happen to be equal. No first/nearest/global match.
      const unique = [
        ...new Map(
          verified.map((v) => [
            JSON.stringify([
              v.f.current.value,
              v.f.current.source?.page,
              v.f.current.source?.segments,
            ]),
            v,
          ]),
        ).values(),
      ];
      if (unique.length === 1 && mergeRecovery(pdf, t, unique[0].c, "native")) {
        applied++;
        continue;
      }
      const code =
        unique.length > 1
          ? "AMBIGUOUS_SOURCE"
          : pdf.pages.every((p) => p.textSource === "ocr")
            ? "OCR_UNVERIFIED"
            : nativeCandidates(pdf, t).length
              ? failureCode(t)
              : "SOURCE_NOT_PRESENT";
      failures[code] = (failures[code] ?? 0) + 1;
    }
    for (const t of recoveryTargets(doc))
      if (!attempted.has(t.field) && !targets.some((v) => v.field === t.field))
        targets.push(t);
  }
  refreshRecoveryCoverage(doc, pdf);
  doc.recoverySummary = {
    targets: attempted.size,
    nativeApplied: applied,
    aiApplied: 0,
    unresolved: attempted.size - applied,
    nativeDurationMs: Math.round(performance.now() - start),
    failures,
    extraRequests: 0,
    deferred: false,
  };
  return shippingDocumentSchema.parse(doc);
}
export function recoveryStage(
  input: ShippingDocument,
  pdf: PdfDocument,
  stage: "initial" | "native" | "final",
) {
  if (stage === "final") return input;
  const doc = structuredClone(input);
  const visit = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    const f = v as ShippingField;
    if (f.original && f.current) {
      if (stage === "initial" || f.recovery?.method === "targeted_ai") {
        f.current = structuredClone(f.original);
        delete f.recovery;
      }
      return;
    }
    for (const x of Object.values(v)) visit(x);
  };
  visit(doc);
  delete doc.recoverySummary;
  refreshRecoveryCoverage(doc, pdf);
  return doc;
}
