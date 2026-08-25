import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { rasterizePdfPage, rasterizeSinglePagePdf } from '../page-raster';

describe('PDF Translator page raster fallback', () => {
  it('renders a single PDF page to a PNG for vision retry', async () => {
    const document = await PDFDocument.create();
    const page = document.addPage([300, 200]);
    const font = await document.embedFont(StandardFonts.Helvetica);
    page.drawText('Raster retry 2026', { x: 30, y: 100, size: 18, font });

    const png = await rasterizeSinglePagePdf(Buffer.from(await document.save()));

    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(png.length).toBeGreaterThan(1_000);
  });

  it('renders a requested page directly from a multi-page source PDF', async () => {
    const document = await PDFDocument.create();
    const font = await document.embedFont(StandardFonts.Helvetica);
    document.addPage([300, 200]).drawText('First page', { x: 30, y: 100, size: 18, font });
    document.addPage([500, 300]).drawText('Second page', { x: 30, y: 100, size: 18, font });

    const png = await rasterizePdfPage(Buffer.from(await document.save()), 2);

    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(png.length).toBeGreaterThan(1_000);
  });
});
