import { makeTranslatedPdf } from './makeTranslatedPdf';
import type { PageRecord, TranslatedPdfResult } from './types';

export async function buildTranslatedPdf(
  pages: PageRecord[],
  outputPath: string
): Promise<TranslatedPdfResult> {
  // Convert PageRecord[] to the format expected by makeTranslatedPdf
  const pageBlocks = pages.map(p => ({
    pageNumber: p.pageNumber,
    text: (p.translatedText || '').trim() || '[No translated text]'
  }));

  return makeTranslatedPdf(pageBlocks, outputPath, 'Translated Document');
}
