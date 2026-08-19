import { NextResponse } from 'next/server';
import { esgPrisma } from '@esgcredit/db-esg';
import { requirePdfxUser } from '@/lib/pdfx-v2/auth';
import { isUuid } from '@/lib/jobs/queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requirePdfxUser();
  if (auth.response) return auth.response;
  const jobId = new URL(request.url).searchParams.get('jobId') ?? '';
  if (!isUuid(jobId)) return NextResponse.json({ error: 'Invalid jobId' }, { status: 400 });

  const job = await esgPrisma.pdf_translation_v2_jobs.findFirst({
    where: { id: jobId, user_id: auth.userId },
    select: {
      status: true,
      total_pages: true,
      pages: {
        orderBy: { page_number: 'asc' },
        select: {
          page_number: true,
          status: true,
          source_text: true,
          translated_text: true,
          source_layout: true,
          translated_layout: true,
          warnings: true,
          validation: true,
        },
      },
    },
  });
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const response = NextResponse.json({
    success: true,
    status: job.status,
    totalPages: job.total_pages,
    pages: job.pages.map((page) => ({
      pageNumber: page.page_number,
      status: page.status,
      originalText: page.source_text ?? '',
      translatedText: page.translated_text ?? '',
      sourceLayout: page.source_layout,
      translatedLayout: page.translated_layout,
      warnings: page.warnings,
      validation: page.validation,
    })),
  });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
