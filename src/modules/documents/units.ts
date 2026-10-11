export function canonicalUnit(value: string | null | undefined): string | null {
  const units: Record<string, string> = {
    pc: "PCS",
    pcs: "PCS",
    piece: "PCS",
    pieces: "PCS",
    ea: "PCS",
    each: "PCS",
    개: "PCS",
    kg: "KG",
    kgs: "KG",
    kilogram: "KG",
    kilograms: "KG",
    ton: "TON",
    tons: "TON",
    m: "M",
    meter: "M",
    meters: "M",
  };
  return value
    ? (units[value.normalize("NFKC").trim().toLowerCase().replace(/\.$/, "")] ??
        null)
    : null;
}
export const packageUnit = (value: string | null | undefined) =>
  value && /^(ctn|ctns|carton|cartons)$/i.test(value.trim()) ? "CTNS" : null;
