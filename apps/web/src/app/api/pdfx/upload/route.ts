import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { startPdfJob } from '@/lib/pdfx/pipeline';
import { requirePdfxUser } from '@/lib/pdfx/auth';
import { enforceApiUsage } from '@/lib/api-usage';
import { JobConcurrencyLimitError } from '@/lib/jobs/queue';
import {
  MAX_PDF_PAGES,
  normalizePdfDisplayName,
} from '@/lib/pdfx/fs';
import {
  isPdfxSupportedLanguage,
  MAX_PDF_REQUEST_BYTES,
  MAX_PDF_UPLOAD_BYTES,
} from '@/lib/pdfx/constants';

export const runtime = 'nodejs';

class PdfRequestTooLargeError extends Error {}

export async function POST(req: Request) {
  try {
    const auth = await requirePdfxUser();
    if (auth.response) return auth.response;

    const contentLengthHeader = req.headers.get('content-length');
    const contentLength = contentLengthHeader === null
      ? null
      : Number(contentLengthHeader);
    if (
      contentLength !== null &&
      (!Number.isSafeInteger(contentLength) || contentLength < 0)
    ) {
      return NextResponse.json({ error: 'Invalid Content-Length header' }, { status: 400 });
    }
    if (contentLength !== null && contentLength > MAX_PDF_REQUEST_BYTES) {
      return NextResponse.json({ error: 'PDF exceeds the 20 MB limit' }, { status: 413 });
    }

    const contentType = req.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('multipart/form-data;')) {
      return NextResponse.json({ error: 'Expected a multipart form upload' }, { status: 415 });
    }

    let form: FormData;
    try {
      const requestBody = await readBoundedRequestBody(req, MAX_PDF_REQUEST_BYTES);
      const headers = new Headers(req.headers);
      headers.set('content-length', String(requestBody.byteLength));
      form = await new Request(req.url, {
        method: 'POST',
        headers,
        body: requestBody,
      }).formData();
    } catch (error) {
      if (error instanceof PdfRequestTooLargeError) throw error;
      return NextResponse.json({ error: 'Malformed multipart upload' }, { status: 400 });
    }

    const file = form.get('file');
    const targetLang = String(form.get('targetLang') || 'English');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: 'PDF cannot be empty' }, { status: 400 });
    }
    if (file.size > MAX_PDF_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'PDF exceeds the 20 MB limit' }, { status: 413 });
    }

    if (file.type && file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 415 });
    }

    if (!isPdfxSupportedLanguage(targetLang)) {
      return NextResponse.json({ error: 'Unsupported target language' }, { status: 400 });
    }

    const jobId = randomUUID();

    const header = Buffer.from(await file.slice(0, 5).arrayBuffer()).toString('ascii');
    if (header !== '%PDF-') {
      return NextResponse.json({ error: 'Uploaded file is not a valid PDF' }, { status: 415 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let pageCount: number;
    try {
      const pdf = await PDFDocument.load(buffer, { updateMetadata: false });
      pageCount = pdf.getPageCount();
    } catch {
      return NextResponse.json({ error: 'PDF is malformed or encrypted' }, { status: 422 });
    }

    if (pageCount < 1 || pageCount > MAX_PDF_PAGES) {
      return NextResponse.json(
        { error: `PDF must contain between 1 and ${MAX_PDF_PAGES} pages` },
        { status: 422 },
      );
    }

    const limited = await enforceApiUsage(req, {
      feature: 'pdf_translation',
      userId: auth.userId,
      perMinute: 3,
      perDay: 20,
      dailyCostUnits: 500,
      costUnits: pageCount,
      maxConcurrentJobs: 2,
      jobType: 'pdf_translation',
    });
    if (limited) return limited;

    const filename = normalizePdfDisplayName(file.name, jobId);
    const storedFilename = `${jobId}.pdf`;
    await startPdfJob({
      jobId,
      userId: auth.userId,
      filename,
      storedFilename,
      targetLang,
      pageCount,
      inputBuffer: buffer,
    });

    return NextResponse.json({ success: true, jobId, pageCount });
  } catch (e: unknown) {
    if (e instanceof PdfRequestTooLargeError) {
      return NextResponse.json({ error: 'PDF exceeds the 20 MB limit' }, { status: 413 });
    }
    if (e instanceof JobConcurrencyLimitError) {
      return NextResponse.json({ error: e.message }, { status: 429 });
    }
    console.error('upload error', e);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

async function readBoundedRequestBody(req: Request, maxBytes: number): Promise<ArrayBuffer> {
  if (!req.body) return new ArrayBuffer(0);

  const reader = req.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel('PDF upload is too large').catch(() => undefined);
        throw new PdfRequestTooLargeError('PDF upload is too large');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  const body = new ArrayBuffer(totalBytes);
  const bytes = new Uint8Array(body);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
