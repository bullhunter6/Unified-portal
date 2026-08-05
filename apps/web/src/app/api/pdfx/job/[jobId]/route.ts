import { NextResponse } from 'next/server';
import { esgPrisma } from '@esgcredit/db-esg';
import { ensureUserId } from '@/lib/session-user';
import fs from 'node:fs/promises';
import { assertPdfxManagedPath } from '@/lib/pdfx/fs';

export const runtime = 'nodejs';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const userId = await ensureUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = await params;
    const job = await esgPrisma.pdf_translation_jobs.findUnique({
      where: { id: jobId }
    });

    if (!job || job.user_id !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const outcome = await esgPrisma.$transaction(async (transaction) => {
      const queue = await transaction.$queryRaw<Array<{ status: string }>>`
        SELECT status FROM background_jobs
        WHERE id = ${jobId}::uuid AND user_id = ${userId}
        FOR UPDATE
      `;

      if (queue[0]?.status === 'processing') {
        await transaction.$executeRaw`
          UPDATE background_jobs
          SET cancel_requested = TRUE, updated_at = now()
          WHERE id = ${jobId}::uuid AND user_id = ${userId}
            AND status = 'processing'
        `;
        await transaction.pdf_translation_jobs.updateMany({
          where: {
            id: jobId,
            user_id: userId,
            status: { in: ['queued', 'processing', 'cancelling'] },
          },
          data: { status: 'cancelling', message: 'Cancelling...' },
        });
        return 'cancelling' as const;
      }

      await transaction.pdf_translation_jobs.deleteMany({
        where: { id: jobId, user_id: userId },
      });
      await transaction.$executeRaw`
        DELETE FROM background_jobs
        WHERE id = ${jobId}::uuid AND user_id = ${userId}
          AND status IN ('queued', 'done', 'error', 'cancelled')
      `;
      return 'deleted' as const;
    });

    if (outcome === 'cancelling') {
      return NextResponse.json({ success: true, status: 'cancelling' }, { status: 202 });
    }

    // Remove legacy filesystem-backed files only after the database deletion.
    const toDelete: string[] = [];
    if (job.input_path && !job.input_path.startsWith('db://')) {
      try {
        toDelete.push(assertPdfxManagedPath(job.input_path));
      } catch {
        console.warn(`Skipped unsafe input path for PDF job ${job.id}`);
      }
    }
    if (job.output_path && !job.output_path.startsWith('db://')) {
      try {
        toDelete.push(assertPdfxManagedPath(job.output_path));
      } catch {
        console.warn(`Skipped unsafe output path for PDF job ${job.id}`);
      }
    }
    await Promise.allSettled(
      toDelete.map(async (filePath) => {
        try {
          await fs.unlink(filePath);
        } catch (error) {
          console.warn(`Failed to delete managed file for PDF job ${job.id}:`, error);
        }
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting PDF job:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
