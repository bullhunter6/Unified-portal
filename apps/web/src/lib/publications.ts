// src/lib/publications.ts
import { creditPrisma } from "@esgcredit/db-credit";
import { esgPrisma } from "@esgcredit/db-esg";

export type Publication = {
  id: number | string;
  title: string;
  link: string | null;
  image_url: string | null;
  source: string | null;
  published: string | null;   // ISO string (date/published/save_time)
  summary: string | null;     // description | summary
};

function isoOrNull(v: any): string | null {
  if (!v) return null;
  try { return new Date(v).toISOString(); } catch { return null; }
}

function normalizeCredit(row: any): Publication {
  // credit: id, title, date, description, link, image_url, source, created_at
  return {
    id: row.id,
    title: row.title ?? "Untitled",
    link: row.link ?? null,
    image_url: row.image_url ?? null,
    source: row.source ?? null,
    // use date, else created_at for ordering/fallback
    published: isoOrNull(row.date ?? row.created_at),
    summary: row.description ?? null,
  };
}

function normalizeEsg(row: any): Publication {
  // esg: id, title, published, summary, link, image_url, source, save_time
  return {
    id: row.id,
    title: row.title ?? "Untitled",
    link: row.link ?? null,
    image_url: row.image_url ?? null,
    source: row.source ?? null,
    published: isoOrNull(row.published ?? row.save_time),
    summary: row.summary ?? null,
  };
}

export async function listPublications({
  domain,
  page = 1,
  pageSize = 24,
}: {
  domain: "credit" | "esg";
  page?: number;
  pageSize?: number;
}) {
  const offset = (page - 1) * pageSize;

  if (domain === "credit") {
    const rows: any[] = await creditPrisma.$queryRaw<
      any[]
    >`SELECT id, title, date, description, link, image_url, source, created_at
       FROM publications
       ORDER BY COALESCE(date, created_at) DESC NULLS LAST, id DESC
       LIMIT ${pageSize} OFFSET ${offset}`;

    const [{ count }] = await creditPrisma.$queryRaw<{ count: number }[]>
    `SELECT COUNT(*)::int AS count FROM publications`;

    return {
      items: rows.map(normalizeCredit),
      total: Number(count),
      page,
      pageSize,
    };
  }

  // ESG
  const rows: any[] = await esgPrisma.$queryRaw<
    any[]
  >`SELECT id, title, published, summary, link, image_url, source, save_time
     FROM publications
     ORDER BY COALESCE(published, save_time) DESC NULLS LAST, id DESC
     LIMIT ${pageSize} OFFSET ${offset}`;

  const [{ count }] = await esgPrisma.$queryRaw<{ count: number }[]>
  `SELECT COUNT(*)::int AS count FROM publications`;

  return {
    items: rows.map(normalizeEsg),
    total: Number(count),
    page,
    pageSize,
  };
}