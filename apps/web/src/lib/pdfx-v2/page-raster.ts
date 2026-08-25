import { getPdfJsStandardFontDataUrl } from '@/lib/pdfjs-node';

const MAX_RASTER_DIMENSION = 2_600;

type RasterCanvas = {
  width: number;
  height: number;
  getContext(type: '2d'): {
    fillStyle: string;
    fillRect(x: number, y: number, width: number, height: number): void;
  };
  toBuffer(type: 'image/png'): Buffer;
};

async function createPdfJsCanvas(width: number, height: number): Promise<RasterCanvas> {
  // Keep the native runtime as a direct, server-external dependency so Next.js
  // never tries to rewrite createRequire calls or bundle platform bindings.
  // Load it lazily because ordinary uploads do not need the raster fallback.
  const { createCanvas } = await import('@napi-rs/canvas');
  return createCanvas(width, height) as unknown as RasterCanvas;
}

/**
 * Render a single-page PDF to PNG without depending on qpdf, Poppler, or a
 * system OCR package. The generic worker runs this only after an OpenAI PDF
 * input times out, giving the vision request a much smaller, deterministic
 * fallback payload.
 */
export async function rasterizePdfPage(pdf: Buffer, pageNumber: number): Promise<Buffer> {
  if (!Number.isSafeInteger(pageNumber) || pageNumber < 1) {
    throw new Error(`Invalid PDF page number: ${pageNumber}`);
  }
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdf),
    standardFontDataUrl: getPdfJsStandardFontDataUrl(),
    useSystemFonts: true,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });
  const document = await loadingTask.promise;

  try {
    if (pageNumber > document.numPages) {
      throw new Error(`PDF page ${pageNumber} does not exist; document has ${document.numPages} pages`);
    }
    const page = await document.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.max(
      1,
      Math.min(3, MAX_RASTER_DIMENSION / Math.max(baseViewport.width, baseViewport.height)),
    );
    const viewport = page.getViewport({ scale });
    const canvas = await createPdfJsCanvas(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height),
    );
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({
      canvasContext: context as never,
      viewport,
      background: '#ffffff',
    }).promise;
    page.cleanup();
    return canvas.toBuffer('image/png');
  } finally {
    await document.destroy();
  }
}

export async function rasterizeSinglePagePdf(pagePdf: Buffer): Promise<Buffer> {
  return rasterizePdfPage(pagePdf, 1);
}
