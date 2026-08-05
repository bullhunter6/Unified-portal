import { NextResponse } from 'next/server';
import { esgPrisma } from '@esgcredit/db-esg';
import { ensureUserId } from '@/lib/session-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const userId = await ensureUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId') || '';

    const [row, queue] = await Promise.all([
      esgPrisma.pdf_translation_jobs.findFirst({
        where: { id: jobId, user_id: userId },
      }),
      esgPrisma.background_jobs.findFirst({
        where: {
          id: jobId,
          user_id: userId,
          job_type: 'pdf_translation',
        },
        select: {
          status: true,
          progress: true,
          attempts: true,
          max_attempts: true,
          last_error: true,
        },
      }),
    ]);
    if (!row) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const activeDomain = ['queued', 'processing', 'cancelling'].includes(row.status);
    let status = row.status;
    let message = row.message;
    let progress = row.progress;

    if (activeDomain && queue?.status === 'error') {
      status = 'error';
      message = queue.last_error || 'Translation failed in the background worker';
      progress = 100;
    } else if (activeDomain && queue?.status === 'cancelled') {
      status = 'cancelled';
      message = 'Cancelled';
      progress = 100;
    } else if (activeDomain && queue?.status === 'done') {
      status = 'error';
      message = 'Translation result is unavailable';
      progress = 100;
    } else if (activeDomain && queue?.status === 'processing') {
      status = 'processing';
      progress = Math.max(progress, queue.progress);
      if (!message || message === 'Queued for processing') message = 'Worker started';
    } else if (activeDomain && queue?.status === 'queued') {
      progress = Math.max(progress, queue.progress);
    }

    return NextResponse.json({
      success: true,
      job: {
        id: row.id,
        userId: row.user_id,
        filename: row.filename,
        storedFilename: row.stored_filename,
        targetLang: row.target_lang,
        status,
        message,
        progress,
        totalPages: row.total_pages,
        currentPage: row.current_page,
        queueStatus: queue?.status ?? null,
        attempts: queue?.attempts ?? 0,
        maxAttempts: queue?.max_attempts ?? 0,
      },
    });
  } catch (error) {
    console.error('Error fetching PDF status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
