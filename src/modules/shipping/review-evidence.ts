import { normalizeText } from "../evidence/verify";
import { canonicalUnit, packageUnit } from "../documents/units";
import type { ShippingDocument, ShippingField } from "./schema";
import type { ShippingCheck } from "./review-model";
import { independentlyVerified } from "./effective";
export type FieldRef = ShippingCheck["fields"][number];
export const key32 = (doc: string, kind: string, id: string) =>
  [doc, kind, id].map(encodeURIComponent).join("/");
export const refKey32 = (r: FieldRef) =>
  key32(
    r.documentId,
    r.itemId
      ? "item"
      : r.containerId
        ? "container"
        : r.cargoId
          ? "cargo"
          : r.referenceId
            ? "reference"
            : "document",
    r.itemId ?? r.containerId ?? r.cargoId ?? r.referenceId ?? r.documentId,
  ) +
  "/" +
  r.fieldName;
export const text32 = (v: unknown) =>
  typeof v === "string" ? normalizeText(v) : String(v ?? "");
export const has32 = (f: ShippingField | undefined) =>
  f?.current.value !== null &&
  f?.current.value !== undefined &&
  f.current.value !== "";
export const verified32 = (r: FieldRef) =>
  independentlyVerified(r.field) &&
  r.field.current.source?.fileId === r.documentId;
export function root32(
  doc: ShippingDocument,
  name: string,
): FieldRef | undefined {
  const all = [
    ...(doc.fields[name] ? [doc.fields[name]] : []),
    ...doc.additionalFields
      .filter((e) => e.meaning === name)
      .map((e) => e.field),
  ].filter(has32);
  if (all.length !== 1) {
    if (all.some((f) => f.current.status === "user_edited")) return;
    const proven = all.filter(independentlyVerified),
      signatures = new Set(
        proven.map((f) =>
          JSON.stringify([
            f.current.value,
            f.current.source?.page,
            f.current.source?.segments,
          ]),
        ),
      );
    if (!proven.length || signatures.size !== 1) return;
    return { documentId: doc.id, fieldName: name, field: proven[0] };
  }
  return { documentId: doc.id, fieldName: name, field: all[0] };
}
// A misplaced document candidate is not another cargo fact. Prefer the exact
// same native citation's unique proved item owner, retaining the root diagnostic.
// No cross-document, same-number, edited, OCR or incomplete-row substitution.
export function comparisonField32(doc:ShippingDocument,name:string):FieldRef|undefined {
  const root=root32(doc,name);
  if(name!=="goodsDescription"||!root||root.field.current.status!=="unverified"||doc.nativeScopeLimitation||doc.fields.shipmentScope?.current.status==="user_edited")return root;
  const source=root.field.current.source;
  if(!source||source.provenance==="ocr"||!source.segments?.length)return root;
  const item=doc.items.length===1&&doc.factCoverage?.items.complete?doc.items[0]:undefined;
  const cargo=!doc.items.length&&doc.cargoRecords.length===1&&doc.factCoverage?.cargoRecords.complete?doc.cargoRecords[0]:undefined;
  const owner=item??cargo,field=owner?.fields.goodsDescription;
  if(!owner||!field||!independentlyVerified(field)||field.current.value!==root.field.current.value)return root;
  const proof=field.current.source;
  if(proof?.fileId!==doc.id||source.fileId!==doc.id||proof.page!==source.page||!source.segments.every(s=>proof.segments?.some(p=>p.blockId===s.blockId)))return root;
  return {documentId:doc.id,fieldName:name,field,...(item?{itemId:item.id}:{cargoId:cargo!.id})};
}
export const ref32 = (
  doc: ShippingDocument,
  name: string,
  field: ShippingField,
  entry?: {
    itemId?: string;
    containerId?: string;
    cargoId?: string;
    referenceId?: string;
  },
): FieldRef => ({ documentId: doc.id, fieldName: name, field, ...entry });
const referenceRole = {
  house_bl: "houseBlNumber",
  export_declaration: "declarationNumber",
  shipment: "shipmentReference",
  booking: "bookingReference",
  other: "otherReference",
};
export function identifiers32(doc: ShippingDocument, role: string): FieldRef[] {
  const root = root32(doc, role),
    refs = doc.references
      .filter((r) => referenceRole[r.kind] === role && has32(r.number))
      .map((r) => ref32(doc, role, r.number, { referenceId: r.id }));
  const cargos =
    role === "houseBlNumber"
      ? doc.cargoRecords
          .filter((r) => has32(r.fields.houseBlNumber))
          .map((r) =>
            ref32(doc, role, r.fields.houseBlNumber, { cargoId: r.id }),
          )
      : [];
  return [...(root ? [root] : []), ...refs, ...cargos]
    .filter((f) => !isPlaceholder32(f.field.current.value))
    .sort((a, b) => refKey32(a).localeCompare(refKey32(b)));
}
export function scope32(doc: ShippingDocument) {
  if (doc.nativeScopeLimitation) return doc.nativeScopeLimitation;
  const f = root32(doc, "shipmentScope");
  if (!f || !verified32(f)) return "unknown" as const;
  const v = text32(f.field.current.value);
  if (
    /^(?:no[- ]partial(?: shipment)?|not partial|부분\s*선적\s*없음|분할\s*선적\s*없음)$/.test(
      v,
    )
  )
    return "full" as const;
  if (/not permitted|not allowed|불가|금지/.test(v)) return "unknown" as const;
  if (/partial|backorder|부분|분할/.test(v)) return "partial" as const;
  if (/combined|co.?pack|동시포장|공동포장/.test(v))
    return "combined_packages" as const;
  if (/^(full|complete|entire)( shipment)?$|전체\s*선적|전량\s*선적/.test(v))
    return "full" as const;
  return "unknown" as const;
}
export function unit32(
  value: unknown,
  kind: "quantity" | "packaging" | "weight",
): { unit: string; factor: number } | null {
  if (typeof value !== "string") return null;
  const raw = text32(value).replace(/\.$/, "");
  if (kind === "weight") {
    const weights: Record<string, number> = {
      kg: 1,
      kgs: 1,
      kilogram: 1,
      kilograms: 1,
      g: 0.001,
      grams: 0.001,
      gram: 0.001,
      mt: 1000,
      tonne: 1000,
      tonnes: 1000,
      "metric ton": 1000,
    };
    return weights[raw] ? { unit: "KG", factor: weights[raw] } : null;
  }
  const u =
    kind === "quantity"
      ? canonicalUnit(value)
      : (packageUnit(value) ??
        (
          {
            pkg: "PKGS",
            pkgs: "PKGS",
            package: "PKGS",
            packages: "PKGS",
            box: "BOX",
            boxes: "BOX",
            pallet: "PALLETS",
            pallets: "PALLETS",
            bag: "BAGS",
            bags: "BAGS",
          } as Record<string, string>
        )[raw]);
  return u && (kind !== "quantity" || ["PCS", "M"].includes(u))
    ? { unit: u, factor: 1 }
    : null;
}

