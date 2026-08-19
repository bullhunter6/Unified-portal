import { NextResponse } from 'next/server';
import { esgPrisma } from '@esgcredit/db-esg';
import { requirePdfxUser } from '@/lib/pdfx-v2/auth';
import { isUuid } from '@/lib/jobs/queue';
import { buildPdfContentDisposition } from '@/lib/pdfx-v2/constants';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requirePdfxUser();
  if (auth.response) return auth.response;
  const jobId = new URL(request.url).searchParams.get('jobId') ?? '';
  if (!isUuid(jobId)) return NextResponse.json({ error: 'Invalid jobId' }, { status: 400 });
  const row = await esgPrisma.pdf_translation_v2_jobs.findFirst({
    where: { id: jobId, user_id: auth.userId },
    select: { filename: true, status: true, output_pdf: true },
  });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (row.status !== 'completed' || !row.output_pdf) {
    return NextResponse.json({ error: 'Translation is not complete' }, { status: 409 });
  }
  const buffer = Buffer.from(row.output_pdf);
  const basename = row.filename.replace(/\.[^.]+$/, '') || 'document';
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(buffer.length),
      'Content-Disposition': buildPdfContentDisposition('attachment', `openai_translated_${basename}.pdf`),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
