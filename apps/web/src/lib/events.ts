// server-only
import { getPrisma } from "@/lib/db";

export type Domain = "esg" | "credit";

export type EventRow = {
  id: number | string;
  title?: string;            // credit
  date?: string;             // credit
  location?: string;         // credit
  details?: string;          // credit
  link?: string;             // credit
  source?: string;           // credit

  // ESG fields
  event_id?: string;
  event_name?: string;
  event_url?: string;
  start_date?: string | null;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  timezone?: string | null;
  image_url?: string | null;
  ticket_price?: string | null;
  tickets_url?: string | null;
  venue_name?: string | null;
  venue_address?: string | null;
  organizer_name?: string | null;
  organizer_url?: string | null;
  summary?: string | null;
  tags?: string | null;
};

export type ListArgs = {
  domain: Domain;
  page?: number;         // 1-based
  pageSize?: number;     // default 20
  from?: string;         // YYYY-MM-DD, defaults to today in Dubai timezone
  q?: string;            // optional search term for text fields only
};

const todayInDubai = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(new Date()); // YYYY-MM-DD

export async function listEvents({ domain, page = 1, pageSize = 20, from, q }: ListArgs) {
  const offset = (page - 1) * pageSize;
  const start = from ?? todayInDubai();
  const term = q?.trim();

  const prisma = getPrisma(domain);

  if (domain === "credit") {
    // CREDIT: table "events" with a single "date" column (date)
    if (term) {
      const rows = await prisma.$queryRaw<EventRow[]>`
        SELECT id, title, date, location, details, link, source, created_at
        FROM events
        WHERE date >= ${start}::date
          AND (
            title ILIKE ${"%" + term + "%"} OR
            COALESCE(location, '') ILIKE ${"%" + term + "%"} OR
            COALESCE(details, '') ILIKE ${"%" + term + "%"} OR
            COALESCE(source, '') ILIKE ${"%" + term + "%"}
          )
        ORDER BY date ASC, id ASC
        LIMIT ${pageSize} OFFSET ${offset}
      `;
      const [{ count }] = await prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS count
        FROM events
        WHERE date >= ${start}::date
          AND (
            title ILIKE ${"%" + term + "%"} OR
            COALESCE(location, '') ILIKE ${"%" + term + "%"} OR
            COALESCE(details, '') ILIKE ${"%" + term + "%"} OR
            COALESCE(source, '') ILIKE ${"%" + term + "%"}
          )
      `;
      return { rows, total: count, from: start };
    } else {
      const rows = await prisma.$queryRaw<EventRow[]>`
        SELECT id, title, date, location, details, link, source, created_at
        FROM events
        WHERE date >= ${start}::date
        ORDER BY date ASC, id ASC
        LIMIT ${pageSize} OFFSET ${offset}
      `;
      const [{ count }] = await prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS count
        FROM events
        WHERE date >= ${start}::date
      `;
      return { rows, total: count, from: start };
    }
  }

  // ESG: table "events" with start_date/end_date (date), text meta columns
  if (term) {
    const rows = await prisma.$queryRaw<EventRow[]>`
      SELECT id, event_id, event_name, event_url, start_date, end_date, start_time, end_time,
             timezone, image_url, ticket_price, tickets_url, venue_name, venue_address,
             organizer_name, organizer_url, summary, tags, source, month
      FROM events
      WHERE (
        (end_date IS NOT NULL AND end_date >= ${start}::date) OR
        (end_date IS NULL AND start_date >= ${start}::date)
      )
      AND (
        COALESCE(event_name, '') ILIKE ${"%" + term + "%"} OR
        COALESCE(venue_name, '') ILIKE ${"%" + term + "%"} OR
        COALESCE(organizer_name, '') ILIKE ${"%" + term + "%"} OR
        COALESCE(summary, '') ILIKE ${"%" + term + "%"} OR
        COALESCE(tags, '') ILIKE ${"%" + term + "%"} OR
        COALESCE(source, '') ILIKE ${"%" + term + "%"}
      )
      ORDER BY COALESCE(start_date, end_date) ASC, id ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `;
    const [{ count }] = await prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM events
      WHERE (
        (end_date IS NOT NULL AND end_date >= ${start}::date) OR
        (end_date IS NULL AND start_date >= ${start}::date)
      )
      AND (
        COALESCE(event_name, '') ILIKE ${"%" + term + "%"} OR
        COALESCE(venue_name, '') ILIKE ${"%" + term + "%"} OR
        COALESCE(organizer_name, '') ILIKE ${"%" + term + "%"} OR
        COALESCE(summary, '') ILIKE ${"%" + term + "%"} OR
        COALESCE(tags, '') ILIKE ${"%" + term + "%"} OR
        COALESCE(source, '') ILIKE ${"%" + term + "%"}
      )
    `;
    return { rows, total: count, from: start };
  } else {
    const rows = await prisma.$queryRaw<EventRow[]>`
      SELECT id, event_id, event_name, event_url, start_date, end_date, start_time, end_time,
             timezone, image_url, ticket_price, tickets_url, venue_name, venue_address,
             organizer_name, organizer_url, summary, tags, source, month
      FROM events
      WHERE (
        (end_date IS NOT NULL AND end_date >= ${start}::date) OR
        (end_date IS NULL AND start_date >= ${start}::date)
      )
      ORDER BY COALESCE(start_date, end_date) ASC, id ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `;
    const [{ count }] = await prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM events
      WHERE (
        (end_date IS NOT NULL AND end_date >= ${start}::date) OR
        (end_date IS NULL AND start_date >= ${start}::date)
      )
    `;
    return { rows, total: count, from: start };
  }
}

