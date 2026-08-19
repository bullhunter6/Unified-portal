import { NextResponse } from 'next/server';
import { esgPrisma } from '@esgcredit/db-esg';
import { requirePdfxUser } from '@/lib/pdfx-v2/auth';
import { isUuid, requestBackgroundJobCancellation } from '@/lib/jobs/queue';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await requirePdfxUser();
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => ({})) as { jobId?: unknown };
  const jobId = typeof body.jobId === 'string' ? body.jobId : '';
  if (!isUuid(jobId)) return NextResponse.json({ error: 'Invalid jobId' }, { status: 400 });
  const ownedJob = await esgPrisma.pdf_translation_v2_jobs.findFirst({
    where: { id: jobId, user_id: auth.userId },
    select: { id: true },
  });
  if (!ownedJob) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const status = await requestBackgroundJobCancellation(jobId, auth.userId);
  if (!status) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (status === 'done' || status === 'error') {
    return NextResponse.json({ error: 'This job is already finished' }, { status: 409 });
  }
  const cancelled = status === 'cancelled';
  await esgPrisma.pdf_translation_v2_jobs.updateMany({
    where: {
      id: jobId,
      user_id: auth.userId,
      status: { in: ['queued', 'processing', 'cancelling'] },
    },
    data: {
      status: cancelled ? 'cancelled' : 'cancelling',
      stage: cancelled ? 'cancelled' : undefined,
      message: cancelled ? 'Cancelled' : 'Cancelling…',
      progress: cancelled ? 100 : undefined,
      completed_at: cancelled ? new Date() : undefined,
    },
  });
  return NextResponse.json({ success: true, status: cancelled ? 'cancelled' : 'cancelling' });
}
