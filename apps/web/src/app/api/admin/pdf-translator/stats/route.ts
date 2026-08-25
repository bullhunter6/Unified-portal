import { NextResponse } from 'next/server';
import { esgPrisma } from '@esgcredit/db-esg';
import { requireAdminSession } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PERIODS = new Set(['7', '30', '90', '365', 'all']);

function numberValue(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (auth.response) return auth.response;

  const period = new URL(request.url).searchParams.get('period') ?? '30';
  if (!PERIODS.has(period)) {
    return NextResponse.json({ error: 'Invalid period' }, { status: 400 });
  }

  const endDate = new Date();
  const startDate = period === 'all'
    ? new Date(0)
    : new Date(endDate.getTime() - Number(period) * 24 * 60 * 60 * 1000);

  try {
    const [
      overviewRows,
      tokenRows,
      lifetimeRows,
      statusRows,
      languageRows,
      dailyRows,
      modelRows,
      topUserRows,
      recentJobRows,
    ] = await Promise.all([
      esgPrisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT
          COUNT(*)::bigint AS total_jobs,
          COUNT(*) FILTER (WHERE status = 'completed')::bigint AS completed_jobs,
          COUNT(*) FILTER (WHERE status = 'error')::bigint AS failed_jobs,
          COUNT(*) FILTER (WHERE status = 'cancelled')::bigint AS cancelled_jobs,
          COUNT(*) FILTER (WHERE status IN ('queued', 'processing'))::bigint AS active_jobs,
          COUNT(DISTINCT user_id)::bigint AS unique_users,
          COALESCE(SUM(total_pages), 0)::bigint AS total_pages,
          COALESCE(SUM(octet_length(input_pdf)), 0)::bigint AS uploaded_bytes,
          COALESCE(SUM(octet_length(output_pdf)), 0)::bigint AS output_bytes,
          COALESCE(
            AVG(EXTRACT(EPOCH FROM (completed_at - created_at)))
              FILTER (WHERE status = 'completed' AND completed_at IS NOT NULL),
            0
          )::float AS average_duration_seconds,
          COALESCE(
            PERCENTILE_CONT(0.95) WITHIN GROUP (
              ORDER BY EXTRACT(EPOCH FROM (completed_at - created_at))
            ) FILTER (WHERE status = 'completed' AND completed_at IS NOT NULL),
            0
          )::float AS p95_duration_seconds
        FROM pdf_translation_v2_jobs
        WHERE created_at >= ${startDate}
      `,
      esgPrisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT
          COUNT(p.id)::bigint AS page_records,
          COALESCE(SUM(p.input_tokens), 0)::bigint AS input_tokens,
          COALESCE(SUM(p.output_tokens), 0)::bigint AS output_tokens,
          COALESCE(SUM(p.extraction_attempts), 0)::bigint AS extraction_attempts,
          COALESCE(SUM(p.translation_attempts), 0)::bigint AS translation_attempts
        FROM pdf_translation_v2_pages p
        JOIN pdf_translation_v2_jobs j ON j.id = p.job_id
        WHERE j.created_at >= ${startDate}
      `,
      esgPrisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT
          COUNT(*)::bigint AS total_jobs,
          COUNT(DISTINCT user_id)::bigint AS unique_users,
          COALESCE(SUM(total_pages), 0)::bigint AS total_pages,
          COALESCE((SELECT SUM(input_tokens + output_tokens) FROM pdf_translation_v2_pages), 0)::bigint AS total_tokens
        FROM pdf_translation_v2_jobs
      `,
      esgPrisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT status, COUNT(*)::bigint AS jobs
        FROM pdf_translation_v2_jobs
        WHERE created_at >= ${startDate}
        GROUP BY status
        ORDER BY jobs DESC, status
      `,
      esgPrisma.$queryRaw<Array<Record<string, unknown>>>`
        WITH page_usage AS (
          SELECT job_id, SUM(input_tokens + output_tokens)::bigint AS tokens
          FROM pdf_translation_v2_pages
          GROUP BY job_id
        )
        SELECT
          j.target_lang AS language,
          COUNT(*)::bigint AS jobs,
          COALESCE(SUM(j.total_pages), 0)::bigint AS pages,
          COALESCE(SUM(page_usage.tokens), 0)::bigint AS tokens
        FROM pdf_translation_v2_jobs j
        LEFT JOIN page_usage ON page_usage.job_id = j.id
        WHERE j.created_at >= ${startDate}
        GROUP BY j.target_lang
        ORDER BY jobs DESC, language
      `,
      esgPrisma.$queryRaw<Array<Record<string, unknown>>>`
        WITH page_usage AS (
          SELECT job_id, SUM(input_tokens + output_tokens)::bigint AS tokens
          FROM pdf_translation_v2_pages
          GROUP BY job_id
        )
        SELECT
          DATE_TRUNC('day', j.created_at)::date AS date,
          COUNT(*)::bigint AS jobs,
          COUNT(*) FILTER (WHERE j.status = 'completed')::bigint AS completed,
          COUNT(*) FILTER (WHERE j.status = 'error')::bigint AS failed,
          COALESCE(SUM(j.total_pages), 0)::bigint AS pages,
          COALESCE(SUM(page_usage.tokens), 0)::bigint AS tokens
        FROM pdf_translation_v2_jobs j
        LEFT JOIN page_usage ON page_usage.job_id = j.id
        WHERE j.created_at >= ${startDate}
        GROUP BY DATE_TRUNC('day', j.created_at)
        ORDER BY date ASC
      `,
      esgPrisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT role, model, COUNT(*)::bigint AS pages, SUM(attempts)::bigint AS attempts
        FROM (
          SELECT 'Extraction'::text AS role, extraction_model AS model,
                 extraction_attempts AS attempts
          FROM pdf_translation_v2_pages p
          JOIN pdf_translation_v2_jobs j ON j.id = p.job_id
          WHERE j.created_at >= ${startDate} AND extraction_model IS NOT NULL
          UNION ALL
          SELECT 'Translation'::text AS role, translation_model AS model,
                 translation_attempts AS attempts
          FROM pdf_translation_v2_pages p
          JOIN pdf_translation_v2_jobs j ON j.id = p.job_id
          WHERE j.created_at >= ${startDate} AND translation_model IS NOT NULL
        ) model_usage
        GROUP BY role, model
        ORDER BY role, pages DESC, model
      `,
      esgPrisma.$queryRaw<Array<Record<string, unknown>>>`
        WITH page_usage AS (
          SELECT job_id,
                 SUM(input_tokens)::bigint AS input_tokens,
                 SUM(output_tokens)::bigint AS output_tokens
          FROM pdf_translation_v2_pages
          GROUP BY job_id
        )
        SELECT
          u.id AS user_id,
          COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.email, u.username) AS name,
          u.email,
          u.team,
          COUNT(j.id)::bigint AS jobs,
          COUNT(j.id) FILTER (WHERE j.status = 'completed')::bigint AS completed,
          COUNT(j.id) FILTER (WHERE j.status = 'error')::bigint AS failed,
          COALESCE(SUM(j.total_pages), 0)::bigint AS pages,
          COALESCE(SUM(page_usage.input_tokens), 0)::bigint AS input_tokens,
          COALESCE(SUM(page_usage.output_tokens), 0)::bigint AS output_tokens,
          MAX(j.created_at) AS last_used_at
        FROM pdf_translation_v2_jobs j
        JOIN users u ON u.id = j.user_id
        LEFT JOIN page_usage ON page_usage.job_id = j.id
        WHERE j.created_at >= ${startDate}
        GROUP BY u.id, u.first_name, u.last_name, u.email, u.username, u.team
        ORDER BY jobs DESC, pages DESC, last_used_at DESC
        LIMIT 15
      `,
      esgPrisma.$queryRaw<Array<Record<string, unknown>>>`
        WITH page_usage AS (
          SELECT job_id,
                 SUM(input_tokens)::bigint AS input_tokens,
                 SUM(output_tokens)::bigint AS output_tokens
          FROM pdf_translation_v2_pages
          GROUP BY job_id
        )
        SELECT
          j.id,
          j.filename,
          j.target_lang,
          j.status,
          j.stage,
          j.progress,
          j.total_pages,
          j.created_at,
          j.completed_at,
          j.message,
          COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.email, u.username) AS user_name,
          u.email AS user_email,
          COALESCE(page_usage.input_tokens, 0)::bigint AS input_tokens,
          COALESCE(page_usage.output_tokens, 0)::bigint AS output_tokens
        FROM pdf_translation_v2_jobs j
        JOIN users u ON u.id = j.user_id
        LEFT JOIN page_usage ON page_usage.job_id = j.id
        WHERE j.created_at >= ${startDate}
        ORDER BY j.created_at DESC
        LIMIT 30
      `,
    ]);

    const overview = overviewRows[0] ?? {};
    const tokens = tokenRows[0] ?? {};
    const lifetime = lifetimeRows[0] ?? {};
    const totalJobs = numberValue(overview.total_jobs);
    const completedJobs = numberValue(overview.completed_jobs);
    const failedJobs = numberValue(overview.failed_jobs);
    const terminalJobs = completedJobs + failedJobs;
    const totalPages = numberValue(overview.total_pages);
    const totalTokens = numberValue(tokens.input_tokens) + numberValue(tokens.output_tokens);

    const response = NextResponse.json({
      success: true,
      period: {
        value: period,
        startDate: period === 'all' ? null : startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      overview: {
        totalJobs,
        completedJobs,
        failedJobs,
        cancelledJobs: numberValue(overview.cancelled_jobs),
        activeJobs: numberValue(overview.active_jobs),
        uniqueUsers: numberValue(overview.unique_users),
        totalPages,
        inputTokens: numberValue(tokens.input_tokens),
        outputTokens: numberValue(tokens.output_tokens),
        totalTokens,
        uploadedBytes: numberValue(overview.uploaded_bytes),
        outputBytes: numberValue(overview.output_bytes),
        extractionAttempts: numberValue(tokens.extraction_attempts),
        translationAttempts: numberValue(tokens.translation_attempts),
        successRate: terminalJobs > 0 ? completedJobs / terminalJobs : 0,
        averagePagesPerJob: totalJobs > 0 ? totalPages / totalJobs : 0,
        averageTokensPerPage: totalPages > 0 ? totalTokens / totalPages : 0,
        averageDurationSeconds: numberValue(overview.average_duration_seconds),
        p95DurationSeconds: numberValue(overview.p95_duration_seconds),
      },
      lifetime: {
        totalJobs: numberValue(lifetime.total_jobs),
        uniqueUsers: numberValue(lifetime.unique_users),
        totalPages: numberValue(lifetime.total_pages),
        totalTokens: numberValue(lifetime.total_tokens),
      },
      statusBreakdown: statusRows.map((row) => ({
        status: String(row.status ?? 'unknown'),
        jobs: numberValue(row.jobs),
      })),
      languageBreakdown: languageRows.map((row) => ({
        language: String(row.language ?? 'Unknown'),
        jobs: numberValue(row.jobs),
        pages: numberValue(row.pages),
        tokens: numberValue(row.tokens),
      })),
      dailyTrend: dailyRows.map((row) => ({
        date: row.date instanceof Date
          ? row.date.toISOString().slice(0, 10)
          : String(row.date).slice(0, 10),
        jobs: numberValue(row.jobs),
        completed: numberValue(row.completed),
        failed: numberValue(row.failed),
        pages: numberValue(row.pages),
        tokens: numberValue(row.tokens),
      })),
      modelBreakdown: modelRows.map((row) => ({
        role: String(row.role),
        model: String(row.model),
        pages: numberValue(row.pages),
        attempts: numberValue(row.attempts),
      })),
      topUsers: topUserRows.map((row) => ({
        userId: numberValue(row.user_id),
        name: String(row.name ?? 'Unknown'),
        email: row.email ? String(row.email) : null,
        team: row.team ? String(row.team) : null,
        jobs: numberValue(row.jobs),
        completed: numberValue(row.completed),
        failed: numberValue(row.failed),
        pages: numberValue(row.pages),
        inputTokens: numberValue(row.input_tokens),
        outputTokens: numberValue(row.output_tokens),
        lastUsedAt: row.last_used_at instanceof Date
          ? row.last_used_at.toISOString()
          : String(row.last_used_at),
      })),
      recentJobs: recentJobRows.map((row) => ({
        id: String(row.id),
        filename: String(row.filename),
        targetLanguage: String(row.target_lang),
        status: String(row.status),
        stage: String(row.stage),
        progress: numberValue(row.progress),
        totalPages: numberValue(row.total_pages),
        createdAt: row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
        completedAt: row.completed_at instanceof Date
          ? row.completed_at.toISOString()
          : row.completed_at ? String(row.completed_at) : null,
        message: row.message ? String(row.message) : null,
        userName: String(row.user_name ?? 'Unknown'),
        userEmail: row.user_email ? String(row.user_email) : null,
        inputTokens: numberValue(row.input_tokens),
        outputTokens: numberValue(row.output_tokens),
      })),
    });
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch (error) {
    console.error('[Admin PDF Translator Stats] Failed to load analytics', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load PDF Translator analytics' },
      { status: 500 },
    );
  }
}
