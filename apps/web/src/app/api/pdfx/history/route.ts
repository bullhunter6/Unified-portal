import { NextResponse } from 'next/server';
import { esgPrisma } from '@esgcredit/db-esg';
import { ensureUserId } from '@/lib/auth-db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const userId = await ensureUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Optional: pagination
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const size = Math.min(Number(url.searchParams.get('size') ?? 20), 100);

    const [items, total] = await Promise.all([
      esgPrisma.pdf_translation_jobs.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * size,
        take: size,
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
          output_path: true,
        },
      }),
      esgPrisma.pdf_translation_jobs.count({
        where: { user_id: userId },
      }),
    ]);

    return NextResponse.json({ items, total, page, size });
  } catch (error) {
    console.error('Error fetching PDF translation history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
