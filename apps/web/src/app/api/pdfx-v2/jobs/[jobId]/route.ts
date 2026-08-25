import { NextResponse } from 'next/server';
import { esgPrisma } from '@esgcredit/db-esg';
import { requirePdfxUser } from '@/lib/pdfx-v2/auth';
import { isUuid } from '@/lib/jobs/queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DeleteJobParams = { jobId: string };
type DeleteJobOutcome = {
  owned_status: string | null;
  queue_active: boolean;
  deleted: boolean;
};

export async function DELETE(
  _request: Request,
  context: { params: Promise<DeleteJobParams> },
) {
  const auth = await requirePdfxUser();
  if (auth.response) return auth.response;

  const { jobId } = await context.params;
  if (!isUuid(jobId)) {
    return NextResponse.json({ error: 'Invalid jobId' }, { status: 400 });
  }

  try {
    const [outcome] = await esgPrisma.$queryRaw<DeleteJobOutcome[]>`
      WITH owned_job AS MATERIALIZED (
        SELECT id, status
        FROM pdf_translation_v2_jobs
        WHERE id = ${jobId}::uuid
          AND user_id = ${auth.userId}
      ),
      active_queue AS MATERIALIZED (
        SELECT id
        FROM background_jobs
        WHERE id = ${jobId}::uuid
          AND user_id = ${auth.userId}
          AND status NOT IN ('done', 'error', 'cancelled')
      ),
      deleted_queue AS (
        DELETE FROM background_jobs
        WHERE id = ${jobId}::uuid
          AND user_id = ${auth.userId}
          AND status IN ('done', 'error', 'cancelled')
          AND EXISTS (
            SELECT 1 FROM owned_job
            WHERE status IN ('completed', 'error', 'cancelled')
          )
          AND NOT EXISTS (SELECT 1 FROM active_queue)
        RETURNING id
      ),
      deleted_job AS (
        DELETE FROM pdf_translation_v2_jobs
        WHERE id = ${jobId}::uuid
          AND user_id = ${auth.userId}
          AND status IN ('completed', 'error', 'cancelled')
          AND NOT EXISTS (SELECT 1 FROM active_queue)
        RETURNING id
      )
      SELECT
        (SELECT status FROM owned_job LIMIT 1) AS owned_status,
        EXISTS (SELECT 1 FROM active_queue) AS queue_active,
        EXISTS (SELECT 1 FROM deleted_job) AS deleted
    `;

    if (!outcome?.owned_status) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (outcome.queue_active || !outcome.deleted) {
      return NextResponse.json(
        { error: 'An active translation cannot be deleted. Cancel it first and wait for it to stop.' },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true, jobId });
  } catch (error) {
    console.error(`[pdfx-v2] Failed to delete translation ${jobId}`, error);
    return NextResponse.json({ error: 'Unable to delete this translation right now.' }, { status: 500 });
  }
}
