import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";
import { esgPrisma } from "@esgcredit/db-esg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/analytics/user-engagement
 * Get user engagement analytics
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session as any)?.is_admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") || "30");

    // Total users
    const totalUsers = await esgPrisma.users.count();

    // New users in the last N days
    const newUsersRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM users
      WHERE created_at > NOW() - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;
    const newUsers = newUsersRaw.map((item) => ({
      date: item.date,
      count: Number(item.count),
    }));

    // Users by team
    const usersByTeamRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        COALESCE(team, 'No Team') as team,
        COUNT(*) as count
      FROM users
      GROUP BY team
      ORDER BY count DESC
    `;
    const usersByTeam = usersByTeamRaw.map((item) => ({
      team: item.team,
      count: Number(item.count),
    }));

    // Users with alerts
    const usersWithAlerts = await esgPrisma.alert_preferences.groupBy({
      by: ['user_id'],
      _count: {
        user_id: true,
      },
    });

    // Active users (users who created alerts or liked content in last N days)
    const activeUsersRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT COUNT(DISTINCT user_id) as count
      FROM (
        SELECT user_id FROM alert_preferences WHERE created_at > NOW() - INTERVAL '${days} days'
        UNION
        SELECT user_id FROM likes WHERE created_at > NOW() - INTERVAL '${days} days'
        UNION
        SELECT ap.user_id 
        FROM alert_content_sent acs
        JOIN alert_preferences ap ON acs.alert_preference_id = ap.id
        WHERE acs.sent_at > NOW() - INTERVAL '${days} days'
      ) as active_users
    `;
    const activeUsers = Number(activeUsersRaw[0]?.count || 0);

    // Likes over time
    const likesOverTimeRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM likes
      WHERE created_at > NOW() - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;
    const likesOverTime = likesOverTimeRaw.map((item) => ({
      date: item.date,
      count: Number(item.count),
    }));

    // Total likes
    const totalLikesRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT COUNT(*) as count FROM likes
    `;
    const totalLikes = Number(totalLikesRaw[0]?.count || 0);

    // Users with most likes
    const topLikersRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        u.id,
        COALESCE(u.first_name || ' ' || u.last_name, u.email) as name,
        u.email,
        u.team,
        COUNT(l.id) as like_count
      FROM users u
      JOIN likes l ON u.id = l.user_id
      GROUP BY u.id, u.first_name, u.last_name, u.email, u.team
      ORDER BY like_count DESC
      LIMIT 10
    `;
    const topLikers = topLikersRaw.map((item) => ({
      id: item.id,
      name: item.name,
      email: item.email,
      team: item.team,
      like_count: Number(item.like_count),
    }));

    return NextResponse.json({
      overview: {
        totalUsers,
        activeUsers,
        usersWithAlerts: usersWithAlerts.length,
        totalLikes,
      },
      newUsers,
      usersByTeam,
      likesOverTime,
      topLikers,
    });
  } catch (error: any) {
    console.error("Error fetching user engagement analytics:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch user engagement analytics" },
      { status: 500 }
    );
  }
}
