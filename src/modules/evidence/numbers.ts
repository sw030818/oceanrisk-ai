// Locale-ambiguous grouping and identifiers remain unverified. Units may be
// printed adjacent to the number (600PCS / 300KG), without matching INV600.
export function numericTokens(text: string): number[] {
  return (
    text
      .normalize("NFKC")
      .match(
        /(?<![\p{L}\p{N}_.])[-+]?\d+(?:[.,]\d+)*(?![\d.,])(?=$|[^\p{L}\p{N}_]|(?:PCS|PC|EA|CTNS?|CARTONS?|KGS?|TONS?|M|USD|EUR|KRW)\b)/giu,
      ) ?? []
  )
    .filter((token) =>
      /^[-+]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(token),
    )
    .map((token) => Number(token.replaceAll(",", "")));
}
