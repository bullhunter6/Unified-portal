import { NextResponse } from 'next/server';
import { esgPrisma } from '@esgcredit/db-esg';
import { JobStore } from '@/lib/pdfx/store';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId') || '';

  const mem = JobStore.get(jobId);
  if (mem) {
    return NextResponse.json({
      success: true,
      pages: mem.pages.map(p => ({
        pageNumber: p.pageNumber,
        originalText: p.originalText,
        translatedText: p.translatedText || '',
      })),
    });
  }

  const row = await esgPrisma.pdf_translation_jobs.findUnique({ where: { id: jobId } });
  if (!row) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

  const pages = (row.translated_pages as any[]) || [];
  return NextResponse.json({
    success: true,
    pages: pages.map(p => ({
      pageNumber: p.pageNumber,
      originalText: p.originalText || '',
      translatedText: p.translatedText || '',
    })),
  });
}