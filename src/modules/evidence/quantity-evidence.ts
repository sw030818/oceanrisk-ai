// Only explicitly labelled PRODUCT quantities. No package conversion or inference.
export interface ProductQuantityEvidence {
  value: number;
  unit: string | null;
}
export function productQuantities(quote: string): ProductQuantityEvidence[] {
  const result: ProductQuantityEvidence[] = [];
  for (const line of quote.normalize("NFKC").split(/\r?\n/)) {
    const pattern =
      /(?:^|[^\p{L}\p{N}])(?:quantity|qty\.?|수량)\s*(?:\(([\p{L}.]+)\))?\s*[:=-]?\s*([-+]?\d[\d.,]*)(?:\s*([\p{L}.]+))?/giu;
    for (const match of line.matchAll(pattern)) {
      const prefix = line.slice(0, match.index).trim();
      const unit = match[1] ?? match[3] ?? null;
      if (
        /(?:packages?|cartons?|ctns?|boxes|box|weight|amount|중량|금액|포장|박스|상자)\s*$/i.test(
          prefix,
        ) ||
        (unit && /^(?:ctns?|cartons?|packages?|boxes|box)$/i.test(unit))
      )
        continue;
      if (!/^[-+]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(match[2]))
        continue;
      const value = Number(match[2].replaceAll(",", ""));
      if (
        !Number.isFinite(value) ||
        value < 0 ||
        value > Number.MAX_SAFE_INTEGER
      )
        continue;
      result.push({ value, unit });
    }
  }
  return result;
}
