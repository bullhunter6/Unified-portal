import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/api-auth', () => ({
  requireAdminSession: mocks.requireAdminSession,
}));
vi.mock('@esgcredit/db-esg', () => ({
  esgPrisma: { $queryRaw: mocks.queryRaw },
}));

import { GET } from '@/app/api/admin/pdf-translator/stats/route';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdminSession.mockResolvedValue({
    session: { user: { id: '1', email: 'admin@example.com' } },
  });
});

describe('PDF Translator admin analytics', () => {
  it('rejects a non-admin before querying usage data', async () => {
    mocks.requireAdminSession.mockResolvedValue({
      response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
    });

    const response = await GET(new Request('http://localhost/api/admin/pdf-translator/stats'));

    expect(response.status).toBe(403);
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });

  it('rejects unsupported date periods', async () => {
    const response = await GET(new Request(
      'http://localhost/api/admin/pdf-translator/stats?period=999',
    ));

    expect(response.status).toBe(400);
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });

  it('returns normalized translator usage metrics', async () => {
    mocks.queryRaw
      .mockResolvedValueOnce([{
        total_jobs: 4,
        completed_jobs: 3,
        failed_jobs: 1,
        cancelled_jobs: 0,
        active_jobs: 0,
        unique_users: 2,
        total_pages: 20,
        uploaded_bytes: 10_000,
        output_bytes: 5_000,
        average_duration_seconds: 90,
        p95_duration_seconds: 180,
      }])
      .mockResolvedValueOnce([{
        page_records: 20,
        input_tokens: 1_000,
        output_tokens: 500,
        extraction_attempts: 22,
        translation_attempts: 24,
      }])
      .mockResolvedValueOnce([{
        total_jobs: 10,
        unique_users: 3,
        total_pages: 45,
        total_tokens: 4_000,
      }])
      .mockResolvedValueOnce([{ status: 'completed', jobs: 3 }, { status: 'error', jobs: 1 }])
      .mockResolvedValueOnce([{ language: 'Russian', jobs: 4, pages: 20, tokens: 1_500 }])
      .mockResolvedValueOnce([{
        date: new Date('2026-08-25T00:00:00.000Z'), jobs: 4, completed: 3,
        failed: 1, pages: 20, tokens: 1_500,
      }])
      .mockResolvedValueOnce([{ role: 'Translation', model: 'gpt-5.6-luna', pages: 20, attempts: 24 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const response = await GET(new Request(
      'http://localhost/api/admin/pdf-translator/stats?period=30',
    ));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.overview).toMatchObject({
      totalJobs: 4,
      totalPages: 20,
      totalTokens: 1500,
      successRate: 0.75,
      averagePagesPerJob: 5,
      averageTokensPerPage: 75,
    });
    expect(payload.lifetime).toEqual({
      totalJobs: 10,
      uniqueUsers: 3,
      totalPages: 45,
      totalTokens: 4000,
    });
    expect(payload.modelBreakdown[0]).toEqual({
      role: 'Translation',
      model: 'gpt-5.6-luna',
      pages: 20,
      attempts: 24,
    });
    expect(mocks.queryRaw).toHaveBeenCalledTimes(9);
  });
});
