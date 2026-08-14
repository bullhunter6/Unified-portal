import "server-only";

import { esgPrisma } from "@esgcredit/db-esg";
import { env } from "@/lib/config/env";
import { addCalendarDays, isValidDateString } from "./dates";
import { listEsgEventDigestRecipients } from "./digest-recipients";
import { getEsgWeeklyDigestWindow, isEsgWeeklyDigestDue } from "./weekly-digest-dates";

export const ESG_EVENT_DIGEST_DELIVERY_PAGE_SIZE = 20;
export const ESG_EVENT_DIGEST_DELIVERY_STATUSES = [
  "queued",
  "processing",
  "sent",
  "failed",
] as const;
export const ESG_EVENT_DIGEST_DELIVERY_MODES = ["production", "test"] as const;

export type EsgEventDigestDeliveryStatus = typeof ESG_EVENT_DIGEST_DELIVERY_STATUSES[number];
export type EsgEventDigestDeliveryMode = typeof ESG_EVENT_DIGEST_DELIVERY_MODES[number];
export type EsgEventDigestDeliveryFilters = {
  page: number;
  status?: EsgEventDigestDeliveryStatus;
  mode?: EsgEventDigestDeliveryMode;
  recipient?: string;
};
export type EsgEventDigestDeliveryDto = {
  id: number;
  recipient: string;
  weekStart: string | null;
  mode: EsgEventDigestDeliveryMode;
  eventCount: number;
  status: EsgEventDigestDeliveryStatus;
  attempts: number;
  createdAt: string;
  sentAt: string | null;
  lastAttemptAt: string | null;
  error: string | null;
};
export type EsgEventDigestAdminSnapshot = {
  recipients: Awaited<ReturnType<typeof listEsgEventDigestRecipients>>;
  deliveries: ReadonlyArray<EsgEventDigestDeliveryDto>;
  totalDeliveries: number;
  totalPages: number;
  activeRecipients: number;
  successfulLast30Days: number;
  attemptedLast30Days: number;
  lastProductionSentAt: string | null;
  testRecipient: string | null;
  scheduleEnabled: boolean;
};

type DeliveryRow = {
  id: number;
  email_to: string;
  total_items: number | null;
  email_status: string | null;
  created_at: Date;
  sent_at: Date | null;
  job_id: string | null;
  queue_status: string | null;
  attempts: number | null;
  retry_count: number | null;
  last_attempt_at: Date | null;
  last_error: string | null;
  error_message: string | null;
};

const DELIVERY_STATUS_SQL = `CASE
  WHEN q.status IN ('queued', 'processing', 'sent', 'failed') THEN q.status
  WHEN h.email_status = 'sent' THEN 'sent'
  WHEN h.email_status = 'failed' THEN 'failed'
  ELSE 'queued'
END`;

function addValue(values: Array<string | number>, value: string | number, cast: string): string {
  values.push(value);
  return `$${values.length}::${cast}`;
}

function deliveryClauses(filters: EsgEventDigestDeliveryFilters, values: Array<string | number>): string[] {
  const clauses = [
    "h.domain = 'esg'",
    "h.alert_type = 'esg_events_weekly'",
    "h.content_type = 'event_digest'",
  ];
  if (filters.status) {
    clauses.push(`${DELIVERY_STATUS_SQL} = ${addValue(values, filters.status, "text")}`);
  }
  if (filters.mode === "test") clauses.push("h.job_id LIKE 'test:esg-events-week:%'");
  if (filters.mode === "production") clauses.push("h.job_id LIKE 'esg-events-week:%'");
  if (filters.recipient) {
    clauses.push(`h.email_to ILIKE ${addValue(values, `%${filters.recipient.replace(/[\\%_]/g, "\\$&")}%`, "text")} ESCAPE '\\'`);
  }
  return clauses;
}

function parseWeekStart(jobId: string | null): string | null {
  const match = /(?:^test:)?esg-events-week:(\d{4}-\d{2}-\d{2})$/.exec(jobId ?? "");
  return match && isValidDateString(match[1]) ? match[1] : null;
}

function deliveryMode(jobId: string | null): EsgEventDigestDeliveryMode {
  return jobId?.startsWith("test:") ? "test" : "production";
}