// A Manifest cargo row already carries independently grounded container/Seal
// fields. Use that actual cargo identity when no redundant container array was
// extracted; never synthesize a new AI row or flatten several cargo records.
export function containerViews32(doc: ShippingDocument) {
  const defined = doc.containers.filter((c) => has32(c.containerNumber));
  if (defined.length)
    return defined.map((c) => ({ ...c, kind: "container" as const }));
  return doc.cargoRecords
    .filter((c) => has32(c.fields.containerNumber))
    .map((c) => ({
      id: c.id,
      kind: "cargo" as const,
      containerNumber: c.fields.containerNumber,
      sealNumber: c.fields.sealNumber,
      sealNumbers: has32(c.fields.sealNumber) ? [c.fields.sealNumber] : [],
      packageCount: c.fields.packageCount,
      packageUnit: c.fields.packageUnit,
      grossWeight: c.fields.grossWeight,
      weightUnit: c.fields.grossWeightUnit,
    }));
}
export const containerEntry32 = (
  c: ReturnType<typeof containerViews32>[number],
) => (c.kind === "cargo" ? { cargoId: c.id } : { containerId: c.id });

export const isPlaceholder32 = (v: unknown) =>
  typeof v === "string" &&
  /^(?:n\/?a|n\.a\.|tba|tbd|unknown|none|pending|not available|미정|미확인|없음|0+|[-—–]+)$/i.test(
    text32(v),
  );
