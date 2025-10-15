import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";
import { esgPrisma } from "@esgcredit/db-esg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/health/email
 * Get email service health and queue status
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session as any)?.is_admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Email queue statistics
    const queueStatsRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        status,
        COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM (sent_at - created_at))) as avg_processing_time
      FROM email_queue
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY status
    `;

    const queueStats = queueStatsRaw.map((stat) => ({
      status: stat.status,
      count: Number(stat.count),
      avgProcessingTime: stat.avg_processing_time
        ? Math.round(Number(stat.avg_processing_time))
        : 0,
    }));

    // Recent email activity (last 24 hours)
    const recentActivityRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        DATE_TRUNC('hour', created_at) as hour,
        status,
        COUNT(*) as count
      FROM email_queue
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY DATE_TRUNC('hour', created_at), status
      ORDER BY hour DESC
    `;

    const recentActivity = recentActivityRaw.map((activity) => ({
      hour: activity.hour,
      status: activity.status,
      count: Number(activity.count),
    }));

    // Failed emails (last 24 hours)
    const failedEmailsRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        id,
        email_to,
        email_subject,
        status,
        last_error,
        created_at,
        sent_at,
        attempts
      FROM email_queue
      WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 50
    `;

    const failedEmails = failedEmailsRaw.map((email) => ({
      id: email.id,
      to: email.email_to,
      subject: email.email_subject,
      status: email.status,
      error: email.last_error,
      createdAt: email.created_at,
      sentAt: email.sent_at,
      retryCount: email.attempts,
    }));

    // Pending emails
    const pendingCountRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT COUNT(*) as count FROM email_queue WHERE status = 'pending'
    `;
    const pendingCount = Number(pendingCountRaw[0]?.count || 0);

    // Total emails in last 24 hours
    const totalLast24hRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT COUNT(*) as count FROM email_queue 
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `;
    const totalLast24h = Number(totalLast24hRaw[0]?.count || 0);

    // Success rate calculation
    const sentCountRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT COUNT(*) as count FROM email_queue 
      WHERE status = 'sent' AND created_at > NOW() - INTERVAL '24 hours'
    `;
    const sentCount = Number(sentCountRaw[0]?.count || 0);
    const successRate = totalLast24h > 0 ? (sentCount / totalLast24h) * 100 : 0;

    // Determine health status
    let healthStatus = "healthy";
    if (successRate < 80) healthStatus = "unhealthy";
    else if (successRate < 95) healthStatus = "degraded";

    return NextResponse.json({
      status: healthStatus,
      metrics: {
        totalLast24h,
        sentLast24h: sentCount,
        failedLast24h: failedEmails.length,
        pendingCount,
        successRate: parseFloat(successRate.toFixed(2)),
      },
      queueStats,
      recentActivity,
      failedEmails,
    });
  } catch (error: any) {
    console.error("Error fetching email health:", error);
    return NextResponse.json(
      { error: "Failed to fetch email health", details: error.message },
      { status: 500 }
    );
  }
}
