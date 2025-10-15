import { getPrisma, Domain } from "@/lib/db";
import { esgPrisma } from "@esgcredit/db-esg";

/** Count likes for a set of content ids */
export async function getLikeCounts(
  domain: Domain,
  contentType: "article" | "event" | "publication",
  ids: number[]
): Promise<Record<number, number>> {
  if (ids.length === 0) return {};
  const prisma = getPrisma(domain);
  const rows = await prisma.$queryRaw<{ content_id: number; c: number }[]>`
    SELECT content_id, COUNT(*)::int AS c
    FROM likes
    WHERE content_type = ${contentType}
      AND content_id = ANY(${ids})
    GROUP BY content_id;
  `;
  const map: Record<number, number> = {};
  for (const r of rows) map[r.content_id] = r.c;
  return map;
}

/** Which of the ids are liked by this user */
export async function getUserLikedSet(
  domain: Domain,
  userId: number,
  contentType: "article" | "event" | "publication",
  ids: number[]
): Promise<Set<number>> {
  if (!userId || ids.length === 0) return new Set();
  const prisma = getPrisma(domain);
  const rows = await prisma.$queryRaw<{ content_id: number }[]>`
    SELECT content_id
    FROM likes
    WHERE user_id = ${userId}
      AND content_type = ${contentType}
      AND content_id = ANY(${ids});
  `;
  return new Set(rows.map(r => r.content_id));
}

export async function getLikers(
  domain: Domain,
  contentType: "article" | "event" | "publication",
  contentId: number
): Promise<{ id: number; name: string; email: string }[]> {
  if (!Number.isFinite(contentId)) return [];

  if (domain === "esg") {
    const prisma = getPrisma("esg");
    const rows = await prisma.$queryRaw<{ id: number; display_name: string; email: string | null }[]>`
      SELECT DISTINCT ON (u.id)
             u.id,
             COALESCE(
               NULLIF(BTRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), ''),
               NULLIF(u.username, ''),
               NULLIF(split_part(COALESCE(u.email,''), '@', 1), ''),
               NULLIF(u.email, ''),
               'User'
             ) AS display_name,
             u.email
      FROM likes l
      JOIN users u ON u.id = l.user_id
      WHERE COALESCE(l.content_type, 'article') = ${contentType}
        AND l.content_id = ${contentId}
      ORDER BY u.id, l.created_at DESC
      LIMIT 50;
    `;
    return rows.map(r => ({
      id: r.id,
      name: (r.display_name ?? r.email ?? "User").trim() || "User",
      email: r.email ?? "",
    }));
  } else {
    // credit: fetch distinct user_ids from credit.likes, then resolve names in ESG.users
    const c = getPrisma("credit");
    const ids = await c.$queryRaw<{ user_id: number }[]>`
      SELECT DISTINCT user_id
      FROM likes
      WHERE COALESCE(content_type, 'article') = ${contentType}
        AND content_id = ${contentId}
      ORDER BY user_id ASC
      LIMIT 50;
    `;
    if (ids.length === 0) return [];
    const idList = ids.map(r => r.user_id);

    const users = await esgPrisma.$queryRaw<{ id: number; display_name: string; email: string | null }[]>`
      SELECT u.id,
             COALESCE(
               NULLIF(BTRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), ''),
               NULLIF(u.username, ''),
               NULLIF(split_part(COALESCE(u.email,''), '@', 1), ''),
               NULLIF(u.email, ''),
               'User'
             ) AS display_name,
             u.email
      FROM users u
      WHERE u.id = ANY(${idList});
    `;
    return users.map(u => ({
      id: u.id,
      name: (u.display_name ?? u.email ?? "User").trim() || "User",
      email: u.email ?? "",
    }));
  }
}