import {
  getDocument,
  VerbosityLevel,
  Util,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import { AnalysisError } from "../documents/errors";
import { MAX_PAGES, MAX_TEXT_CHARS } from "../upload/limits";
import { validatePdfSignature } from "../upload/validate";
import type { PdfPage, PdfBlock } from "../documents/schema";

export async function extractPdfText(
  bytes: Uint8Array,
  signal?: AbortSignal,
  allowSparsePages = false,
): Promise<PdfPage[]> {
  if (signal?.aborted)
    throw new AnalysisError(
      "REQUEST_CANCELLED",
      "PDF 처리가 취소되었습니다.",
      408,
    );
  validatePdfSignature(bytes);
  const task = getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    verbosity: VerbosityLevel.ERRORS,
    stopAtErrors: true,
  });
  const cancel = () => {
    void task.destroy().catch(() => {});
  };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    if (signal?.aborted)
      throw new AnalysisError(
        "REQUEST_CANCELLED",
        "PDF 처리가 취소되었습니다.",
        408,
      );
    const pdf = await task.promise;
    if (pdf.numPages > MAX_PAGES)
      throw new AnalysisError(
        "TOO_MANY_PAGES",
        `파일당 최대 ${MAX_PAGES}페이지를 지원합니다.`,
      );
    const pages: PdfPage[] = [];
    let count = 0;
    let blockCount = 0;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      if (signal?.aborted)
        throw new AnalysisError(
          "REQUEST_CANCELLED",
          "PDF 처리가 취소되었습니다.",
          408,
        );
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1 });
      const blocks: PdfBlock[] = [];
      let text = "";
      let lastY: number | null = null;
      for (const item of content.items) {
        if (!("str" in item)) continue;
        if (item.str.trim()) {
          const position = Util.transform(viewport.transform, item.transform);
          const height =
            Math.hypot(position[2], position[3]) || item.height || 1;
          blocks.push({
            id: `p${pageNumber}-b${blocks.length}`,
            text: item.str,
            x: position[4],
            y: position[5] - height,
            width: Math.abs(item.width),
            height,
            row: 0,
          });
          if (++blockCount > 10000)
            throw new AnalysisError(
              "PDF_LAYOUT_TOO_COMPLEX",
              "텍스트 블록이 너무 많습니다. 필요한 페이지만 분리해 주세요.",
            );
        }
        const y = item.transform[5];
        if (lastY !== null && Math.abs(y - lastY) > 3 && !text.endsWith("\n"))
          text += "\n";
        text += item.str + (item.hasEOL ? "\n" : " ");
        lastY = y;
      }
      text = text.trim();
      count += text.length;
      if (count > MAX_TEXT_CHARS)
        throw new AnalysisError(
          "TOO_MUCH_TEXT",
          "문서 텍스트가 너무 많습니다. 필요한 페이지만 분리해 주세요.",
        );
      let row = -1,
        baseline = -Infinity;
      for (const block of [...blocks].sort((a, b) => a.y - b.y || a.x - b.x)) {
        if (Math.abs(block.y - baseline) > Math.max(2, block.height * 0.45)) {
          row++;
          baseline = block.y;
        }
        block.row = row;
      }
      pages.push({
        page: pageNumber,
        text,
        width: viewport.width,
        height: viewport.height,
        blocks,
        ...(allowSparsePages &&
        (text.replace(/\s/g, "").length < 40 || text.includes("�"))
          ? { ocrStatus: "candidate" as const }
          : {}),
      });
      page.cleanup();
    }
    if (
      !allowSparsePages &&
      !pages.some((page) => page.text.replace(/\s/g, "").length >= 8)
    )
      throw new AnalysisError(
        "NO_READABLE_TEXT",
        "읽을 수 있는 텍스트가 없습니다. 스캔·이미지 PDF는 지원하지 않으며 텍스트 PDF가 필요합니다.",
      );
    if (!allowSparsePages && pages.some((page) => page.text.includes("�")))
      throw new AnalysisError(
        "UNREADABLE_ENCODING",
        "PDF 글자 인코딩을 판독하지 못했습니다. 텍스트가 정상 표시되는 PDF로 다시 저장해 주세요.",
      );
    return pages;
  } catch (error) {
    if (signal?.aborted)
      throw new AnalysisError(
        "REQUEST_CANCELLED",
        "PDF 처리가 취소되었습니다.",
        408,
      );
    if (error instanceof AnalysisError) throw error;
    if (error instanceof Error && error.name === "PasswordException")
      throw new AnalysisError(
        "PASSWORD_PROTECTED",
        "암호로 보호된 PDF입니다. 암호를 해제한 사본을 사용해 주세요.",
      );
    throw new AnalysisError(
      "PDF_PARSE_FAILED",
      "PDF를 읽지 못했습니다. 손상되었거나 지원되지 않는 문서입니다.",
    );
  } finally {
    signal?.removeEventListener("abort", cancel);
    await task.destroy();
  }
}
