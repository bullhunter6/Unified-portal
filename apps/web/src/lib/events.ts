import "server-only";

import { creditPrisma } from "@esgcredit/db-credit";

/**
 * Legacy Credit Events adapter.
 *
 * ESG events intentionally live in `@/lib/esg-events`; keeping this adapter
 * Credit-only prevents the ESG discovery contract from reintroducing the old
 * duplicated query matrix.
 */
export type Domain = "credit";

export type EventRow = {
  id: number | string;
  title?: string | null;
  date?: string | Date | null;
  location?: string | null;
  details?: string | null;
  link?: string | null;
  source?: string | null;
};

export type ListArgs = {
  domain: Domain;
  page?: number;
  pageSize?: number;
  from?: string;
  q?: string;
  source?: string;
  dateRange?: string;
};

export interface EventListItem {
  id: number;
  title: string;
  source?: string | null;
  date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  timezone?: string | null;
  location?: string | null;
  organizer?: string | null;
  summary?: string | null;
  url?: string | null;
  tickets_url?: string | null;
  image_url?: string | null;
}

function todayInDubai(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(new Date());
}

function getDateRange(dateRange?: string): {
  fromDate: string;
  toDate: string | null;
  isPast: boolean;
} {
  const today = new Date();
  const todayString = todayInDubai();

  switch (dateRange) {
    case "past": {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        fromDate: "1970-01-01",
        toDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(yesterday),
        isPast: true,
      };
    }
    case "this-week": {
      const endOfWeek = new Date(today);
      const daysUntilSunday = 7 - today.getDay();
      endOfWeek.setDate(today.getDate() + daysUntilSunday);
      return {
        fromDate: todayString,
        toDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(endOfWeek),
        isPast: false,
      };
    }
    case "this-month": {
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return {
        fromDate: todayString,
        toDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(endOfMonth),
        isPast: false,
      };
    }
    default:
      return { fromDate: todayString, toDate: null, isPast: false };
  }
}

export async function listEvents({
  domain: _domain,
  page = 1,
  pageSize = 20,
  from,
  q,
  source,
  dateRange,
}: ListArgs) {
  const offset = (page - 1) * pageSize;
  const { fromDate, toDate, isPast } = getDateRange(dateRange);
  const start = from ?? fromDate;
  const term = q?.trim();
  const sourceFilter = source?.trim();
  const conditions: string[] = [];
  const values: Array<string | number> = [];
  const parameter = (value: string | number, cast = "text") => {
    values.push(value);
    return `$${values.length}::${cast}`;
  };

  if (isPast) {
    conditions.push(`date <= ${parameter(toDate ?? start, "date")}`);
  } else if (toDate) {
    conditions.push(
      `date >= ${parameter(start, "date")} AND date <= ${parameter(toDate, "date")}`,
    );
  } else {
    conditions.push(`date >= ${parameter(start, "date")}`);
  }

  if (sourceFilter) conditions.push(`source = ${parameter(sourceFilter)}`);
  if (term) {
    const pattern = parameter(`%${term}%`);
    conditions.push(sourceFilter
      ? `(
          title ILIKE ${pattern}
          OR COALESCE(location, '') ILIKE ${pattern}
          OR COALESCE(details, '') ILIKE ${pattern}
        )`
      : `(
          title ILIKE ${pattern}
          OR COALESCE(location, '') ILIKE ${pattern}
          OR COALESCE(details, '') ILIKE ${pattern}
          OR COALESCE(source, '') ILIKE ${pattern}
        )`);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const order = isPast ? "date DESC, id DESC" : "date ASC, id ASC";
  const rowValues = [...values, pageSize, offset];
  const limit = `$${values.length + 1}::int`;
  const rowOffset = `$${values.length + 2}::int`;
  const [rows, countRows] = await Promise.all([
    creditPrisma.$queryRawUnsafe<EventRow[]>(`
      SELECT id, title, date, location, details, link, source, created_at
      FROM events
      ${where}
      ORDER BY ${order}
      LIMIT ${limit} OFFSET ${rowOffset}
    `, ...rowValues),
    creditPrisma.$queryRawUnsafe<Array<{ count: number }>>(`
      SELECT COUNT(*)::int AS count
      FROM events
      ${where}
    `, ...values),
  ]);

  return { rows, total: countRows[0]?.count ?? 0, from: start };
}

export async function getEventSources(_domain: Domain): Promise<string[]> {
  const sources = await creditPrisma.$queryRawUnsafe<Array<{ source: string }>>(`
    SELECT DISTINCT source
    FROM events
    WHERE source IS NOT NULL
    ORDER BY source ASC
  `);
  return sources.map((source) => source.source);
}

function formatDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return String(value);
}

function fixEventUrl(value: string | null | undefined): string | null {
  return value?.replace("events.fitchratings.com/events/", "events.fitchratings.com/") ?? null;
}

export function eventRowToListItem(row: EventRow): EventListItem {
  return {
    id: Number(row.id),
    title: row.title || "Untitled Event",
    source: row.source ?? null,
    start_date: formatDate(row.date),
    end_date: null,
    start_time: null,
    end_time: null,
    timezone: null,
    location: row.location ?? null,
    organizer: null,
    summary: row.details ?? null,
    url: fixEventUrl(row.link),
    tickets_url: null,
    image_url: null,
  };
}

export async function getEventById(
  _domain: Domain,
  id: string | number,
): Promise<EventListItem | null> {
  const numericId = Number(id);
  const rows = await creditPrisma.$queryRawUnsafe<EventListItem[]>(`
    SELECT
      id,
      title,
      source,
      date AS start_date,
      NULL AS end_date,
      NULL AS start_time,
      NULL AS end_time,
      NULL AS timezone,
      location,
      NULL AS organizer,
      details AS summary,
      link AS url,
      NULL AS tickets_url,
      NULL AS image_url
    FROM events
    WHERE id = $1::int
    LIMIT 1
  `, numericId);
  const event = rows[0] ?? null;
  if (event) event.url = fixEventUrl(event.url);
  return event;
}
