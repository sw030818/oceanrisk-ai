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
// "TCNU1234567 / 40HC": a container number printed with its ISO size/type
// code. The code is not part of the container identity.
export const containerWithSize =
  /^\s*([A-Z]{4})\s?(\d{6})\s?(\d)\s*(?:[\/,-]\s*)?(?:\d{2}\s?(?:'|FT|GP|HC|HQ|DC|DV|RF|RH|OT|FR|TK|PL)|\d{2}[GRUPTB]\d)\s*$/i;
export const text32 = (v: unknown) => {
  if (typeof v !== "string") return String(v ?? "");
  const c = v.normalize("NFKC").match(containerWithSize);
  // A list separator left at either end ("/KS4395103") and a printed seal
  // label ("SEAL: KS1192892", "봉인번호: …") are not part of the value.
  return c ? normalizeText(c[1] + c[2] + c[3]) : normalizeText(v.normalize("NFKC").replace(/^\s*(?:SEAL(?:\s*NO\.?)?|봉인번호)\s*[:#]\s*(?=\S)/i, "").replace(/^[\s/,;]+|[\s/,;]+$/g, ""));
};
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
// document's independently proved unique native item owner, retaining the root diagnostic.
// No cross-document, same-number, edited, OCR or incomplete-row substitution.
export function comparisonField32(doc:ShippingDocument,name:string):FieldRef|undefined {
  const root=root32(doc,name);
  if(name!=="goodsDescription"||root&&root.field.current.status!=="unverified"||doc.nativeScopeLimitation||doc.fields.shipmentScope?.current.status==="user_edited"||doc.fields.goodsDescription?.current.status==="user_edited"||doc.additionalFields.some(f=>f.meaning===name&&f.field.current.status==="user_edited"))return root;
  const source=root?.field.current.source;
  if(source&&(source.fileId!==doc.id||source.provenance==="ocr"))return root;
  const item=doc.items.length===1&&doc.factCoverage?.items.complete?doc.items[0]:undefined;
  const cargo=!doc.items.length&&doc.cargoRecords.length===1&&doc.factCoverage?.cargoRecords.complete?doc.cargoRecords[0]:undefined;
  const owner=item??cargo,field=owner?.fields.goodsDescription;
  if(!owner||!field||!independentlyVerified(field))return root;
  const proof=field.current.source;
  if(proof?.fileId!==doc.id||!proof.layout?.tableId||!proof.layout.rowId||!proof.segments?.length)return root;
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
// An export declaration form prints no House B/L number. A consolidated
// manifest row that itself prints both the HBL and that declaration number is
// the only source evidence of the declaration's HBL. The bridged reference is
// the manifest row's own verified field (its file, quote and row), never a copy.
const shippingSets = new WeakMap<ShippingDocument, readonly ShippingDocument[]>();
const bridgeCache = new WeakMap<readonly ShippingDocument[], Map<string, FieldRef[]>>();
/** Declares the documents reviewed together, so cross-document bridges can be found. */
export function registerShippingSet(documents: readonly ShippingDocument[]) {
  for (const d of documents) shippingSets.set(d, documents);
}
function bridgedHbl(doc: ShippingDocument): FieldRef[] {
  const set = shippingSets.get(doc);
  if (!set || doc.detectedType !== "export_declaration" || doc.classificationStatus !== "classified") return [];
  let cache = bridgeCache.get(set);
  if (!cache) bridgeCache.set(set, (cache = new Map()));
  const known = cache.get(doc.id);
  if (known) return known;
  const own = new Set(
    identifiers32(doc, "declarationNumber").filter(verified32).flatMap(identifierValues32),
  );
  const found: FieldRef[] = [];
  if (own.size === 1)
    for (const m of set) {
      if (m.detectedType !== "house_manifest" || m.classificationStatus !== "classified") continue;
      const pairs: [FieldRef | undefined, FieldRef | undefined][] = [
        [root32(m, "houseBlNumber"), root32(m, "declarationNumber")],
        ...m.cargoRecords.map((c) => [
          ref32(m, "houseBlNumber", c.fields.houseBlNumber, { cargoId: c.id }),
          c.fields.declarationNumber && has32(c.fields.declarationNumber)
            ? ref32(m, "declarationNumber", c.fields.declarationNumber, { cargoId: c.id })
            : undefined,
        ] as [FieldRef, FieldRef | undefined]),
      ];
      for (const [hbl, number] of pairs)
        if (hbl && number && verified32(hbl) && verified32(number) && has32(hbl.field) &&
          identifierValues32(number).some((v) => own.has(v)))
          found.push(hbl);
    }
  const result = new Set(found.map((f) => text32(f.field.current.value))).size === 1 ? found : [];
  cache.set(doc.id, result);
  return result;
}
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
  const own = [...(root ? [root] : []), ...refs, ...cargos]
    .filter((f) => !isPlaceholder32(f.field.current.value));
  const bridged =
    role === "houseBlNumber" && !own.some(verified32) ? bridgedHbl(doc) : [];
  return [...own, ...bridged]
    .sort((a, b) => refKey32(a).localeCompare(refKey32(b)));
}
// A verified reference may contain an explicit list. Keep its original field,
// quote and provenance intact; these are comparison keys, never new PDF values.
// Spaces/hyphens/slashes are valid identifier characters, not list delimiters.
export function identifierValues32(ref: FieldRef): string[] {
  const literal = text32(ref.field.current.value);
  if (ref.fieldName !== "declarationNumber" || !verified32(ref))
    return literal ? [literal] : [];
  const raw = String(ref.field.current.value ?? "").normalize("NFKC");
  if (!/[,;\n]/.test(raw)) return literal ? [literal] : [];
  const parts = raw.split(/[,;\n]/).map((s) => s.trim());
  if (parts.length > 100 || parts.some((s) =>
    !s || !/\d/.test(s) || !/^[a-z\d][a-z\d /.-]*$/i.test(s) ||
    /\b(?:and|or|to|through|except)\b/i.test(s)
  )) return [];
  return [...new Set(parts.map(text32))];
}
// One printed box may list several containers ("SEAU5034630 OCEU7336291").
// Only a value made entirely of container numbers is split; anything else
// stays one literal value.
export function containerValues32(ref: FieldRef): string[] {
  const raw = String(ref.field.current.value ?? "").normalize("NFKC").toUpperCase();
  const ids = raw.match(/[A-Z]{4}\s?\d{6}\s?\d(?!\d)/g) ?? [];
  const rest = raw.replace(/[A-Z]{4}\s?\d{6}\s?\d(?!\d)/g, "")
    .replace(/\b\d{2}\s?(?:GP|HC|HQ|DC|DV|RF|OT|FR|TK)\b/g, "").replace(/[\s,;/]+/g, "");
  return ids.length > 1 && !rest ? [...new Set(ids.map(text32))] : [text32(ref.field.current.value)];
}
export function declarationAgreement32(a: ShippingDocument, b: ShippingDocument) {
  const left = identifiers32(a, "declarationNumber").filter(verified32),
    right = identifiers32(b, "declarationNumber").filter(verified32);
  const l = new Set(left.flatMap(identifierValues32)),
    r = new Set(right.flatMap(identifierValues32));
  const valid = left.every((f) => identifierValues32(f).length > 0) &&
    right.every((f) => identifierValues32(f).length > 0);
  const multiHbl = [a, b].some((d) => new Set(
    identifiers32(d, "houseBlNumber").filter(verified32)
      .map((f) => text32(f.field.current.value)),
  ).size > 1);
  // An individual declaration must have one identity. A transport document's
  // list may contain it; two single-HBL transport lists must describe the same
  // set. A multi-HBL Manifest retains its existing shared-reference candidate
  // behavior; cargo ownership and aggregation coverage remain separate guards.
  const same = valid && l.size > 0 && r.size > 0 &&
    (a.detectedType === "export_declaration"
      ? l.size === 1 && [...l].every((v) => r.has(v))
      : b.detectedType === "export_declaration"
        ? r.size === 1 && [...r].every((v) => l.has(v))
        : multiHbl
          ? [...l].some((v) => r.has(v))
          : l.size === r.size && [...l].every((v) => r.has(v)));
  return { same, left, right, leftValues: l, rightValues: r };
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
  // Counting units: each is its own unit (SET never equals PCS).
  const counting: Record<string, string> = {
    set: "SET", sets: "SET", pr: "PR", prs: "PR", pair: "PR", pairs: "PR",
    roll: "ROLL", rolls: "ROLL", doz: "DOZ", dz: "DOZ", dozen: "DOZ",
  };
  const u =
    kind === "quantity"
      ? (canonicalUnit(value) ?? counting[raw] ?? null)
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
            plt: "PALLETS",
            plts: "PALLETS",
            bag: "BAGS",
            bags: "BAGS",
          } as Record<string, string>
        )[raw]);
  return u && (kind !== "quantity" || ["PCS", "M", "SET", "PR", "ROLL", "DOZ"].includes(u))
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
