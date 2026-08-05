import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const domainOperation = { operation: 'create-pdf-domain' };
  const queueOperation = { operation: 'create-background-job' };
  const createPdfDomain = vi.fn(
    (_args: { data: Record<string, unknown> }) => domainOperation,
  );
  const createQueueRow = vi.fn(
    (_args: { data: Record<string, unknown> }) => queueOperation,
  );
  const transaction = vi.fn(async (operations: unknown) => {
    if (!Array.isArray(operations)) {
      throw new Error('Interactive transactions are forbidden for uploaded PDFs');
    }
    return operations;
  });
  return {
    domainOperation,
    queueOperation,
    createPdfDomain,
    createQueueRow,
    transaction,
  };
});

vi.mock('@esgcredit/db-esg', () => ({
  esgPrisma: {
    pdf_translation_jobs: { create: mocks.createPdfDomain },
    background_jobs: { create: mocks.createQueueRow },
    $transaction: mocks.transaction,
  },
}));
vi.mock('@/lib/pdfx/buildPdf', () => ({ buildTranslatedPdf: vi.fn() }));
vi.mock('@/lib/pdfx/extract', () => ({
  extractAllPages: vi.fn(),
  ocrPageToText: vi.fn(),
  selectBestPageText: vi.fn(),
}));
vi.mock('@/lib/pdfx/translate', () => ({ translatePage: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('startPdfJob', () => {
  const params = {
    jobId: '11111111-1111-4111-8111-111111111111',
    userId: 7,
    filename: 'scan.pdf',
    storedFilename: 'scan.pdf',
    targetLang: 'English',
    pageCount: 12,
  };

  it('atomically enqueues a large PDF without an interactive transaction', async () => {
    const { startPdfJob } = await import('@/lib/pdfx/pipeline');
    const inputBuffer = Buffer.alloc(6 * 1024 * 1024, 0x41);

    await startPdfJob({ ...params, inputBuffer });

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.transaction.mock.calls[0]?.[0]).toEqual([
      mocks.domainOperation,
      mocks.queueOperation,
    ]);
    expect(mocks.createPdfDomain).toHaveBeenCalledTimes(1);
    expect(mocks.createQueueRow).toHaveBeenCalledTimes(1);

    const queueData = mocks.createQueueRow.mock.calls[0]?.[0]?.data;
    expect(queueData).toEqual(expect.objectContaining({
      id: params.jobId,
      job_type: 'pdf_translation',
      user_id: params.userId,
      max_attempts: 2,
      idempotency_key: `pdf_translation:${params.jobId}`,
      status: 'queued',
    }));
    expect(queueData.input_data).toBe(inputBuffer);
  });

  it('preserves the queue concurrency error contract around the batch', async () => {
    const { JobConcurrencyLimitError } = await import('@/lib/jobs/queue');
    const { startPdfJob } = await import('@/lib/pdfx/pipeline');
    mocks.transaction.mockRejectedValueOnce(
      new Error('database trigger: background_job_concurrency_limit'),
    );

    await expect(startPdfJob({
      ...params,
      inputBuffer: Buffer.from('%PDF'),
    })).rejects.toBeInstanceOf(JobConcurrencyLimitError);
  });
});
