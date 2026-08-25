import { NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { esgPrisma } from '@esgcredit/db-esg';
import { isUuid } from '@/lib/jobs/queue';
import { requirePdfxUser } from '@/lib/pdfx-v2/auth';
import { rasterizePdfPage } from '@/lib/pdfx-v2/page-raster';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PreviewDocument = 'source' | 'translated';

function previewDocument(value: string | null): PreviewDocument | null {
  return value === 'source' || value === 'translated' ? value : null;
}

export async function GET(request: Request) {
  const auth = await requirePdfxUser();
  if (auth.response) return auth.response;

  const searchParams = new URL(request.url).searchParams;
  const jobId = searchParams.get('jobId') ?? '';
  const document = previewDocument(searchParams.get('document'));
  const pageParam = searchParams.get('page') ?? '';
  if (!isUuid(jobId)) {
    return NextResponse.json({ error: 'Invalid jobId' }, { status: 400 });
  }
  if (!document) {
    return NextResponse.json({ error: 'Invalid document' }, { status: 400 });
  }
  if (!/^[1-9]\d*$/.test(pageParam)) {
    return NextResponse.json({ error: 'Invalid page' }, { status: 400 });
  }

  const row = await esgPrisma.pdf_translation_v2_jobs.findFirst({
    where: { id: jobId, user_id: auth.userId },
    select: {
      status: true,
      total_pages: true,
      input_pdf: true,
      output_pdf: true,
    },
  });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const pageNumber = Number(pageParam);
  if (pageNumber > row.total_pages) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }
  if (document === 'translated' && (row.status !== 'completed' || !row.output_pdf)) {
    return NextResponse.json({ error: 'Translated preview is not ready' }, { status: 409 });
  }

  try {
    const sourceBytes = document === 'source' ? row.input_pdf : row.output_pdf!;
    const sourcePdf = Buffer.from(sourceBytes);
    const source = await PDFDocument.load(sourcePdf, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    if (pageNumber > source.getPageCount()) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    // Render the selected page directly. Copying complex source pages into a
    // temporary PDF can lose inherited resources and caused valid pages to
    // fail with 422 before PDF.js ever saw the original document.
    const png = await rasterizePdfPage(sourcePdf, pageNumber);
    return new Response(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(png.length),
        'Cache-Control': 'private, max-age=3600, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[pdfx-v2] preview render failed', {
      document,
      error: error instanceof Error ? error.message : String(error),
      jobId,
      pageNumber,
    });
    return NextResponse.json({ error: 'Unable to render the selected page' }, { status: 422 });
  }
}
