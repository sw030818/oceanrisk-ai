import type { Evidence, EvidenceIssue, PdfDocument } from "../documents/schema";
export function resolveCitation(
  candidate: {
    value: string | number | null;
    evidence: { page: number; blockIds: string[] } | null;
  },
  pdf: PdfDocument,
): {
  value: string | number | null;
  evidence: Evidence | null;
  evidenceIssue?: EvidenceIssue;
} {
  const source = candidate.evidence;
  const page = source && pdf.pages.find((p) => p.page === source.page);
  const blocks = source?.blockIds.map((id) =>
    page?.blocks?.find((b) => b.id === id),
  );
  // Missing/duplicated IDs or an overlong quote retain the value as UNVERIFIED.
  // Never search another page, fill missing values, or trust an AI-supplied quote.
  if (
    !source ||
    !blocks?.length ||
    blocks.some((b) => !b) ||
    new Set(source.blockIds).size !== blocks.length
  )
    return {
      value: candidate.value,
      evidence: null,
      evidenceIssue: !source
        ? undefined
        : !page
          ? "page_missing"
          : blocks?.some((b) => !b)
            ? "block_missing"
            : "duplicate_block",
    };
  const segments = blocks.map((b) => ({ blockId: b!.id, quote: b!.text }));
  const quote = segments.map((s) => s.quote).join("\n");
  return {
    value: candidate.value,
    evidence:
      quote.length && quote.length <= 800
        ? { page: source.page, quote, segments }
        : null,
    ...(quote.length > 800 ? { evidenceIssue: "citation_too_long" } : {}),
  };
}
