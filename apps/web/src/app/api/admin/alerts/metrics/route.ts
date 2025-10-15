import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";
import { esgPrisma } from "@esgcredit/db-esg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/alerts/metrics
 * Get alert performance metrics
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session as any)?.is_admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get overall stats
    const totalAlerts = await esgPrisma.alert_preferences.count();
    const activeAlerts = await esgPrisma.alert_preferences.count({
      where: { is_active: true },
    });

    // Alerts by type
    const alertsByTypeRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT alert_type, COUNT(*) as count
      FROM alert_preferences
      GROUP BY alert_type
      ORDER BY count DESC
    `;
    const alertsByType = alertsByTypeRaw.map((item) => ({
      alert_type: item.alert_type,
      count: Number(item.count),
    }));

    // Most active alerts (by content sent)
    const topAlertsRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        ap.id,
        ap.alert_name,
        ap.alert_type,
        u.email,
        COUNT(acs.id) as items_sent
      FROM alert_preferences ap
      LEFT JOIN alert_content_sent acs ON acs.alert_preference_id = ap.id
      JOIN users u ON ap.user_id = u.id
      WHERE ap.is_active = true
      GROUP BY ap.id, ap.alert_name, ap.alert_type, u.email
      ORDER BY items_sent DESC
      LIMIT 10
    `;
    const topAlerts = topAlertsRaw.map((item) => ({
      id: item.id,
      alert_name: item.alert_name,
      alert_type: item.alert_type,
      email: item.email,
      items_sent: Number(item.items_sent),
    }));

    // Alerts sent over time (last 30 days)
    const sentOverTimeRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        DATE(sent_at) as date,
        COUNT(*) as count
      FROM alert_content_sent
      WHERE sent_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(sent_at)
      ORDER BY date DESC
    `;
    const sentOverTime = sentOverTimeRaw.map((item) => ({
      date: item.date,
      count: Number(item.count),
    }));

    // Email queue stats for alerts
    const emailStatsRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        status,
        alert_type,
        COUNT(*) as count
      FROM email_queue
      WHERE alert_type IS NOT NULL
        AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY status, alert_type
      ORDER BY count DESC
    `;
    const emailStats = emailStatsRaw.map((item) => ({
      status: item.status,
      alert_type: item.alert_type,
      count: Number(item.count),
    }));

    // Inactive alerts (not sent in last 30 days)
    const inactiveAlertsRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT COUNT(*) as count
      FROM alert_preferences ap
      WHERE ap.is_active = true
        AND (
          ap.last_sent_at IS NULL 
          OR ap.last_sent_at < NOW() - INTERVAL '30 days'
        )
    `;
    const inactiveAlertsCount = Number(inactiveAlertsRaw[0]?.count || 0);

    return NextResponse.json({
      overview: {
        totalAlerts,
        activeAlerts,
        inactiveAlerts: inactiveAlertsCount,
        pausedAlerts: totalAlerts - activeAlerts,
      },
      alertsByType,
      topAlerts,
      sentOverTime,
      emailStats,
    });
  } catch (error: any) {
    console.error("Error fetching alert metrics:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch alert metrics" },
      { status: 500 }
    );
  }
}
