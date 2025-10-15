import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";
import { esgPrisma } from "@esgcredit/db-esg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/health/cron
 * Get cron job health and alert processing status
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session as any)?.is_admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Alert processing statistics
    const alertStatsRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        ap.alert_type,
        COUNT(DISTINCT ap.id) as alert_count,
        COUNT(acs.id) as content_sent_count,
        MAX(acs.sent_at) as last_sent
      FROM alert_preferences ap
      LEFT JOIN alert_content_sent acs ON ap.id = acs.alert_preference_id
        AND acs.sent_at > NOW() - INTERVAL '7 days'
      WHERE ap.is_active = true
      GROUP BY ap.alert_type
    `;

    const alertStats = alertStatsRaw.map((stat) => ({
      alertType: stat.alert_type,
      alertCount: Number(stat.alert_count),
      contentSentCount: Number(stat.content_sent_count),
      lastSent: stat.last_sent,
    }));

    // Content sent over time (last 7 days)
    const contentSentTimelineRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        DATE(sent_at) as date,
        COUNT(*) as count
      FROM alert_content_sent
      WHERE sent_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE(sent_at)
      ORDER BY date DESC
    `;

    const contentSentTimeline = contentSentTimelineRaw.map((item) => ({
      date: item.date,
      count: Number(item.count),
    }));

    // Active alerts that should be sending
    const activeAlertsRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN next_send_at < NOW() THEN 1 ELSE 0 END) as overdue,
        SUM(CASE WHEN last_sent_at IS NULL THEN 1 ELSE 0 END) as never_sent
      FROM alert_preferences
      WHERE is_active = true
    `;

    const activeAlerts = {
      total: Number(activeAlertsRaw[0]?.total || 0),
      overdue: Number(activeAlertsRaw[0]?.overdue || 0),
      neverSent: Number(activeAlertsRaw[0]?.never_sent || 0),
    };

    // Recent alert activity (last 24 hours)
    const recentActivityRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        DATE_TRUNC('hour', sent_at) as hour,
        COUNT(*) as count
      FROM alert_content_sent
      WHERE sent_at > NOW() - INTERVAL '24 hours'
      GROUP BY DATE_TRUNC('hour', sent_at)
      ORDER BY hour DESC
    `;

    const recentActivity = recentActivityRaw.map((activity) => ({
      hour: activity.hour,
      count: Number(activity.count),
    }));

    // Alerts that haven't sent in a while (potentially stuck)
    const stuckAlertsRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        ap.id,
        ap.alert_name,
        ap.alert_type,
        ap.last_sent_at,
        ap.next_send_at,
        u.email,
        u.first_name,
        u.last_name
      FROM alert_preferences ap
      JOIN users u ON ap.user_id = u.id
      WHERE ap.is_active = true 
        AND ap.next_send_at < NOW() - INTERVAL '1 day'
        AND ap.alert_type IN ('daily_digest', 'weekly_digest')
      ORDER BY ap.next_send_at ASC
      LIMIT 20
    `;

    const stuckAlerts = stuckAlertsRaw.map((alert) => ({
      id: alert.id,
      name: alert.alert_name,
      type: alert.alert_type,
      lastSent: alert.last_sent_at,
      nextSend: alert.next_send_at,
      userEmail: alert.email,
      userName: alert.first_name && alert.last_name 
        ? `${alert.first_name} ${alert.last_name}` 
        : alert.email,
    }));

    // Determine health status
    let healthStatus = "healthy";
    const last24hActivity = recentActivity.reduce((sum, a) => sum + a.count, 0);
    
    if (activeAlerts.total > 0) {
      if (last24hActivity === 0) {
        healthStatus = "unhealthy"; // No activity in 24h with active alerts
      } else if (activeAlerts.overdue > activeAlerts.total * 0.2) {
        healthStatus = "degraded"; // More than 20% overdue
      }
    }

    return NextResponse.json({
      status: healthStatus,
      metrics: {
        activeAlerts: activeAlerts.total,
        overdueAlerts: activeAlerts.overdue,
        neverSentAlerts: activeAlerts.neverSent,
        contentSentLast24h: last24hActivity,
        contentSentLast7d: contentSentTimeline.reduce((sum, item) => sum + item.count, 0),
      },
      alertStats,
      contentSentTimeline,
      recentActivity,
      stuckAlerts,
    });
  } catch (error: any) {
    console.error("Error fetching cron health:", error);
    return NextResponse.json(
      { error: "Failed to fetch cron health", details: error.message },
      { status: 500 }
    );
  }
}
