import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";
import { esgPrisma } from "@esgcredit/db-esg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/email-queue/stats
 * Get email queue statistics
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session as any)?.is_admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Overall stats
    const total = await esgPrisma.email_queue.count();
    const queued = await esgPrisma.email_queue.count({ where: { status: "queued" } });
    const sent = await esgPrisma.email_queue.count({ where: { status: "sent" } });
    const failed = await esgPrisma.email_queue.count({ where: { status: "failed" } });
    const processing = await esgPrisma.email_queue.count({ where: { status: "processing" } });

    // Stats by alert type
    const byAlertTypeRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        COALESCE(alert_type, 'manual') as alert_type,
        status,
        COUNT(*) as count
      FROM email_queue
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY alert_type, status
      ORDER BY count DESC
    `;
    const byAlertType = byAlertTypeRaw.map((item) => ({
      alert_type: item.alert_type,
      status: item.status,
      count: Number(item.count),
    }));

    // Stats by domain
    const byDomainRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        COALESCE(domain, 'none') as domain,
        status,
        COUNT(*) as count
      FROM email_queue
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY domain, status
      ORDER BY count DESC
    `;
    const byDomain = byDomainRaw.map((item) => ({
      domain: item.domain,
      status: item.status,
      count: Number(item.count),
    }));

    // Emails sent over time (last 30 days)
    const overTimeRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        DATE(created_at) as date,
        status,
        COUNT(*) as count
      FROM email_queue
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at), status
      ORDER BY date DESC
    `;
    const overTime = overTimeRaw.map((item) => ({
      date: item.date,
      status: item.status,
      count: Number(item.count),
    }));

    // Recent failures
    const recentFailures = await esgPrisma.email_queue.findMany({
      where: { status: "failed" },
      orderBy: { last_attempt_at: "desc" },
      take: 10,
      select: {
        id: true,
        email_to: true,
        email_subject: true,
        last_error: true,
        attempts: true,
        last_attempt_at: true,
      },
    });

    return NextResponse.json({
      overview: {
        total,
        queued,
        sent,
        failed,
        processing,
      },
      byAlertType,
      byDomain,
      overTime,
      recentFailures,
    });
  } catch (error: any) {
    console.error("Error fetching email queue stats:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch email queue stats" },
      { status: 500 }
    );
  }
}
