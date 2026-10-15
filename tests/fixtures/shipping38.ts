// Independently authored fragmented typography over public synthetic shipping34.
// No attachment bytes, business names, identifiers or private page coordinates.
import { shipping34Fixture } from "./shipping34";
import { unicodePdf } from "./shipping31";
import { extractPdfText } from "../../src/modules/pdf/extract";
import { groundShipping } from "../../src/modules/shipping/ground";
import type { ShippingType } from "../../src/modules/shipping/catalog";
import type { ShippingWire } from "../../src/modules/shipping/ai-schema";
export async function shipping38Fixture(
  type: ShippingType,
  change: Parameters<typeof shipping34Fixture>[1] & { scale?: number } = {},
) {
  const f = await shipping34Fixture(type, change),
    scale = change.scale ?? 1;
  const cells = f.pdf.pages.map((p) =>
    (p.blocks ?? []).flatMap((b) => {
      let x = b.x;
      return b.text.split(/\s+/).map((word) => {
        const out = {
          text: word,
          x: x * scale,
          y: (b.y + b.height) * scale,
          size: b.height * scale,
        };
        x += (word.length + 1) * b.height * 0.5;
        return out;
      });
    }),
  );
  const bytes = unicodePdf(cells, {
    fragmentedFonts: true,
    borders: f.pdf.pages.map((p) =>
      (p.cells ?? []).map((c) => ({
        x: c.x * scale,
        y: c.y * scale,
        width: c.width * scale,
        height: c.height * scale,
      })),
    ),
    sizes: f.pdf.pages.map((p) => [p.width! * scale, p.height! * scale]),
  });
  const pages = await extractPdfText(bytes, undefined, false, true),
    pdf = {
      ...f.pdf,
      id: "fragmented-" + f.pdf.id,
      fileName: "synthetic-fragmented-" + type + ".pdf",
      pages,
    };
  const wire = structuredClone(f.wire);
  const remap = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    const e = v as { page?: number; blockIds?: string[] };
    if (e.page && e.blockIds) {
      const p = f.pdf.pages.find((p) => p.page === e.page)!,
        n = pages.find((p) => p.page === e.page)!;
      e.blockIds = [
        ...new Set(
          e.blockIds.flatMap((id) => {
            const b = p.blocks!.find((b) => b.id === id)!;
            return n
              .blocks!.filter(
                (x) =>
                  Math.abs(x.y - b.y * scale) <=
                    Math.max(0.4, b.height * scale * 0.2) &&
                  x.x >= b.x * scale - 0.4 &&
                  x.x + x.width <= (b.x + b.width) * scale + 0.4,
              )
              .map((x) => x.id);
          }),
        ),
      ];
      return;
    }
    for (const child of Object.values(v)) remap(child);
  };
  remap(wire);
  return {
    pdf,
    wire: wire as ShippingWire,
    bytes,
    document: groundShipping(wire, pdf, type),
  };
}
