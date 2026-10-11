import { getDocument, VerbosityLevel } from "pdfjs-dist/legacy/build/pdf.mjs";
import { AnalysisError } from "../documents/errors";
import { MAX_PAGES, MAX_TEXT_CHARS } from "../upload/limits";
import { validatePdfSignature } from "../upload/validate";
import type { PdfPage } from "../documents/schema";

export async function extractPdfText(bytes: Uint8Array): Promise<PdfPage[]> {
  validatePdfSignature(bytes);
  const task = getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    verbosity: VerbosityLevel.ERRORS,
    stopAtErrors: true,
  });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > MAX_PAGES)
      throw new AnalysisError(
        "TOO_MANY_PAGES",
        `파일당 최대 ${MAX_PAGES}페이지를 지원합니다.`,
      );
    const pages: PdfPage[] = [];
    let count = 0;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      let text = "";
      let lastY: number | null = null;
      for (const item of content.items) {
        if (!("str" in item)) continue;
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
      pages.push({ page: pageNumber, text });
      page.cleanup();
    }
    if (!pages.some((page) => page.text.replace(/\s/g, "").length >= 8))
      throw new AnalysisError(
        "NO_READABLE_TEXT",
        "읽을 수 있는 텍스트가 없습니다. 스캔·이미지 PDF는 지원하지 않으며 텍스트 PDF가 필요합니다.",
      );
    if (pages.some((page) => page.text.includes("�")))
      throw new AnalysisError(
        "UNREADABLE_ENCODING",
        "PDF 글자 인코딩을 판독하지 못했습니다. 텍스트가 정상 표시되는 PDF로 다시 저장해 주세요.",
      );
    return pages;
  } catch (error) {
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
    await task.destroy();
  }
}
