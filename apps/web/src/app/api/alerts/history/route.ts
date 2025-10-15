import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";
import { esgPrisma } from "@esgcredit/db-esg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/alerts/history - Get user's alert history
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number((session.user as any).id);
    const { searchParams } = new URL(req.url);
    
    const domain = searchParams.get("domain"); // Optional: 'esg' or 'credit'
    const alertType = searchParams.get("type"); // Optional: 'weekly_digest', 'daily_digest', 'immediate'
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const offset = (page - 1) * pageSize;

    // Build query conditions
    let whereConditions = `user_id = ${userId}`;
    if (domain && ["esg", "credit"].includes(domain)) {
      whereConditions += ` AND domain = '${domain}'`;
    }
    if (alertType && ["weekly_digest", "daily_digest", "immediate"].includes(alertType)) {
      whereConditions += ` AND alert_type = '${alertType}'`;
    }

    // Get alert history
    const history = await esgPrisma.$queryRawUnsafe<any[]>(`
      SELECT 
        id, user_id, domain, alert_type, content_type, content_ids,
        email_to, email_subject, email_status, total_items,
        opened_at, clicked_at, error_message, retry_count,
        sent_at, created_at, template_version, job_id
      FROM alert_history
      WHERE ${whereConditions}
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    // Get total count
    const [{ count }] = await esgPrisma.$queryRawUnsafe<{ count: number }[]>(`
      SELECT COUNT(*)::int AS count
      FROM alert_history
      WHERE ${whereConditions}
    `);

    // Get stats
    const [stats] = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*)::int AS total_alerts,
        COUNT(CASE WHEN email_status = 'sent' THEN 1 END)::int AS sent_count,
        COUNT(CASE WHEN email_status = 'failed' THEN 1 END)::int AS failed_count,
        COUNT(CASE WHEN email_status = 'pending' THEN 1 END)::int AS pending_count,
        COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END)::int AS opened_count,
        COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END)::int AS clicked_count,
        MAX(sent_at) AS last_sent_at
      FROM alert_history
      WHERE user_id = ${userId}
    `;

    return NextResponse.json({
      success: true,
      history,
      pagination: {
        page,
        pageSize,
        total: count,
        totalPages: Math.ceil(count / pageSize),
      },
      stats: stats || {
        total_alerts: 0,
        sent_count: 0,
        failed_count: 0,
        pending_count: 0,
        opened_count: 0,
        clicked_count: 0,
        last_sent_at: null,
      },
    });
  } catch (error: any) {
    console.error("Error fetching alert history:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch alert history" },
      { status: 500 }
    );
  }
}
