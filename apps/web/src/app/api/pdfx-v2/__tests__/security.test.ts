import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findOwnedJob: vi.fn(),
  updateJob: vi.fn(),
  cancelQueueJob: vi.fn(),
}));

vi.mock('@esgcredit/db-esg', () => ({
  esgPrisma: {
    pdf_translation_v2_jobs: {
      findFirst: mocks.findOwnedJob,
      updateMany: mocks.updateJob,
    },
  },
}));
vi.mock('@/lib/pdfx-v2/auth', () => ({
  requirePdfxUser: vi.fn(async () => ({ userId: 7, response: null })),
}));
vi.mock('@/lib/jobs/queue', async () => {
  const actual = await vi.importActual<typeof import('@/lib/jobs/queue')>('@/lib/jobs/queue');
  return { ...actual, requestBackgroundJobCancellation: mocks.cancelQueueJob };
});

beforeEach(() => vi.clearAllMocks());

describe('PDF Translator API ownership', () => {
  it('does not cancel another feature job when no owned translator row exists', async () => {
    mocks.findOwnedJob.mockResolvedValue(null);
    const { POST } = await import('../cancel/route');
    const response = await POST(new Request('http://localhost/api/pdfx-v2/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: '11111111-1111-4111-8111-111111111111' }),
    }));
    expect(response.status).toBe(404);
    expect(mocks.findOwnedJob).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: '11111111-1111-4111-8111-111111111111', user_id: 7 },
    }));
    expect(mocks.cancelQueueJob).not.toHaveBeenCalled();
  });
});
