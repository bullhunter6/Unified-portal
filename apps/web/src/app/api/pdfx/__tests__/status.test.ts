import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findDomain: vi.fn(),
  findQueue: vi.fn(),
}));

vi.mock('@esgcredit/db-esg', () => ({
  esgPrisma: {
    pdf_translation_jobs: { findFirst: mocks.findDomain },
    background_jobs: { findFirst: mocks.findQueue },
  },
}));
vi.mock('@/lib/session-user', () => ({
  ensureUserId: vi.fn().mockResolvedValue(7),
}));

import { GET } from '@/app/api/pdfx/status/route';

const jobId = 'aee894f7-e050-422f-8f5e-a4aaa850e778';
const domain = {
  id: jobId,
  user_id: 7,
  filename: 'scan.pdf',
  stored_filename: `${jobId}.pdf`,
  target_lang: 'English',
  status: 'queued',
  message: 'Queued for processing',
  progress: 0,
  total_pages: 18,
  current_page: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findDomain.mockResolvedValue({ ...domain });
  mocks.findQueue.mockResolvedValue({
    status: 'queued',
    progress: 0,
    attempts: 0,
    max_attempts: 2,
    last_error: null,
  });
});

describe('PDF status reconciliation', () => {
  it('surfaces a terminal queue failure instead of reporting queued forever', async () => {
    mocks.findQueue.mockResolvedValue({
      status: 'error',
      progress: 100,
      attempts: 2,
      max_attempts: 2,
      last_error: 'Unsupported job type for ESG Drivers worker: pdf_translation',
    });

    const response = await GET(new Request(
      `http://localhost/api/pdfx/status?jobId=${jobId}`,
    ));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.job).toEqual(expect.objectContaining({
      status: 'error',
      progress: 100,
      queueStatus: 'error',
      attempts: 2,
      maxAttempts: 2,
      message: 'Unsupported job type for ESG Drivers worker: pdf_translation',
    }));
  });

  it('shows that a worker has claimed the job before domain progress is flushed', async () => {
    mocks.findQueue.mockResolvedValue({
      status: 'processing',
      progress: 5,
      attempts: 1,
      max_attempts: 2,
      last_error: null,
    });

    const response = await GET(new Request(
      `http://localhost/api/pdfx/status?jobId=${jobId}`,
    ));
    const payload = await response.json();

    expect(payload.job).toEqual(expect.objectContaining({
      status: 'processing',
      progress: 5,
      message: 'Worker started',
    }));
  });

  it('does not overwrite a completed domain record with stale queue metadata', async () => {
    mocks.findDomain.mockResolvedValue({
      ...domain,
      status: 'completed',
      message: 'Done. 18 pages processed.',
      progress: 100,
      current_page: 18,
    });
    mocks.findQueue.mockResolvedValue({
      status: 'error',
      progress: 100,
      attempts: 2,
      max_attempts: 2,
      last_error: 'stale queue state',
    });

    const response = await GET(new Request(
      `http://localhost/api/pdfx/status?jobId=${jobId}`,
    ));
    const payload = await response.json();

    expect(payload.job).toEqual(expect.objectContaining({
      status: 'completed',
      progress: 100,
      message: 'Done. 18 pages processed.',
    }));
  });
});
