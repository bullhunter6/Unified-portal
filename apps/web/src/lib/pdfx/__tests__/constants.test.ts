import { describe, expect, it } from 'vitest';
import {
  buildPdfxContentDisposition,
  isPdfxSupportedLanguage,
  MAX_PDF_REQUEST_BYTES,
  MAX_PDF_UPLOAD_BYTES,
} from '@/lib/pdfx/constants';

describe('PDFX shared contracts', () => {
  it('advertises only languages supported by validation and output fonts', () => {
    expect(isPdfxSupportedLanguage('English')).toBe(true);
    expect(isPdfxSupportedLanguage('Arabic')).toBe(true);
    expect(isPdfxSupportedLanguage('Russian')).toBe(true);
    expect(isPdfxSupportedLanguage('French')).toBe(false);
  });

  it('allows bounded multipart overhead beyond the 20 MB PDF limit', () => {
    expect(MAX_PDF_UPLOAD_BYTES).toBe(20 * 1024 * 1024);
    expect(MAX_PDF_REQUEST_BYTES).toBe(21 * 1024 * 1024);
  });

  it('builds a Unicode-safe RFC 5987 download filename', () => {
    const header = buildPdfxContentDisposition(
      'attachment',
      'translated_تقرير ESG 📄.pdf',
    );

    expect(header).toMatch(/^attachment; filename="[\x20-\x7e]+"; filename\*=UTF-8''/);
    expect(header).toContain('%D8%AA%D9%82%D8%B1%D9%8A%D8%B1');
    expect(header).toContain('%F0%9F%93%84');
    expect(header).not.toContain('\r');
    expect(header).not.toContain('\n');
  });
});
