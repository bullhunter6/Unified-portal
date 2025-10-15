export const revalidate = 0; // always fresh

import Link from "next/link";
import { getPrisma } from "@/lib/db";
import { parseKeywords } from "@/lib/keywords";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";

type Sort = "latest" | "top";
type Range = "7d" | "30d" | "60d";
type Scope = "all" | "mine";

const RANGE_TO_DAYS: Record<Range, number> = { "7d": 7, "30d": 30, "60d": 60 };

export default async function CommunityPage({
  params,
  searchParams,
}: {
  params: { domain: "esg" | "credit" },
  searchParams?: { sort?: Sort; range?: Range; scope?: Scope }
}) {
  const domain = params.domain;
  const sort: Sort = (searchParams?.sort || "latest") as Sort; // default LATEST
  const range: Range = (searchParams?.range || "7d") as Range;  // default 7d
  const scope: Scope = (searchParams?.scope || "all") as Scope; // default ALL

  const session = await getServerSession(authOptions);
  const userId = Number((session?.user as any)?.id || 0);

  const days = RANGE_TO_DAYS[range] ?? 7;
  const prisma = getPrisma(domain);

  const from = new Date();
  from.setDate(from.getDate() - days);

  let rows;
  if (domain === "esg") {
    if (scope === "mine" && userId) {
      if (sort === "top") {
        rows = await prisma.$queryRaw<{
          id: number; title: string | null; source: string | null; link: string | null;
          date: Date | null; matched_keywords: any; likes: number; last_like_at: Date | null;
        }[]>`
          SELECT a.id, a.title, a.source, a.link,
                 COALESCE(a.published, a.save_time) AS date,
                 a.matched_keywords,
                 COUNT(l.*)::int AS likes,
                 MAX(l.created_at) AS last_like_at
          FROM likes l
          JOIN esg_articles a ON a.id = l.content_id
          WHERE COALESCE(l.content_type,'article') = 'article'
            AND l.created_at >= ${from}
            AND l.user_id = ${userId}
          GROUP BY a.id
          ORDER BY likes DESC, COALESCE(a.published, a.save_time) DESC
          LIMIT 60;
        `;
      } else {
        rows = await prisma.$queryRaw<{
          id: number; title: string | null; source: string | null; link: string | null;
          date: Date | null; matched_keywords: any; likes: number; last_like_at: Date | null;
        }[]>`
          SELECT a.id, a.title, a.source, a.link,
                 COALESCE(a.published, a.save_time) AS date,
                 a.matched_keywords,
                 COUNT(l.*)::int AS likes,
                 MAX(l.created_at) AS last_like_at
          FROM likes l
          JOIN esg_articles a ON a.id = l.content_id
          WHERE COALESCE(l.content_type,'article') = 'article'
            AND l.created_at >= ${from}
            AND l.user_id = ${userId}
          GROUP BY a.id
          ORDER BY last_like_at DESC, likes DESC
          LIMIT 60;
        `;
      }
    } else {
      if (sort === "top") {
        rows = await prisma.$queryRaw<{
          id: number; title: string | null; source: string | null; link: string | null;
          date: Date | null; matched_keywords: any; likes: number; last_like_at: Date | null;
        }[]>`
          SELECT a.id, a.title, a.source, a.link,
                 COALESCE(a.published, a.save_time) AS date,
                 a.matched_keywords,
                 COUNT(l.*)::int AS likes,
                 MAX(l.created_at) AS last_like_at
          FROM likes l
          JOIN esg_articles a ON a.id = l.content_id
          WHERE COALESCE(l.content_type,'article') = 'article'
            AND l.created_at >= ${from}
          GROUP BY a.id
          ORDER BY likes DESC, COALESCE(a.published, a.save_time) DESC
          LIMIT 60;
        `;
      } else {
        rows = await prisma.$queryRaw<{
          id: number; title: string | null; source: string | null; link: string | null;
          date: Date | null; matched_keywords: any; likes: number; last_like_at: Date | null;
        }[]>`
          SELECT a.id, a.title, a.source, a.link,
                 COALESCE(a.published, a.save_time) AS date,
                 a.matched_keywords,
                 COUNT(l.*)::int AS likes,
                 MAX(l.created_at) AS last_like_at
          FROM likes l
          JOIN esg_articles a ON a.id = l.content_id
          WHERE COALESCE(l.content_type,'article') = 'article'
            AND l.created_at >= ${from}
          GROUP BY a.id
          ORDER BY last_like_at DESC, likes DESC
          LIMIT 60;
        `;
      }
    }
  } else {
    if (scope === "mine" && userId) {
      if (sort === "top") {
        rows = await prisma.$queryRaw<{
          id: number; title: string | null; source: string | null; link: string | null;
          date: Date | null; matched_keywords: any; likes: number; last_like_at: Date | null;
        }[]>`
          SELECT a.id, a.title, a.source, a.link,
                 a.date,
                 a.matched_keywords,
                 COUNT(l.*)::int AS likes,
                 MAX(l.created_at) AS last_like_at
          FROM likes l
          JOIN credit_articles a ON a.id = l.content_id
          WHERE COALESCE(l.content_type,'article') = 'article'
            AND l.created_at >= ${from}
            AND l.user_id = ${userId}
          GROUP BY a.id
          ORDER BY likes DESC, a.date DESC
          LIMIT 60;
        `;
      } else {
        rows = await prisma.$queryRaw<{
          id: number; title: string | null; source: string | null; link: string | null;
          date: Date | null; matched_keywords: any; likes: number; last_like_at: Date | null;
        }[]>`
          SELECT a.id, a.title, a.source, a.link,
                 a.date,
                 a.matched_keywords,
                 COUNT(l.*)::int AS likes,
                 MAX(l.created_at) AS last_like_at
          FROM likes l
          JOIN credit_articles a ON a.id = l.content_id
          WHERE COALESCE(l.content_type,'article') = 'article'
            AND l.created_at >= ${from}
            AND l.user_id = ${userId}
          GROUP BY a.id
          ORDER BY last_like_at DESC, likes DESC
          LIMIT 60;
        `;
      }
    } else {
      if (sort === "top") {
        rows = await prisma.$queryRaw<{
          id: number; title: string | null; source: string | null; link: string | null;
          date: Date | null; matched_keywords: any; likes: number; last_like_at: Date | null;
        }[]>`
          SELECT a.id, a.title, a.source, a.link,
                 a.date,
                 a.matched_keywords,
                 COUNT(l.*)::int AS likes,
                 MAX(l.created_at) AS last_like_at
          FROM likes l
          JOIN credit_articles a ON a.id = l.content_id
          WHERE COALESCE(l.content_type,'article') = 'article'
            AND l.created_at >= ${from}
          GROUP BY a.id
          ORDER BY likes DESC, a.date DESC
          LIMIT 60;
        `;
      } else {
        rows = await prisma.$queryRaw<{
          id: number; title: string | null; source: string | null; link: string | null;
          date: Date | null; matched_keywords: any; likes: number; last_like_at: Date | null;
        }[]>`
          SELECT a.id, a.title, a.source, a.link,
                 a.date,
                 a.matched_keywords,
                 COUNT(l.*)::int AS likes,
                 MAX(l.created_at) AS last_like_at
          FROM likes l
          JOIN credit_articles a ON a.id = l.content_id
          WHERE COALESCE(l.content_type,'article') = 'article'
            AND l.created_at >= ${from}
          GROUP BY a.id
          ORDER BY last_like_at DESC, likes DESC
          LIMIT 60;
        `;
      }
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Community</h1>
          <p className="mt-1 text-slate-600">
            {domain.toUpperCase()} articles liked in the last {days} days.
          </p>
        </div>

        {/* Controls (prefetch off to avoid stale preloads) */}
        <div className="flex gap-2">
          <PillGroup label="Sort">
            <Pill href={`/${domain}/community?sort=latest&range=${range}&scope=${scope}`} active={sort === "latest"}>Latest</Pill>
            <Pill href={`/${domain}/community?sort=top&range=${range}&scope=${scope}`} active={sort === "top"}>Top</Pill>
          </PillGroup>
          <PillGroup label="Range">
            {(["7d","30d","60d"] as Range[]).map(r => (
              <Pill key={r} href={`/${domain}/community?sort=${sort}&range=${r}&scope=${scope}`} active={range === r}>{r}</Pill>
            ))}
          </PillGroup>
          <PillGroup label="Scope">
            <Pill href={`/${domain}/community?sort=${sort}&range=${range}&scope=all`}  active={scope === "all"}>All</Pill>
            <Pill href={`/${domain}/community?sort=${sort}&range=${range}&scope=mine`} active={scope === "mine"}>Mine</Pill>
          </PillGroup>
        </div>
      </div>

      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((a, i) => {
          const kws = parseKeywords(a.matched_keywords).slice(0, 6);
          return (
            <li key={`${a.id}-${i}`} className="group">
              <article className="h-full rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md">
                <h3 className="line-clamp-2 text-base font-medium group-hover:underline">
                  <Link href={`/${domain}/articles/${a.id}`}>{a.title ?? "Untitled"}</Link>
                </h3>

                <div className="mt-2 text-xs text-slate-500">
                  <span>{a.source ?? "Unknown"}</span>
                  {a.date && <> · <time dateTime={new Date(a.date).toISOString()}>
                    {new Date(a.date).toLocaleDateString()}
                  </time></>}
                  {a.last_like_at && <> · liked {timeAgo(a.last_like_at)} </>}
                </div>

                {kws.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {kws.map((k) => (
                      <span key={k} className="rounded-md bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700 border">
                        {k}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between">
                  {a.link ? (
                    <a href={a.link!} target="_blank" className="text-sm text-blue-600 hover:underline">Open original ↗</a>
                  ) : <span className="text-sm text-slate-400">No link</span>}
                  <span className="text-xs text-slate-500">{a.likes} liked</span>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

function PillGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 rounded-xl border p-1" title={label}>
      {children}
    </div>
  );
}

function Pill({ href, active, children }: { href: string; active?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={`rounded-lg px-2 py-1 text-sm ${active ? "bg-slate-900 text-white" : "hover:bg-slate-50 border"}`}
    >
      {children}
    </Link>
  );
}

function timeAgo(d: Date | string) {
  const t = new Date(d).getTime();
  const delta = Math.floor((Date.now() - t) / 1000);
  if (delta < 60) return "just now";
  const mins = Math.floor(delta / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}