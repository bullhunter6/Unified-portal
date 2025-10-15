import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";
import { esgPrisma } from "@esgcredit/db-esg";
import { creditPrisma } from "@esgcredit/db-credit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/health
 * Get overall system health status
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session as any)?.is_admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const healthChecks = {
      database: { status: "unknown", message: "", responseTime: 0 },
      esgDatabase: { status: "unknown", message: "", responseTime: 0 },
      creditDatabase: { status: "unknown", message: "", responseTime: 0 },
      emailService: { status: "unknown", message: "", responseTime: 0 },
      cronJobs: { status: "unknown", message: "", responseTime: 0 },
    };

    // Check ESG Database
    try {
      const start = Date.now();
      await esgPrisma.$queryRaw`SELECT 1`;
      healthChecks.esgDatabase = {
        status: "healthy",
        message: "Connected",
        responseTime: Date.now() - start,
      };
    } catch (error: any) {
      healthChecks.esgDatabase = {
        status: "unhealthy",
        message: error.message,
        responseTime: 0,
      };
    }

    // Check Credit Database
    try {
      const start = Date.now();
      await creditPrisma.$queryRaw`SELECT 1`;
      healthChecks.creditDatabase = {
        status: "healthy",
        message: "Connected",
        responseTime: Date.now() - start,
      };
    } catch (error: any) {
      healthChecks.creditDatabase = {
        status: "unhealthy",
        message: error.message,
        responseTime: 0,
      };
    }

    // Overall database status
    healthChecks.database = {
      status:
        healthChecks.esgDatabase.status === "healthy" &&
        healthChecks.creditDatabase.status === "healthy"
          ? "healthy"
          : "unhealthy",
      message: "Both databases operational",
      responseTime:
        (healthChecks.esgDatabase.responseTime +
          healthChecks.creditDatabase.responseTime) /
        2,
    };

    // Check Email Service (check recent email queue activity)
    try {
      const start = Date.now();
      const recentEmails = await esgPrisma.$queryRaw<any[]>`
        SELECT COUNT(*) as count FROM email_queue 
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `;
      const failedEmails = await esgPrisma.$queryRaw<any[]>`
        SELECT COUNT(*) as count FROM email_queue 
        WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours'
      `;

      const totalRecent = Number(recentEmails[0]?.count || 0);
      const totalFailed = Number(failedEmails[0]?.count || 0);
      const failureRate = totalRecent > 0 ? (totalFailed / totalRecent) * 100 : 0;

      healthChecks.emailService = {
        status: failureRate > 10 ? "degraded" : "healthy",
        message: `${totalRecent} emails in 24h, ${totalFailed} failed (${failureRate.toFixed(1)}% failure rate)`,
        responseTime: Date.now() - start,
      };
    } catch (error: any) {
      healthChecks.emailService = {
        status: "unhealthy",
        message: error.message,
        responseTime: 0,
      };
    }

    // Check Cron Jobs (check alert processing activity)
    try {
      const start = Date.now();
      const recentAlertsSent = await esgPrisma.$queryRaw<any[]>`
        SELECT COUNT(*) as count FROM alert_content_sent 
        WHERE sent_at > NOW() - INTERVAL '24 hours'
      `;
      const activeAlerts = await esgPrisma.$queryRaw<any[]>`
        SELECT COUNT(*) as count FROM alert_preferences 
        WHERE is_active = true
      `;

      const sentCount = Number(recentAlertsSent[0]?.count || 0);
      const activeCount = Number(activeAlerts[0]?.count || 0);

      healthChecks.cronJobs = {
        status: sentCount > 0 || activeCount === 0 ? "healthy" : "degraded",
        message: `${sentCount} alerts sent in 24h, ${activeCount} active alerts`,
        responseTime: Date.now() - start,
      };
    } catch (error: any) {
      healthChecks.cronJobs = {
        status: "unhealthy",
        message: error.message,
        responseTime: 0,
      };
    }

    // Calculate overall system health
    const statuses = Object.values(healthChecks).map((check) => check.status);
    const overallStatus = statuses.includes("unhealthy")
      ? "unhealthy"
      : statuses.includes("degraded")
      ? "degraded"
      : "healthy";

    return NextResponse.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: healthChecks,
    });
  } catch (error: any) {
    console.error("Error fetching system health:", error);
    return NextResponse.json(
      { error: "Failed to fetch system health", details: error.message },
      { status: 500 }
    );
  }
}
