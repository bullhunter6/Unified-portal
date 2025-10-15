import { getPrisma, Domain } from "@/lib/db";
import { listArticles } from "@/lib/articles";

function ymd(d: Date) {
  const m = d.getMonth() + 1, day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? "0"+m : m}-${day < 10 ? "0"+day : day}`;
}

export async function getHomeArticles(domain: Domain, limit = 6) {
  const today = ymd(new Date());
  let result = await listArticles({ domain, date: today, pageSize: limit });
  if (result.rows.length === 0) {
    // If no articles today, get recent articles without date filter
    result = await listArticles({ domain, pageSize: limit });
  }
  // Serialize dates to prevent React rendering errors
  return JSON.parse(JSON.stringify(result.rows));
}

export async function getFreshCount(domain: Domain): Promise<number> {
  const prisma = getPrisma(domain);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  if (domain === "esg") {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM esg_articles
      WHERE COALESCE(published, save_time) BETWEEN ${start} AND ${end};
    `;
    return rows[0]?.count ?? 0;
  } else {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM credit_articles
      WHERE date BETWEEN ${start} AND ${end};
    `;
    return rows[0]?.count ?? 0;
  }
}

export async function getRecentSources(domain: Domain): Promise<number> {
  const prisma = getPrisma(domain);
  const from = new Date();
  from.setDate(from.getDate() - 14);

  if (domain === "esg") {
    const rows = await prisma.$queryRaw<{ cnt: number }[]>`
      SELECT COUNT(DISTINCT source)::int AS cnt
      FROM esg_articles
      WHERE source IS NOT NULL
        AND COALESCE(published, save_time) >= ${from};
    `;
    return rows[0]?.cnt ?? 0;
  } else {
    const rows = await prisma.$queryRaw<{ cnt: number }[]>`
      SELECT COUNT(DISTINCT source)::int AS cnt
      FROM credit_articles
      WHERE source IS NOT NULL
        AND date >= ${from};
    `;
    return rows[0]?.cnt ?? 0;
  }
}