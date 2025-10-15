import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";
import { esgPrisma } from "@esgcredit/db-esg";
import { creditPrisma } from "@esgcredit/db-credit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/analytics/content
 * Get content analytics (articles, events, publications)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session as any)?.is_admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") || "30");

    // ESG Articles with most likes
    const esgTopArticlesRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        a.id,
        a.title,
        a.source,
        a.published,
        COUNT(l.id) as like_count
      FROM esg_articles a
      LEFT JOIN likes l ON a.id = l.content_id AND l.content_type = 'article'
      WHERE a.published > NOW() - INTERVAL '${days} days'
      GROUP BY a.id, a.title, a.source, a.published
      ORDER BY like_count DESC
      LIMIT 10
    `;

    // Credit Articles with most likes
    const creditTopArticlesRaw = await creditPrisma.$queryRaw<any[]>`
      SELECT 
        a.id,
        a.title,
        a.source,
        a.date,
        COUNT(l.id) as like_count
      FROM credit_articles a
      LEFT JOIN likes l ON a.id = l.content_id AND l.content_type = 'article'
      WHERE a.date > NOW() - INTERVAL '${days} days'
      GROUP BY a.id, a.title, a.source, a.date
      ORDER BY like_count DESC
      LIMIT 10
    `;

    const topArticles = {
      esg: esgTopArticlesRaw.map((item) => ({
        id: item.id,
        title: item.title,
        source: item.source,
        published: item.published,
        like_count: Number(item.like_count),
        domain: "esg",
      })),
      credit: creditTopArticlesRaw.map((item) => ({
        id: item.id,
        title: item.title,
        source: item.source,
        published: item.date,
        like_count: Number(item.like_count),
        domain: "credit",
      })),
    };

    // Top sources by article count (ESG)
    const esgTopSourcesRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        source,
        COUNT(*) as article_count,
        COUNT(DISTINCT l.user_id) as unique_likes
      FROM esg_articles a
      LEFT JOIN likes l ON a.id = l.content_id AND l.content_type = 'article'
      WHERE a.published > NOW() - INTERVAL '${days} days'
      GROUP BY source
      ORDER BY article_count DESC
      LIMIT 10
    `;

    // Top sources by article count (Credit)
    const creditTopSourcesRaw = await creditPrisma.$queryRaw<any[]>`
      SELECT 
        source,
        COUNT(*) as article_count,
        COUNT(DISTINCT l.user_id) as unique_likes
      FROM credit_articles a
      LEFT JOIN likes l ON a.id = l.content_id AND l.content_type = 'article'
      WHERE a.date > NOW() - INTERVAL '${days} days'
      GROUP BY source
      ORDER BY article_count DESC
      LIMIT 10
    `;

    const topSources = {
      esg: esgTopSourcesRaw.map((item) => ({
        source: item.source,
        article_count: Number(item.article_count),
        unique_likes: Number(item.unique_likes),
        domain: "esg",
      })),
      credit: creditTopSourcesRaw.map((item) => ({
        source: item.source,
        article_count: Number(item.article_count),
        unique_likes: Number(item.unique_likes),
        domain: "credit",
      })),
    };

    // Content published over time (ESG)
    const esgPublishedOverTimeRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        DATE(published) as date,
        COUNT(*) as count
      FROM esg_articles
      WHERE published > NOW() - INTERVAL '${days} days'
      GROUP BY DATE(published)
      ORDER BY date DESC
    `;

    // Content published over time (Credit)
    const creditPublishedOverTimeRaw = await creditPrisma.$queryRaw<any[]>`
      SELECT 
        DATE(date) as date,
        COUNT(*) as count
      FROM credit_articles
      WHERE date > NOW() - INTERVAL '${days} days'
      GROUP BY DATE(date)
      ORDER BY date DESC
    `;

    const publishedOverTime = {
      esg: esgPublishedOverTimeRaw.map((item) => ({
        date: item.date,
        count: Number(item.count),
      })),
      credit: creditPublishedOverTimeRaw.map((item) => ({
        date: item.date,
        count: Number(item.count),
      })),
    };

    // Total counts
    const esgArticleCountRaw = await esgPrisma.$queryRaw<any[]>`SELECT COUNT(*) as count FROM esg_articles`;
    const creditArticleCountRaw = await creditPrisma.$queryRaw<any[]>`SELECT COUNT(*) as count FROM credit_articles`;
    const esgEventCountRaw = await esgPrisma.$queryRaw<any[]>`SELECT COUNT(*) as count FROM events`;
    const creditEventCountRaw = await creditPrisma.$queryRaw<any[]>`SELECT COUNT(*) as count FROM events`;
    
    const esgArticleCount = Number(esgArticleCountRaw[0]?.count || 0);
    const creditArticleCount = Number(creditArticleCountRaw[0]?.count || 0);
    const esgEventCount = Number(esgEventCountRaw[0]?.count || 0);
    const creditEventCount = Number(creditEventCountRaw[0]?.count || 0);

    // Recent articles count
    const esgRecentArticlesRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT COUNT(*) as count FROM esg_articles WHERE published > NOW() - INTERVAL '${days} days'
    `;
    const creditRecentArticlesRaw = await creditPrisma.$queryRaw<any[]>`
      SELECT COUNT(*) as count FROM credit_articles WHERE date > NOW() - INTERVAL '${days} days'
    `;

    return NextResponse.json({
      overview: {
        totalArticles: esgArticleCount + creditArticleCount,
        totalEvents: esgEventCount + creditEventCount,
        recentArticles: Number(esgRecentArticlesRaw[0]?.count || 0) + Number(creditRecentArticlesRaw[0]?.count || 0),
      },
      topArticles,
      topSources,
      publishedOverTime,
    });
  } catch (error: any) {
    console.error("Error fetching content analytics:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch content analytics" },
      { status: 500 }
    );
  }
}
