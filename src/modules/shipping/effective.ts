import type { ShippingField } from "./schema";
export const effectiveProof = (f: ShippingField) =>
  f.recovery?.field ?? f.original;
export const independentlyVerified = (f: ShippingField) => {
  const p = effectiveProof(f);
  return (
    f.current.status === "verified" &&
    p.status === "verified" &&
    p.value !== null &&
    !!p.source &&
    p.source.provenance !== "ocr" &&
    JSON.stringify(f.current) === JSON.stringify(p)
  );
};
