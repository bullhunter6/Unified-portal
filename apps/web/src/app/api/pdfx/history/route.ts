import { NextResponse } from 'next/server';
import { esgPrisma } from '@esgcredit/db-esg';
import { ensureUserId } from '@/lib/session-user';
import { parsePdfxPagination } from '@/lib/pdfx/pagination';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const userId = await ensureUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Optional: pagination
    const url = new URL(request.url);
    const pagination = parsePdfxPagination(url.searchParams);
    if (!pagination) {
      return NextResponse.json({ error: 'Invalid pagination' }, { status: 400 });
    }

    const [items, total] = await Promise.all([
      esgPrisma.pdf_translation_jobs.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        skip: pagination.skip,
        take: pagination.pageSize,
        select: {
          id: true,
          filename: true,
          stored_filename: true,
          status: true,
          message: true,
          progress: true,
          total_pages: true,
          created_at: true,
          updated_at: true,
        },
      }),
      esgPrisma.pdf_translation_jobs.count({
        where: { user_id: userId },
      }),
    ]);

    const response = NextResponse.json({
      items: items.map((item) => ({
        ...item,
        canDownload: item.status === 'completed',
      })),
      total,
      page: pagination.page,
      size: pagination.pageSize,
    });
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch (error) {
    console.error('Error fetching PDF translation history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
