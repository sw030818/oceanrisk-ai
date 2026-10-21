import { goodsComparisonValue } from "./goods-context";
import type { ShippingDocument } from "./schema";
import type { ShippingCheck } from "./review-model";
import { refKey32, ref32, verified32, type FieldRef } from "./review-evidence";
export interface IssueCause {
  key: string;
  kind: "classification" | "evidence" | "scope" | "value_conflict" | "reference_conflict";
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

import { compareGoods } from "./goods-semantics";
// Equal literal HS values can be held solely by the same unresolved product
// meaning. Connect that dependency only for unique, independently grounded
// owners in exactly the same document/HBL scope; never absorb a true HS error.
export function semanticCauses(
  c: ShippingCheck,
  docs: ShippingDocument[],
): IssueCause[] {
  if (
    c.assessment !== "provisional_match" ||
    !["goodsDescription", "hsCode"].includes(c.comparison?.meaning ?? "") ||
    !c.comparison?.hbl ||
    !c.comparison.reasonCodes.length ||
    c.comparison.reasonCodes.some((r) => r !== "SCOPE_UNRESOLVED") ||
    c.fields.some((f) => !verified32(f))
  )
    return [];
  const ids = [
    ...new Set(c.documentIds ?? c.fields.map((f) => f.documentId)),
  ].sort();
  if (ids.length < 2) return [];
  const owners: { g: FieldRef; h: FieldRef }[] = [];
  for (const id of ids) {
    const d = docs.find((d) => d.id === id);
    if (!d || d.classificationStatus !== "classified") return [];
    const entity =
      d.items.length === 1 && d.factCoverage?.items.complete
        ? d.items[0]
        : !d.items.length &&
            d.cargoRecords.length === 1 &&
            d.factCoverage?.cargoRecords.complete
          ? d.cargoRecords[0]
          : undefined;
    if (!entity) return [];
    const ref = d.items.length ? { itemId: entity.id } : { cargoId: entity.id };
    const goods = entity.fields.goodsDescription,
      hs = entity.fields.hsCode;
    if (!goods || !hs) return [];
    const g = ref32(d, "goodsDescription", goods, ref),
      h = ref32(d, "hsCode", hs, ref);
    if (!verified32(g) || !verified32(h)) return [];
    owners.push({ g, h });
  }
  const hs = owners.map((o) =>
    String(o.h.field.current.value).replace(/[.\s-]/g, ""),
  );
  if (!hs[0] || hs.some((v) => v !== hs[0])) return [];
  const meanings = owners.flatMap((o, i) =>
    owners
      .slice(i + 1)
      .map(
        (p) =>
          compareGoods(goodsComparisonValue(o.g.field), goodsComparisonValue(p.g.field)).status,
      ),
  );
  if (
    !meanings.includes("partial") ||
    meanings.some((s) => !["exact", "semantic", "partial"].includes(s))
  )
    return [];
  return [
    {
      key: JSON.stringify([
        "product-meaning",
        c.comparison.hbl,
        owners.map((o) => refKey32(o.g)).sort(),
      ]),
      kind: "scope",
      fields: owners.map((o) => o.g),
    },
  ];
}
