import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";
import { esgPrisma } from "@esgcredit/db-esg";

// GET /api/admin/stats - Get dashboard statistics
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is admin
    if (!(session as any)?.is_admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get stats in parallel
    const [
      totalUsers,
      activeUsers,
      newUsersThisWeek,
      totalAlerts,
      activeAlerts,
      recentUsers,
      emailStats,
      aiAssistantStats,
    ] = await Promise.all([
      // Total users
      esgPrisma.users.count(),
      
      // Active users (logged in last 30 days)
      esgPrisma.users.count({
        where: {
          last_login: {
            gte: thirtyDaysAgo,
          },
        },
      }),
      
      // New users this week
      esgPrisma.users.count({
        where: {
          created_at: {
            gte: sevenDaysAgo,
          },
        },
      }),
      
      // Total alerts
      esgPrisma.alert_preferences.count(),
      
      // Active alerts
      esgPrisma.alert_preferences.count({
        where: {
          is_active: true,
          email_enabled: true,
        },
      }),
      
      // Recent users (last 10)
      esgPrisma.users.findMany({
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          created_at: true,
        },
        orderBy: { created_at: "desc" },
        take: 10,
      }),
      
      // Email queue stats
      esgPrisma.email_queue.groupBy({
        by: ['status'],
        _count: true,
      }),

      // AI Assistant stats (last 30 days)
      esgPrisma.article_ai_sessions.aggregate({
        where: {
          created_at: {
            gte: thirtyDaysAgo,
          },
        },
        _count: true,
        _sum: {
          tokens_used: true,
          cost_usd: true,
        },
      }).then(async (data) => {
        const uniqueUsers = await esgPrisma.article_ai_sessions.findMany({
          where: {
            created_at: {
              gte: thirtyDaysAgo,
            },
          },
          select: { user_id: true },
          distinct: ['user_id'],
        });

        const activeSessions = await esgPrisma.article_ai_sessions.count({
          where: {
            created_at: {
              gte: new Date(now.getTime() - 60 * 60 * 1000), // Last hour
            },
          },
        });

        return {
          totalSessions: data._count || 0,
          activeSessions,
          uniqueUsers: uniqueUsers.length,
          totalCost: Number(data._sum?.cost_usd || 0),
        };
      }),
    ]);

    // Process email stats
    const emailStatsMap = emailStats.reduce((acc: any, stat) => {
      acc[stat.status || 'unknown'] = stat._count;
      return acc;
    }, {});

    return NextResponse.json({
      totalUsers,
      activeUsers,
      newUsersThisWeek,
      totalAlerts,
      activeAlerts,
      recentUsers,
      emailStats: {
        queued: emailStatsMap['queued'] || 0,
        sent: emailStatsMap['sent'] || 0,
        failed: emailStatsMap['failed'] || 0,
      },
      aiAssistant: aiAssistantStats,
    });
  } catch (error: any) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 }
    );
  }
}
