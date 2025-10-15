import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";
import { esgPrisma } from "@esgcredit/db-esg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/analytics/teams
 * Get team comparison analytics
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session as any)?.is_admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") || "30");

    // Users by team
    const usersByTeamRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        COALESCE(team, 'No Team') as team,
        COUNT(*) as user_count
      FROM users
      GROUP BY team
      ORDER BY user_count DESC
    `;
    const usersByTeam = usersByTeamRaw.map((item) => ({
      team: item.team,
      user_count: Number(item.user_count),
    }));

    // Alerts by team
    const alertsByTeamRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        COALESCE(u.team, 'No Team') as team,
        COUNT(ap.id) as alert_count,
        SUM(CASE WHEN ap.is_active = true THEN 1 ELSE 0 END) as active_alert_count
      FROM users u
      LEFT JOIN alert_preferences ap ON u.id = ap.user_id
      GROUP BY u.team
      ORDER BY alert_count DESC
    `;
    const alertsByTeam = alertsByTeamRaw.map((item) => ({
      team: item.team,
      alert_count: Number(item.alert_count),
      active_alert_count: Number(item.active_alert_count),
    }));

    // Likes by team
    const likesByTeamRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        COALESCE(u.team, 'No Team') as team,
        COUNT(l.id) as like_count
      FROM users u
      LEFT JOIN likes l ON u.id = l.user_id
      WHERE l.created_at > NOW() - INTERVAL '${days} days' OR l.created_at IS NULL
      GROUP BY u.team
      ORDER BY like_count DESC
    `;
    const likesByTeam = likesByTeamRaw.map((item) => ({
      team: item.team,
      like_count: Number(item.like_count),
    }));

    // Content sent by team
    const contentSentByTeamRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        COALESCE(u.team, 'No Team') as team,
        COUNT(acs.id) as content_sent_count
      FROM users u
      LEFT JOIN alert_preferences ap ON u.id = ap.user_id
      LEFT JOIN alert_content_sent acs ON ap.id = acs.alert_preference_id
      WHERE acs.sent_at > NOW() - INTERVAL '${days} days' OR acs.sent_at IS NULL
      GROUP BY u.team
      ORDER BY content_sent_count DESC
    `;
    const contentSentByTeam = contentSentByTeamRaw.map((item) => ({
      team: item.team,
      content_sent_count: Number(item.content_sent_count),
    }));

    // Team engagement score (combined metrics)
    const teamEngagementRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        COALESCE(u.team, 'No Team') as team,
        COUNT(DISTINCT u.id) as user_count,
        COUNT(DISTINCT ap.id) as alert_count,
        COUNT(DISTINCT l.id) as like_count,
        COUNT(DISTINCT acs.id) as content_sent_count
      FROM users u
      LEFT JOIN alert_preferences ap ON u.id = ap.user_id
      LEFT JOIN likes l ON u.id = l.user_id AND l.created_at > NOW() - INTERVAL '${days} days'
      LEFT JOIN alert_content_sent acs ON ap.id = acs.alert_preference_id AND acs.sent_at > NOW() - INTERVAL '${days} days'
      GROUP BY u.team
      ORDER BY user_count DESC
    `;
    const teamEngagement = teamEngagementRaw.map((item) => {
      const userCount = Number(item.user_count);
      const alertCount = Number(item.alert_count);
      const likeCount = Number(item.like_count);
      const contentSentCount = Number(item.content_sent_count);
      
      // Calculate engagement score (normalized)
      const alertsPerUser = userCount > 0 ? alertCount / userCount : 0;
      const likesPerUser = userCount > 0 ? likeCount / userCount : 0;
      const contentPerUser = userCount > 0 ? contentSentCount / userCount : 0;
      const engagementScore = (alertsPerUser * 0.3 + likesPerUser * 0.3 + contentPerUser * 0.4) * 100;

      return {
        team: item.team,
        user_count: userCount,
        alert_count: alertCount,
        like_count: likeCount,
        content_sent_count: contentSentCount,
        alerts_per_user: parseFloat(alertsPerUser.toFixed(2)),
        likes_per_user: parseFloat(likesPerUser.toFixed(2)),
        content_per_user: parseFloat(contentPerUser.toFixed(2)),
        engagement_score: parseFloat(engagementScore.toFixed(2)),
      };
    });

    // Most active users per team
    const topUsersPerTeamRaw = await esgPrisma.$queryRaw<any[]>`
      SELECT 
        COALESCE(u.team, 'No Team') as team,
        u.id,
        COALESCE(u.first_name || ' ' || u.last_name, u.email) as name,
        u.email,
        COUNT(DISTINCT ap.id) as alert_count,
        COUNT(DISTINCT l.id) as like_count
      FROM users u
      LEFT JOIN alert_preferences ap ON u.id = ap.user_id
      LEFT JOIN likes l ON u.id = l.user_id AND l.created_at > NOW() - INTERVAL '${days} days'
      GROUP BY u.team, u.id, u.first_name, u.last_name, u.email
      ORDER BY u.team, alert_count DESC, like_count DESC
    `;
    
    // Group by team and get top 3 users per team
    const topUsersPerTeam: Record<string, any[]> = {};
    topUsersPerTeamRaw.forEach((item) => {
      const team = item.team;
      if (!topUsersPerTeam[team]) {
        topUsersPerTeam[team] = [];
      }
      if (topUsersPerTeam[team].length < 3) {
        topUsersPerTeam[team].push({
          id: item.id,
          name: item.name,
          email: item.email,
          alert_count: Number(item.alert_count),
          like_count: Number(item.like_count),
        });
      }
    });

    return NextResponse.json({
      usersByTeam,
      alertsByTeam,
      likesByTeam,
      contentSentByTeam,
      teamEngagement,
      topUsersPerTeam,
    });
  } catch (error: any) {
    console.error("Error fetching team analytics:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch team analytics" },
      { status: 500 }
    );
  }
}
