import { NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { JobConcurrencyLimitError } from '@/lib/jobs/queue';
import { MAX_PDF_REQUEST_BYTES, MAX_PDF_UPLOAD_BYTES } from '@/lib/pdfx-v2/constants';
import { requirePdfxUser } from '@/lib/pdfx-v2/auth';
import { normalizePdfDisplayName } from '@/lib/pdfx-v2/file-policy';
import { startPdfTranslationV2Job } from '@/lib/pdfx-v2/pipeline';
import { isPdfxV2TargetLanguage } from '@/lib/pdfx-v2/types';

export const runtime = 'nodejs';

class PdfRequestTooLargeError extends Error {}

async function readBoundedBody(request: Request, maxBytes: number): Promise<ArrayBuffer> {
  if (!request.body) return new ArrayBuffer(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel('PDF upload is too large').catch(() => undefined);
        throw new PdfRequestTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}

export async function POST(request: Request) {
  try {
    const auth = await requirePdfxUser();
    if (auth.response) return auth.response;

    const contentLength = request.headers.get('content-length');
    if (contentLength !== null) {
      const length = Number(contentLength);
      if (!Number.isSafeInteger(length) || length < 0) {
        return NextResponse.json({ error: 'Invalid Content-Length header' }, { status: 400 });
      }
      if (length > MAX_PDF_REQUEST_BYTES) throw new PdfRequestTooLargeError();
    }
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().startsWith('multipart/form-data;')) {
      return NextResponse.json({ error: 'Expected a multipart form upload' }, { status: 415 });
    }

    let form: FormData;
    try {
      const body = await readBoundedBody(request, MAX_PDF_REQUEST_BYTES);
      const headers = new Headers(request.headers);
      headers.set('content-length', String(body.byteLength));
      form = await new Request(request.url, { method: 'POST', headers, body }).formData();
    } catch (error) {
      if (error instanceof PdfRequestTooLargeError) throw error;
      return NextResponse.json({ error: 'Malformed multipart upload' }, { status: 400 });
    }

    const file = form.get('file');
    const targetLang = String(form.get('targetLang') ?? 'English');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No PDF uploaded' }, { status: 400 });
    }
    if (!isPdfxV2TargetLanguage(targetLang)) {
      return NextResponse.json({ error: 'Unsupported target language' }, { status: 400 });
    }
    if (file.size < 1 || file.size > MAX_PDF_UPLOAD_BYTES) {
      const status = file.size > MAX_PDF_UPLOAD_BYTES ? 413 : 400;
      return NextResponse.json({ error: 'PDF must be between 1 byte and 512 MB' }, { status });
    }
    if (file.type && file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 415 });
    }
    if (Buffer.from(await file.slice(0, 5).arrayBuffer()).toString('ascii') !== '%PDF-') {
      return NextResponse.json({ error: 'Uploaded file is not a valid PDF' }, { status: 415 });
    }

    const inputBuffer = Buffer.from(await file.arrayBuffer());
    let pageCount = 0;
    try {
      pageCount = (await PDFDocument.load(inputBuffer, { updateMetadata: false })).getPageCount();
    } catch {
      return NextResponse.json({ error: 'PDF is malformed or encrypted' }, { status: 422 });
    }
    if (pageCount < 1) {
      return NextResponse.json({ error: 'PDF must contain at least one page' }, { status: 422 });
    }

    const filename = normalizePdfDisplayName(file.name, 'openai-translation');
    const jobId = await startPdfTranslationV2Job({
      userId: auth.userId,
      filename,
      targetLang,
      pageCount,
      inputBuffer,
    });
    return NextResponse.json({ success: true, jobId, pageCount });
  } catch (error) {
    if (error instanceof PdfRequestTooLargeError) {
      return NextResponse.json({ error: 'PDF exceeds the 512 MB upload maximum' }, { status: 413 });
    }
    if (error instanceof JobConcurrencyLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    console.error('[pdfx-v2] upload failed', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
