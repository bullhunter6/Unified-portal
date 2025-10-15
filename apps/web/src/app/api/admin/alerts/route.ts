import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";
import { esgPrisma } from "@esgcredit/db-esg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/alerts
 * List all alerts with filters, search, and pagination
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session as any)?.is_admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || ""; // active, inactive
    const alertType = searchParams.get("type") || ""; // weekly_digest, daily_digest, immediate_alerts
    const userId = searchParams.get("userId") || "";

    const skip = (page - 1) * limit;

    // Build where clause using Prisma
    const where: any = {};

    if (search) {
      where.OR = [
        { users: { email: { contains: search, mode: 'insensitive' } } },
        { users: { first_name: { contains: search, mode: 'insensitive' } } },
        { users: { last_name: { contains: search, mode: 'insensitive' } } },
        { alert_name: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status === "active") {
      where.is_active = true;
    } else if (status === "inactive") {
      where.is_active = false;
    }

    if (alertType) {
      where.alert_type = alertType;
    }

    if (userId) {
      where.user_id = parseInt(userId);
    }

    // Get total count
    const total = await esgPrisma.alert_preferences.count({ where });

    // Get alerts with user info using Prisma
    const alerts = await esgPrisma.alert_preferences.findMany({
      where,
      include: {
        users: {
          select: {
            email: true,
            first_name: true,
            last_name: true,
            team: true,
          },
        },
        _count: {
          select: {
            alert_content_sent: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      skip,
      take: limit,
    });

    // Format the response to match expected structure
    const formattedAlerts = alerts.map((alert: any) => ({
      ...alert,
      email: alert.users.email,
      first_name: alert.users.first_name,
      last_name: alert.users.last_name,
      team: alert.users.team,
      total_sent: alert._count.alert_content_sent.toString(),
    }));
    
    console.log(`Found ${formattedAlerts.length} alerts, Total: ${total}`);

    return NextResponse.json({
      alerts: formattedAlerts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("Error fetching alerts:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}
