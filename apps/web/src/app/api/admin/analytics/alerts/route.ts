import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";
import { esgPrisma } from "@esgcredit/db-esg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/analytics/alerts
 * Get alert performance analytics
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session as any)?.is_admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") || "30");

    // Total alerts
    const totalAlerts = await esgPrisma.alert_preferences.count();

    // Active alerts
    const activeAlerts = await esgPrisma.alert_preferences.count({
      where: { is_active: true },
    });

    // Alerts by type
    const alertsByTypeRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        alert_type,
        COUNT(*) as count,
        SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active_count
      FROM alert_preferences
      GROUP BY alert_type
      ORDER BY count DESC
    `;
    const alertsByType = alertsByTypeRaw.map((item) => ({
      alert_type: item.alert_type,
      count: Number(item.count),
      active_count: Number(item.active_count),
    }));

    // Content sent over time
    const contentSentOverTimeRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        DATE(sent_at) as date,
        COUNT(*) as count
      FROM alert_content_sent
      WHERE sent_at > NOW() - INTERVAL '${days} days'
      GROUP BY DATE(sent_at)
      ORDER BY date DESC
    `;
    const contentSentOverTime = contentSentOverTimeRaw.map((item) => ({
      date: item.date,
      count: Number(item.count),
    }));

    // Total content sent
    const totalContentSentRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT COUNT(*) as count FROM alert_content_sent
    `;
    const totalContentSent = Number(totalContentSentRaw[0]?.count || 0);

    // Recent content sent
    const recentContentSentRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT COUNT(*) as count FROM alert_content_sent 
      WHERE sent_at > NOW() - INTERVAL '${days} days'
    `;
    const recentContentSent = Number(recentContentSentRaw[0]?.count || 0);

    // Most active alerts
    const mostActiveAlertsRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        ap.id,
        ap.alert_name,
        ap.alert_type,
        u.first_name,
        u.last_name,
        u.email,
        u.team,
        COUNT(acs.id) as content_count
      FROM alert_preferences ap
      JOIN users u ON ap.user_id = u.id
      LEFT JOIN alert_content_sent acs ON ap.id = acs.alert_preference_id
      WHERE acs.sent_at > NOW() - INTERVAL '${days} days'
      GROUP BY ap.id, ap.alert_name, ap.alert_type, u.first_name, u.last_name, u.email, u.team
      ORDER BY content_count DESC
      LIMIT 10
    `;
    const mostActiveAlerts = mostActiveAlertsRaw.map((item) => ({
      id: item.id,
      alert_name: item.alert_name,
      alert_type: item.alert_type,
      user_name: item.first_name && item.last_name ? `${item.first_name} ${item.last_name}` : item.email,
      email: item.email,
      team: item.team,
      content_count: Number(item.content_count),
    }));

    // Email delivery stats
    const emailStatsRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        status,
        COUNT(*) as count
      FROM email_queue
      WHERE created_at > NOW() - INTERVAL '${days} days'
      GROUP BY status
    `;
    const emailStats = emailStatsRaw.map((item) => ({
      status: item.status,
      count: Number(item.count),
    }));

    // Alerts by domain
    const alertsByDomainRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        domain,
        COUNT(*) as count
      FROM (
        SELECT UNNEST(domains) as domain
        FROM alert_preferences
        WHERE array_length(domains, 1) > 0
      ) as domains_table
      GROUP BY domain
      ORDER BY count DESC
    `;
    const alertsByDomain = alertsByDomainRaw.map((item) => ({
      domain: item.domain,
      count: Number(item.count),
    }));

    // Top keywords in alerts
    const topKeywordsRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        keyword,
        COUNT(*) as count
      FROM (
        SELECT UNNEST(keywords || immediate_keywords) as keyword
        FROM alert_preferences
        WHERE array_length(keywords, 1) > 0 OR array_length(immediate_keywords, 1) > 0
      ) as keywords_table
      GROUP BY keyword
      ORDER BY count DESC
      LIMIT 15
    `;
    const topKeywords = topKeywordsRaw.map((item) => ({
      keyword: item.keyword,
      count: Number(item.count),
    }));

    return NextResponse.json({
      overview: {
        totalAlerts,
        activeAlerts,
        totalContentSent,
        recentContentSent,
      },
      alertsByType,
      alertsByDomain,
      contentSentOverTime,
      mostActiveAlerts,
      emailStats,
      topKeywords,
    });
  } catch (error: any) {
    console.error("Error fetching alert analytics:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch alert analytics" },
      { status: 500 }
    );
  }
}