// Legacy compatibility - keeping for existing components
export interface EventListItem {
  id: number;
  title: string;
  source?: string | null;
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

export async function getEventSources(domain: "esg" | "credit"): Promise<string[]> {
  const prisma = getPrisma(domain);
  const sources = await prisma.$queryRaw<{ source: string }[]>`
    SELECT DISTINCT source 
    FROM events 
    WHERE source IS NOT NULL 
    ORDER BY source ASC
  `;
  return sources.map((s: { source: string }) => s.source);
}

// Convert EventRow to EventListItem for compatibility
export function eventRowToListItem(row: EventRow): EventListItem {
  // Helper function to convert Date objects to ISO date strings
  const formatDate = (date: any): string | null => {
    if (!date) return null;
    if (date instanceof Date) {
      return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    }
    if (typeof date === 'string') {
      // If it's already a string, ensure it's in the correct format
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    }
    return String(date); // Fallback to string conversion
  };

  return {
    id: Number(row.id),
    title: row.event_name || row.title || 'Untitled Event',
    source: row.source || null,
    start_date: formatDate(row.start_date || row.date),
    end_date: formatDate(row.end_date),
    start_time: row.start_time || null,
    end_time: row.end_time || null,
    timezone: row.timezone || null,
    location: row.venue_address || row.location || null,
    organizer: row.organizer_name || null,
    summary: row.summary || row.details || null,
    url: row.event_url || row.link || null,
    tickets_url: row.tickets_url || null,
    image_url: row.image_url || null,
  };
}

export async function getEventById(
  domain: "esg" | "credit",
  id: string | number
): Promise<EventListItem | null> {
  const numericId = Number(id);
  const prisma = getPrisma(domain);

  if (domain === "esg") {
    const rows = await prisma.$queryRaw<EventListItem[]>`
      SELECT 
        id,
        event_name as title,
        source,
        start_date,
        end_date,
        start_time,
        end_time,
        timezone,
        venue_address as location,
        organizer_name as organizer,
        summary,
        event_url as url,
        tickets_url,
        image_url
      FROM events
      WHERE id = ${numericId}
      LIMIT 1
    `;
    
    return rows[0] || null;
  } else {
    const rows = await prisma.$queryRaw<EventListItem[]>`
      SELECT 
        id,
        title,
        source,
        date as start_date,
        NULL as end_date,
        NULL as start_time,
        NULL as end_time,
        NULL as timezone,
        location,
        NULL as organizer,
        details as summary,
        link as url,
        NULL as tickets_url,
        NULL as image_url
      FROM events
      WHERE id = ${numericId}
      LIMIT 1
    `;
    
    return rows[0] || null;
  }
}