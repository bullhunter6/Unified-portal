import { NextResponse } from 'next/server';
import { esgPrisma } from '@esgcredit/db-esg';
import { requirePdfxUser } from '@/lib/pdfx/auth';
import { isUuid } from '@/lib/jobs/queue';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const auth = await requirePdfxUser();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId') || '';

  if (!isUuid(jobId)) {
    return NextResponse.json({ success: false, error: 'Invalid jobId' }, { status: 400 });
  }

  const row = await esgPrisma.pdf_translation_jobs.findFirst({
    where: { id: jobId, user_id: auth.userId },
  });
  if (!row) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

  const rawPages = Array.isArray(row.translated_pages) ? row.translated_pages : [];
  const pages = rawPages
    .map(normalizePageRecord)
    .filter((page): page is PersistedPage => page !== null)
    .sort((left, right) => left.pageNumber - right.pageNumber);
  const response = NextResponse.json({
    success: true,
    status: row.status,
    totalPages: row.total_pages,
    pages,
  });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

type PersistedPage = {
  pageNumber: number;
  originalText: string;
  translatedText: string;
};

function normalizePageRecord(value: unknown): PersistedPage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const pageNumber = Number(record.pageNumber ?? record.page_number);
  if (!Number.isSafeInteger(pageNumber) || pageNumber < 1) return null;

  return {
    pageNumber,
    originalText: stringValue(record.originalText ?? record.original_text),
    translatedText: stringValue(record.translatedText ?? record.translated_text),
  };
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
