import type {
  ShippingCheck,
  ShippingAssessment,
  ShippingReview,
} from "./review-model";
import type { ShippingDocument } from "./schema";
import { identifiers32, verified32, text32, refKey32 } from "./review-evidence";
export const assessmentRank: Record<ShippingAssessment, number> = {
  confirmed_mismatch: 0,
  provisional_mismatch: 1,
  needs_review: 2,
  provisional_match: 3,
  insufficient_information: 4,
  not_comparable: 4,
  confirmed_match: 5,
};
export function comparisonGroups(
  review: ShippingReview,
  documents: ShippingDocument[],
  documentIds?: string[],
) {
  const docs = new Map(documents.map((d) => [d.id, d]));
  const groups = new Map<
    string,
    {
      id: string;
      title: string;
      assessment: ShippingAssessment;
      checks: ShippingCheck[];
      fields: ShippingCheck["fields"];
    }
  >();
  for (const c of review.checks) {
    if (
      documentIds &&
      c.fields.some((f) => !documentIds.includes(f.documentId))
    )
      continue;
    const title = c.title ?? c.category;
    const owner = c.fields.some((f) => f.itemId || f.cargoId || f.containerId)
      ? title
      : "document";
    const roles = [
      ...new Set(
        c.fields
          .filter((f) => !f.fieldName.endsWith("Unit"))
          .map((f) => f.fieldName),
      ),
    ]
      .sort()
      .join("/");
    const key =
      c.scope === "document"
        ? c.id
        : [
            c.category,
            roles || title,
            owner,
            c.scope === "triangle" ? "triangle" : "pair",
          ].join("|");
    let group = groups.get(key);
    if (!group) {
      group = {
        id: key,
        title,
        assessment: c.assessment,
        checks: [],
        fields: [],
      };
      groups.set(key, group);
    }
    group.checks.push(c);
    if (assessmentRank[c.assessment] < assessmentRank[group.assessment])
      group.assessment = c.assessment;
    for (const f of c.fields)
      if (
        docs.has(f.documentId) &&
        !group.fields.some((g) => refKey32(g) === refKey32(f))
      )
        group.fields.push(f);
  }
  return [...groups.values()].sort(
    (a, b) =>
      assessmentRank[a.assessment] - assessmentRank[b.assessment] ||
      a.title.localeCompare(b.title),
  );
}
export type ComparisonGroup = ReturnType<typeof comparisonGroups>[number];
export function shipmentOptions(documents: ShippingDocument[]) {
  const map = new Map<string, Set<string>>();
  for (const doc of documents)
    for (const f of identifiers32(doc, "houseBlNumber").filter(verified32)) {
      const key = text32(f.field.current.value);
      const set = map.get(key) ?? new Set<string>();
      set.add(doc.id);
      map.set(key, set);
    }
  return [...map.entries()].map(([id, ids]) => ({
    id,
    label: `HBL ${id.toUpperCase()}`,
    documentIds: [...ids],
  }));
}

// Guard identifiers and source-unit evidence stay in the detail panel. The
// compact value columns show the semantic subject of this comparison only.
export function comparisonDisplayFields(group: ComparisonGroup) {
  const category = group.checks[0]?.category;
  return group.fields.filter((f) => {
    if (category === "weight")
      return /Weight(?:Unit)?$|^weightUnit$/.test(f.fieldName);
    if (category === "packaging")
      return ["packageCount", "packageUnit"].includes(f.fieldName);
    if (category === "quantity")
      return ["quantity", "quantityUnit"].includes(f.fieldName);
    if (category === "port")
      return ["portOfLoading", "portOfDischarge"].includes(f.fieldName);
    if (category === "container")
      return /seal/i.test(group.title)
        ? f.fieldName === "sealNumber"
        : f.fieldName === "containerNumber";
    return true;
  });
}
