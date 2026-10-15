import type { ShippingDocument } from "./schema";
import type { ShippingCheck } from "./review-model";
import { refKey32, ref32, verified32, type FieldRef } from "./review-evidence";
export interface IssueCause {
  key: string;
  kind: "classification" | "evidence";
  fields: FieldRef[];
}
// Causal links, not fuzzy title/category deduplication. An unverified owner
// anchor can block several child fields; unrelated bad fields remain separate.
export function evidenceCauses(
  c: ShippingCheck,
  docs: ShippingDocument[],
): IssueCause[] {
  if (c.assessment === "confirmed_mismatch") return [];
  const bad = c.fields.filter(
    (f) =>
      f.field.current.value !== null &&
      f.field.current.value !== "" &&
      !verified32(f),
  );
  const roots = new Map<string, IssueCause>();
  for (const f of bad) {
    const d = docs.find((d) => d.id === f.documentId);
    if (f.fieldName === "documentType") {
      roots.set("classification/" + f.documentId, {
        key: "classification/" + f.documentId,
        kind: "classification",
        fields: [f],
      });
      continue;
    }
    const entity = f.itemId
      ? d?.items.find((i) => i.id === f.itemId)
      : f.cargoId
        ? d?.cargoRecords.find((i) => i.id === f.cargoId)
        : undefined;
    const anchorRole = f.itemId
      ? "goodsDescription"
      : f.cargoId
        ? "houseBlNumber"
        : "containerNumber";
    const anchor =
      entity?.fields[anchorRole] ??
      (f.containerId
        ? d?.containers.find((i) => i.id === f.containerId)?.containerNumber
        : undefined);
    const ar =
      anchor && d
        ? ref32(d, anchorRole, anchor, {
            itemId: f.itemId,
            cargoId: f.cargoId,
            containerId: f.containerId,
          })
        : undefined;
    // Only explicit owner/row failures depend on the anchor. A wrong numeric
    // citation or missing unit is its own cause, even in an unclassified PDF.
    const root =
      ar &&
      !verified32(ar) &&
      ["row_mismatch", "context_unverified"].includes(
        f.field.current.verificationCode ?? "",
      )
        ? ar
        : f;
    const key = "field/" + refKey32(root);
    roots.set(key, { key, kind: "evidence", fields: [root] });
  }
  if (
    !bad.length &&
    c.assessment === "provisional_match" &&
    (c.comparison?.reasonCodes ?? []).includes("EVIDENCE_UNVERIFIED")
  ) {
    for (const d of docs.filter(
      (d) =>
        c.documentIds?.includes(d.id) &&
        d.classificationStatus !== "classified",
    )) {
      roots.set("classification/" + d.id, {
        key: "classification/" + d.id,
        kind: "classification",
        fields: d.classification
          ? [ref32(d, "documentType", d.classification)]
          : [],
      });
    }
  }
  return [...roots.values()];
}
