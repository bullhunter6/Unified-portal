import path from 'node:path';
export { MAX_PDF_UPLOAD_BYTES } from './constants';

export const MAX_PDF_PAGES = 100;

export function normalizePdfDisplayName(name: string, jobId: string): string {
  const leaf = path.posix.basename(String(name || '').replace(/\\/g, '/'));
  const cleaned = leaf
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/["<>|:*?]/g, '_')
    .trim()
    .slice(0, 180);

  return cleaned.toLowerCase().endsWith('.pdf') ? cleaned : `upload_${jobId}.pdf`;
}
