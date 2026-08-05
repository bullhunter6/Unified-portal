import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import { esgPrisma } from '@esgcredit/db-esg';
import { ensureUserId } from '@/lib/session-user';
import { assertPdfxManagedPath } from '@/lib/pdfx/fs';
import { buildPdfxContentDisposition } from '@/lib/pdfx/constants';
import { isUuid } from '@/lib/jobs/queue';

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

    if (!isUuid(jobId)) {
      return NextResponse.json({ error: 'Invalid jobId' }, { status: 400 });
    }

    const row = await esgPrisma.pdf_translation_jobs.findFirst({
      where: { id: jobId, user_id: userId },
    });
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (row.status !== 'completed') {
      return NextResponse.json({ error: 'Translation is not complete' }, { status: 409 });
    }

    if (!row.output_pdf && !row.output_path) {
      return NextResponse.json({ error: 'No output file yet' }, { status: 409 });
    }

    let buf: Buffer;
    
    // Try to get PDF from database first, fallback to file system
    if (row.output_pdf) {
      buf = Buffer.from(row.output_pdf);
    } else if (row.output_path) {
      // Fallback to file system (for old translations)
      try {
        const managedOutputPath = assertPdfxManagedPath(row.output_path);
        buf = await fs.readFile(managedOutputPath);
      } catch (fileError) {
        console.error(`Failed to read PDF from managed storage for job ${jobId}`, fileError);
        return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
      }
    } else {
      return NextResponse.json({ error: 'No output file available' }, { status: 404 });
    }

    const basename = row.filename.replace(/\.[^.]+$/, '') || 'document';
    const filename = `translated_${basename}.pdf`;

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(buf.length),
        'Content-Disposition': buildPdfxContentDisposition('attachment', filename),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Error downloading PDF:', error);
    return NextResponse.json({ error: 'Unable to download PDF' }, { status: 500 });
  }
}
