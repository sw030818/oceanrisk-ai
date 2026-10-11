import type {
  ExtractedDocument,
  PdfDocument,
} from "../../src/modules/documents/schema";
import { syntheticDocument, makePdf } from "./synthetic";
export type ScenarioId = "A" | "B" | "C" | "D";
export function phase15Scenario(id: ScenarioId) {
  const fixturePair = [
    syntheticDocument("invoice", 500),
    syntheticDocument("packing_list", id === "B" || id === "D" ? 480 : 500),
  ];
  const documents = fixturePair.map((fixture) => {
    const data: ExtractedDocument = structuredClone(fixture.data);
    const header = fixture.lines.filter((_, index) =>
      [0, 1, 2, 3, 9, 10].includes(index),
    );
    const items = fixture.lines.filter((_, index) =>
      [4, 5, 6, 7, 8].includes(index),
    );
    if (id === "D") {
      header.splice(header.indexOf(fixture.lines[10]), 1);
      data.transactionReference = { value: null, evidence: null };
    }
    if (id === "C") {
      items.splice(2, 0, "Package quantity: 20 CTNS");
      data.items[0].quantity.evidence!.quote =
        fixture.lines[5] + "\nPackage quantity: 20 CTNS";
    }
    for (const [key, value] of Object.entries(data)) {
      if (
        ["currency", "totalAmount"].includes(key) &&
        value &&
        typeof value === "object" &&
        "evidence" in value &&
        value.evidence
      )
        value.evidence.page = 2;
    }
    for (const item of data.items)
      for (const field of Object.values(item))
        if (field.evidence) field.evidence.page = 2;
    const pdf: PdfDocument = {
      ...fixture.pdf,
      fileName: `${id}-${fixture.pdf.fileName}`,
      pages: [
        { page: 1, text: header.join("\n") },
        { page: 2, text: items.join("\n") },
      ],
    };
    return {
      pdf,
      data,
      makeFile: async () =>
        new File(
          [new Uint8Array(await makePdf([header, items]))],
          pdf.fileName,
          { type: "application/pdf" },
        ),
    };
  });
  return {
    id,
    documents,
    expectedStatus:
      id === "B" ? "mismatch" : id === "D" ? "unverifiable" : "match",
  };
}