function deliveryStatus(row: DeliveryRow): EsgEventDigestDeliveryStatus {
  const value = row.queue_status ?? row.email_status ?? "queued";
  return ESG_EVENT_DIGEST_DELIVERY_STATUSES.includes(value as EsgEventDigestDeliveryStatus)
    ? value as EsgEventDigestDeliveryStatus
    : "queued";
}

export async function loadEsgEventDigestAdminSnapshot(
  filters: EsgEventDigestDeliveryFilters,
): Promise<EsgEventDigestAdminSnapshot> {
  const values: Array<string | number> = [];
  const where = deliveryClauses(filters, values).join(" AND ");
  const filterValues = [...values];
  const limit = addValue(values, ESG_EVENT_DIGEST_DELIVERY_PAGE_SIZE, "int");
  const offset = addValue(values, (filters.page - 1) * ESG_EVENT_DIGEST_DELIVERY_PAGE_SIZE, "int");

  const [recipients, rows, countRows, metricsRows] = await Promise.all([
    listEsgEventDigestRecipients(),
    esgPrisma.$queryRawUnsafe<DeliveryRow[]>(`
      SELECT h.id, h.email_to, h.total_items, h.email_status, h.created_at,
        h.sent_at, h.job_id, h.retry_count, h.error_message,
        q.status AS queue_status, q.attempts, q.last_attempt_at, q.last_error
      FROM alert_history h
      LEFT JOIN email_queue q ON q.alert_history_id = h.id
      WHERE ${where}
      ORDER BY h.created_at DESC, h.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `, ...values),
    esgPrisma.$queryRawUnsafe<Array<{ count: number }>>(`
      SELECT COUNT(*)::int AS count
      FROM alert_history h
      LEFT JOIN email_queue q ON q.alert_history_id = h.id
      WHERE ${where}
    `, ...filterValues),
    esgPrisma.$queryRaw<Array<{
      attempted_30d: number;
      sent_30d: number;
      last_production_sent_at: Date | null;
    }>>`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS attempted_30d,
        COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days' AND email_status = 'sent')::int AS sent_30d,
        MAX(sent_at) FILTER (WHERE job_id LIKE 'esg-events-week:%') AS last_production_sent_at
      FROM alert_history
      WHERE domain = 'esg' AND alert_type = 'esg_events_weekly' AND content_type = 'event_digest'
    `,
  ]);
  const total = countRows[0]?.count ?? 0;
  const metrics = metricsRows[0];
  return {
    recipients,
    deliveries: rows.map((row) => ({
      id: row.id,
      recipient: row.email_to,
      weekStart: parseWeekStart(row.job_id),
      mode: deliveryMode(row.job_id),
      eventCount: row.total_items ?? 0,
      status: deliveryStatus(row),
      attempts: row.attempts ?? row.retry_count ?? 0,
      createdAt: row.created_at.toISOString(),
      sentAt: row.sent_at?.toISOString() ?? null,
      lastAttemptAt: row.last_attempt_at?.toISOString() ?? null,
      error: (row.last_error ?? row.error_message)?.slice(0, 500) ?? null,
    })),
    totalDeliveries: total,
    totalPages: Math.max(1, Math.ceil(total / ESG_EVENT_DIGEST_DELIVERY_PAGE_SIZE)),
    activeRecipients: recipients.filter((recipient) => recipient.isActive).length,
    successfulLast30Days: metrics?.sent_30d ?? 0,
    attemptedLast30Days: metrics?.attempted_30d ?? 0,
    lastProductionSentAt: metrics?.last_production_sent_at?.toISOString() ?? null,
    testRecipient: env.ESG_EVENTS_DIGEST_TEST_RECIPIENT?.trim().toLocaleLowerCase("en") ?? null,
    scheduleEnabled: env.ESG_EVENTS_DIGEST_ENABLED?.trim().toLocaleLowerCase("en") === "true",
  };
}

export function getNextDigestRunLabel(now = new Date()): { date: string; iso: string } {
  const current = getEsgWeeklyDigestWindow(now);
  const weekStart = isEsgWeeklyDigestDue(now)
    ? addCalendarDays(current.weekStart, 7)
    : current.weekStart;
  const instant = new Date(`${weekStart}T05:00:00.000Z`);
  return { date: weekStart, iso: instant.toISOString() };
}
