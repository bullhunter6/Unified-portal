import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const statements: Array<{ sql: string; values: unknown[] }> = [];
  const queryRaw = vi.fn(
    async (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]> => {
      const sql = strings.join('?');
      statements.push({ sql, values });
      if (sql.includes('WITH eligible_queue AS MATERIALIZED')) {
        return [{
          queue_eligible: true,
          domain_updated: true,
          queue_completed: true,
        }];
      }
      return [];
    },
  );
  const executeRaw = vi.fn(async () => 1);
  return {
    statements,
    queryRaw,
    executeRaw,
    transaction: vi.fn(() => {
      throw new Error('Interactive transactions are forbidden for PDF blobs');
    }),
  };
});

vi.mock('@esgcredit/db-esg', () => ({
  esgPrisma: {
    $queryRaw: mocks.queryRaw,
    $executeRaw: mocks.executeRaw,
    $transaction: mocks.transaction,
  },
}));

beforeEach(() => {
  mocks.statements.length = 0;
  vi.clearAllMocks();
});

describe('PDF queue lifecycle', () => {
  it('constrains claiming and reaping to the worker-supported job types', async () => {
    const { claimBackgroundJobs } = await import('@/lib/jobs/queue');
    await claimBackgroundJobs(
      'legacy-worker',
      2,
      90,
      ['esg_driver'],
      'esg_driver',
    );

    const queueStatements = mocks.statements.map(({ sql }) => sql);
    expect(queueStatements).toHaveLength(3);
    expect(queueStatements.every((sql) => sql.includes('job_type = ANY'))).toBe(true);
    expect(mocks.statements.every(({ values }) =>
      values.some((value) => Array.isArray(value) && value[0] === 'esg_driver'),
    )).toBe(true);
  });

  it('atomically completes the domain row without duplicating its PDF blob', async () => {
    const { completePdfTranslationJob } = await import('@/lib/jobs/queue');
    const outputPdf = Buffer.alloc(6 * 1024 * 1024, 0x5a);
    await completePdfTranslationJob(
      '11111111-1111-4111-8111-111111111111',
      7,
      'lease-token',
      {
        outputPdf,
        translatedPages: [],
        result: { pages: 1 },
        message: 'Done.',
      },
    );

    const completion = mocks.statements.find(({ sql }) =>
      sql.includes('WITH eligible_queue AS MATERIALIZED'),
    );
    expect(completion?.sql).toContain('UPDATE pdf_translation_jobs AS domain');
    expect(completion?.sql).toContain('UPDATE background_jobs AS queue');
    expect(completion?.sql).toContain('output_data = NULL');
    expect(completion?.values).toContain(outputPdf);
    expect(mocks.transaction).not.toHaveBeenCalled();
  }, 15_000);

  it('does not complete the queue row when the PDF domain row is missing', async () => {
    mocks.queryRaw.mockResolvedValueOnce([{
      queue_eligible: true,
      domain_updated: false,
      queue_completed: false,
    }]);
    const { completePdfTranslationJob } = await import('@/lib/jobs/queue');

    await expect(completePdfTranslationJob(
      '11111111-1111-4111-8111-111111111111',
      7,
      'lease-token',
      {
        outputPdf: Buffer.from('%PDF'),
        translatedPages: [],
        result: { pages: 1 },
        message: 'Done.',
      },
    )).rejects.toThrow('PDF translation record is missing or already terminal');
  });
});
