import { NextResponse } from 'next/server';
import { esgPrisma } from '@esgcredit/db-esg';
import { requirePdfxUser } from '@/lib/pdfx-v2/auth';
import { isUuid } from '@/lib/jobs/queue';
import { buildPdfContentDisposition } from '@/lib/pdfx-v2/constants';
import { PDFDocument } from 'pdf-lib';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requirePdfxUser();
  if (auth.response) return auth.response;
  const searchParams = new URL(request.url).searchParams;
  const jobId = searchParams.get('jobId') ?? '';
  const pageParam = searchParams.get('page');
  if (!isUuid(jobId)) return NextResponse.json({ error: 'Invalid jobId' }, { status: 400 });
  if (pageParam !== null && !/^[1-9]\d*$/.test(pageParam)) {
    return NextResponse.json({ error: 'Invalid page' }, { status: 400 });
  }
  const row = await esgPrisma.pdf_translation_v2_jobs.findFirst({
    where: { id: jobId, user_id: auth.userId },
    select: { filename: true, input_pdf: true },
  });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  let buffer = Buffer.from(row.input_pdf);
  if (pageParam !== null) {
    try {
      const pageNumber = Number(pageParam);
      const source = await PDFDocument.load(buffer, { ignoreEncryption: true });
      if (pageNumber > source.getPageCount()) {
        return NextResponse.json({ error: 'Page not found' }, { status: 404 });
      }
      const singlePage = await PDFDocument.create();
      const [copiedPage] = await singlePage.copyPages(source, [pageNumber - 1]);
      singlePage.addPage(copiedPage);
      buffer = Buffer.from(await singlePage.save({ useObjectStreams: true }));
    } catch {
      return NextResponse.json({ error: 'Unable to prepare the source page' }, { status: 422 });
    }
  }
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(buffer.length),
      'Content-Disposition': buildPdfContentDisposition('inline', row.filename),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
