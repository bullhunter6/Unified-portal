import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { startPdfJob } from '@/lib/pdfx/pipeline';
import { ensureUserId } from '@/lib/auth-db';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const targetLang = String(form.get('targetLang') || 'English');

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const userId = await ensureUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const jobId = randomUUID();

    const baseDir = path.join(process.cwd(), 'apps', 'web', '.pdfx_store');
    const uploadsDir = path.join(baseDir, 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    const filename = file.name || `upload_${jobId}.pdf`;
    const storedFilename = `${jobId}_${filename}`;
    const inputPath = path.join(uploadsDir, storedFilename);

    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(inputPath, Buffer.from(arrayBuffer));

    // kick off job
    await startPdfJob({
      jobId,
      userId,
      filename,
      storedFilename,
      inputPath,
      targetLang,
      baseDir,
    });

    return NextResponse.json({ success: true, jobId });
  } catch (e: any) {
    console.error('upload error', e);
    return NextResponse.json({ error: e.message || 'Upload failed' }, { status: 500 });
  }
}