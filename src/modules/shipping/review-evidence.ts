import { normalizeText } from "../evidence/verify";
import { canonicalUnit, packageUnit } from "../documents/units";
import type { ShippingDocument, ShippingField } from "./schema";
import type { ShippingCheck } from "./review-model";
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
  r.field.current.status === "verified" &&
  r.field.original.status === "verified" &&
  r.field.current.value !== null &&
  r.field.original.source?.fileId === r.documentId &&
  JSON.stringify(r.field.current) === JSON.stringify(r.field.original);
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
  if (all.length !== 1) return;
  return { documentId: doc.id, fieldName: name, field: all[0] };
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
  return [...(root ? [root] : []), ...refs, ...cargos].sort((a, b) =>
    refKey32(a).localeCompare(refKey32(b)),
  );
}
export function scope32(doc: ShippingDocument) {
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
