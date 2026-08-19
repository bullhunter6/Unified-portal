import { makeTranslatedPdf } from './makeTranslatedPdf';
import type { PdfPageLayout } from './schemas';
import { pageLayoutToPlainText } from './serialize';

/**
 * The structured page data and Unicode/table renderer share this isolated
 * pipeline, including pagination, RTL shaping, borders, and wide-page output.
 */
export async function renderPdfxV2Document(
  translatedPages: readonly PdfPageLayout[],
  outputPath: string,
) {
  return makeTranslatedPdf(
    translatedPages.map((page) => ({
      pageNumber: page.pageNumber,
      text: pageLayoutToPlainText(page) || '[Blank translated page]',
    })),
    outputPath,
    'OpenAI PDF Translator',
  );
}
