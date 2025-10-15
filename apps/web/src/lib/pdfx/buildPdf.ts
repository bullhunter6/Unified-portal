import { makeTranslatedPdf } from './makeTranslatedPdf';
import { PageRecord } from './types';

export async function buildTranslatedPdf(
  pages: PageRecord[],
  outputPath: string
): Promise<string> {
  // Convert PageRecord[] to the format expected by makeTranslatedPdf
  const pageBlocks = pages.map(p => ({
    pageNumber: p.pageNumber,
    text: (p.translatedText || '').trim() || '[No translated text]'
  }));

  return await makeTranslatedPdf(pageBlocks, outputPath, 'Translated Document');
}