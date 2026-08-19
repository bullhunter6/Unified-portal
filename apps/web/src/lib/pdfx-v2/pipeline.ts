import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { esgPrisma } from '@esgcredit/db-esg';
import type { ClaimedBackgroundJob } from '@/lib/jobs/queue';
import {
  completePdfTranslationV2Job,
  createBackgroundJobData,
  rethrowBackgroundJobEnqueueError,
  throwIfJobCancelled,
  updateBackgroundJobProgress,
} from '@/lib/jobs/queue';
import { MAX_PDF_PAGES } from './file-policy';
import {
  DocumentContextSchema,
  PdfPageLayoutSchema,
  type DocumentContext,
  type PdfPageLayout,
} from './schemas';
import {
  buildDocumentContext,
  extractPageWithOpenAi,
  translatePageWithOpenAi,
} from './openai';
import { renderPdfxV2Document } from './render';
import { mergePageTranslation, pageLayoutToPlainText } from './serialize';
import type { PdfxV2JobPayload, PdfxV2Stage } from './types';

type StoredMetrics = {
  contextInputTokens?: number;
  contextOutputTokens?: number;
  contextModel?: string;
  contextResponseId?: string;
};

function jsonValue(value: unknown): any {
  return JSON.parse(JSON.stringify(value));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseLayout(value: unknown): PdfPageLayout | null {
  const parsed = PdfPageLayoutSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function parseContext(value: unknown): DocumentContext | null {
  const parsed = DocumentContextSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

async function splitPdfPages(input: Buffer): Promise<Buffer[]> {
  const source = await PDFDocument.load(input, { updateMetadata: false });
  const count = source.getPageCount();
  if (count < 1 || count > MAX_PDF_PAGES) {
    throw new Error(`PDF page count must be between 1 and ${MAX_PDF_PAGES}`);
  }

  const pages: Buffer[] = [];
  for (let index = 0; index < count; index += 1) {
    const document = await PDFDocument.create();
    const [page] = await document.copyPages(source, [index]);
    document.addPage(page);
    pages.push(Buffer.from(await document.save({ useObjectStreams: false })));
  }
  return pages;
}

export async function startPdfTranslationV2Job(params: {
  jobId?: string;
  userId: number;
  filename: string;
  targetLang: PdfxV2JobPayload['targetLang'];
  pageCount: number;
  inputBuffer: Buffer;
}): Promise<string> {
  const jobId = params.jobId ?? randomUUID();
  const payload: PdfxV2JobPayload = {
    filename: params.filename,
    targetLang: params.targetLang,
    pageCount: params.pageCount,
  };

  try {
    await esgPrisma.$transaction([
      esgPrisma.pdf_translation_v2_jobs.create({
        data: {
          id: jobId,
          user_id: params.userId,
          filename: params.filename,
          target_lang: params.targetLang,
          status: 'queued',
          stage: 'queued',
          message: 'Queued for OpenAI page analysis',
          progress: 0,
          total_pages: params.pageCount,
          current_page: 0,
          metrics: {},
          input_pdf: params.inputBuffer,
        },
      }),
      esgPrisma.background_jobs.create({
        data: createBackgroundJobData({
          id: jobId,
          jobType: 'pdf_translation_v2',
          userId: params.userId,
          payload,
          inputData: params.inputBuffer,
          maxAttempts: 3,
        }),
      }),
    ]);
  } catch (error) {
    rethrowBackgroundJobEnqueueError(error);
  }
  return jobId;
}

export async function processPdfTranslationV2Job(
  job: ClaimedBackgroundJob<PdfxV2JobPayload>,
): Promise<{ queueCompleted: true; result: Record<string, unknown> }> {
  if (!job.inputData) throw new Error('PDF Translator input is missing');

  const existing = await esgPrisma.pdf_translation_v2_jobs.findFirst({
    where: { id: job.id, user_id: job.userId },
    include: { pages: { orderBy: { page_number: 'asc' } } },
  });
  if (!existing) throw new Error('PDF Translator job record is missing');

  if (existing.status === 'completed' && existing.output_pdf) {
    const result = {
      pages: existing.total_pages,
      reused: true,
      translator: 'openai-structured-v2',
    };
    await completePdfTranslationV2Job(job.id, job.userId, job.leaseOwner, {
      outputPdf: Buffer.from(existing.output_pdf),
      metrics: existing.metrics,
      result,
      message: `Done. ${existing.total_pages} ${existing.total_pages === 1 ? 'page' : 'pages'} translated.`,
    });
    return { queueCompleted: true, result };
  }

  const workDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfx-v2-'));
  const outputPath = path.join(workDirectory, `${job.id}-translated.pdf`);

  const reportProgress = async (
    progress: number,
    stage: PdfxV2Stage,
    message: string,
    currentPage = 0,
  ) => {
    await throwIfJobCancelled(job.id, job.leaseOwner);
    await updateBackgroundJobProgress(job.id, job.leaseOwner, progress, {
      stage,
      message,
      currentPage,
      totalPages: job.payload.pageCount,
    });
    const update = await esgPrisma.pdf_translation_v2_jobs.updateMany({
      where: {
        id: job.id,
        user_id: job.userId,
        status: { in: ['queued', 'processing'] },
      },
      data: {
        status: 'processing',
        stage,
        message,
        progress,
        current_page: currentPage,
      },
    });
    if (update.count !== 1) {
      await throwIfJobCancelled(job.id, job.leaseOwner);
      throw new Error('PDF Translator job is no longer active');
    }
  };

  try {
    await reportProgress(3, 'extracting', 'Preparing PDF pages…');
    const pagePdfs = await splitPdfPages(job.inputData);
    if (pagePdfs.length !== job.payload.pageCount) {
      throw new Error('Uploaded PDF page count changed during processing');
    }

    const persistedPages = new Map(
      existing.pages.map((page) => [page.page_number, page]),
    );
    const sourceLayouts: PdfPageLayout[] = [];

    for (let index = 0; index < pagePdfs.length; index += 1) {
      const pageNumber = index + 1;
      const prior = persistedPages.get(pageNumber);
      const storedLayout = parseLayout(prior?.source_layout);
      if (storedLayout) {
        sourceLayouts.push(storedLayout);
        continue;
      }

      await reportProgress(
        5 + Math.round((index / Math.max(1, pagePdfs.length)) * 40),
        'extracting',
        `OpenAI is reading source page ${pageNumber}/${pagePdfs.length}…`,
        pageNumber,
      );
      let extracted: Awaited<ReturnType<typeof extractPageWithOpenAi>>;
      try {
        extracted = await extractPageWithOpenAi(pagePdfs[index], pageNumber);
      } catch (error) {
        await esgPrisma.pdf_translation_v2_pages.upsert({
          where: { job_id_page_number: { job_id: job.id, page_number: pageNumber } },
          create: {
            job_id: job.id,
            page_number: pageNumber,
            status: 'extraction_error',
            error_message: errorMessage(error),
            warnings: [],
          },
          update: {
            status: 'extraction_error',
            error_message: errorMessage(error),
          },
        });
        throw error;
      }
      await throwIfJobCancelled(job.id, job.leaseOwner);
      sourceLayouts.push(extracted.layout);
      await esgPrisma.pdf_translation_v2_pages.upsert({
        where: { job_id_page_number: { job_id: job.id, page_number: pageNumber } },
        create: {
          job_id: job.id,
          page_number: pageNumber,
          status: 'extracted',
          source_layout: jsonValue(extracted.layout),
          source_text: pageLayoutToPlainText(extracted.layout),
          extraction_model: extracted.model,
          extraction_attempts: extracted.attempts,
          input_tokens: extracted.inputTokens,
          output_tokens: extracted.outputTokens,
          warnings: jsonValue(extracted.layout.warnings),
        },
        update: {
          status: 'extracted',
          source_layout: jsonValue(extracted.layout),
          source_text: pageLayoutToPlainText(extracted.layout),
          extraction_model: extracted.model,
          extraction_attempts: extracted.attempts,
          input_tokens: extracted.inputTokens,
          output_tokens: extracted.outputTokens,
          warnings: jsonValue(extracted.layout.warnings),
          error_message: null,
        },
      });
    }

    let context = parseContext(existing.document_context);
    let storedMetrics = (existing.metrics && typeof existing.metrics === 'object'
      ? existing.metrics
      : {}) as StoredMetrics;
    if (!context) {
      await reportProgress(47, 'context', 'Building document terminology context…');
      const contextResult = await buildDocumentContext(
        sourceLayouts,
        job.payload.targetLang,
      );
      context = contextResult.context;
      storedMetrics = {
        ...storedMetrics,
        contextInputTokens: contextResult.inputTokens,
        contextOutputTokens: contextResult.outputTokens,
        contextModel: contextResult.model,
        contextResponseId: contextResult.responseId,
      };
      await throwIfJobCancelled(job.id, job.leaseOwner);
      await esgPrisma.pdf_translation_v2_jobs.updateMany({
        where: { id: job.id, user_id: job.userId, status: 'processing' },
        data: {
          document_context: jsonValue(context),
          metrics: jsonValue(storedMetrics),
        },
      });
    }

    const translatedLayouts: PdfPageLayout[] = [];
    for (let index = 0; index < sourceLayouts.length; index += 1) {
      const source = sourceLayouts[index];
      const pageNumber = source.pageNumber;
      const current = await esgPrisma.pdf_translation_v2_pages.findUnique({
        where: { job_id_page_number: { job_id: job.id, page_number: pageNumber } },
      });
      const storedTranslation = parseLayout(current?.translated_layout);
      if (current?.status === 'translated' && storedTranslation) {
        translatedLayouts.push(storedTranslation);
        continue;
      }

      await reportProgress(
        50 + Math.round((index / Math.max(1, sourceLayouts.length)) * 42),
        'translating',
        `Translating and validating page ${pageNumber}/${sourceLayouts.length}…`,
        pageNumber,
      );
      let translated: Awaited<ReturnType<typeof translatePageWithOpenAi>>;
      try {
        translated = await translatePageWithOpenAi(
          source,
          context,
          job.payload.targetLang,
        );
      } catch (error) {
        await esgPrisma.pdf_translation_v2_pages.update({
          where: { job_id_page_number: { job_id: job.id, page_number: pageNumber } },
          data: {
            status: 'translation_error',
            error_message: errorMessage(error),
          },
        });
        throw error;
      }
      await throwIfJobCancelled(job.id, job.leaseOwner);
      const merged = mergePageTranslation(source, translated.translation);
      translatedLayouts.push(merged);
      await esgPrisma.pdf_translation_v2_pages.update({
        where: { job_id_page_number: { job_id: job.id, page_number: pageNumber } },
        data: {
          status: 'translated',
          translated_layout: jsonValue(merged),
          translated_text: pageLayoutToPlainText(merged),
          translation_model: translated.model,
          translation_attempts: translated.attempts,
          input_tokens: { increment: translated.inputTokens },
          output_tokens: { increment: translated.outputTokens },
          validation: jsonValue(translated.validation),
          warnings: jsonValue(merged.warnings),
          error_message: null,
        },
      });
    }

    await reportProgress(94, 'rendering', 'Rendering translated tables and text…');
    await renderPdfxV2Document(translatedLayouts, outputPath);
    const outputPdf = await fs.readFile(outputPath);

    const usage = await esgPrisma.pdf_translation_v2_pages.aggregate({
      where: { job_id: job.id },
      _sum: { input_tokens: true, output_tokens: true },
    });
    const metrics = {
      ...storedMetrics,
      pageInputTokens: usage._sum.input_tokens ?? 0,
      pageOutputTokens: usage._sum.output_tokens ?? 0,
      sourcePages: sourceLayouts.length,
      translator: 'openai-structured-v2',
    };
    const result = {
      pages: sourceLayouts.length,
      translator: 'openai-structured-v2',
      targetLanguage: job.payload.targetLang,
    };
    await throwIfJobCancelled(job.id, job.leaseOwner);
    await completePdfTranslationV2Job(job.id, job.userId, job.leaseOwner, {
      outputPdf,
      metrics,
      result,
      message: `Done. ${sourceLayouts.length} ${sourceLayouts.length === 1 ? 'page' : 'pages'} translated and validated.`,
    });
    return { queueCompleted: true, result };
  } finally {
    await fs.rm(workDirectory, { recursive: true, force: true });
  }
}
