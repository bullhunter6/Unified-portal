// API Route: AI Assistant Statistics for Admin Dashboard
// GET /api/admin/ai-assistant/stats

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth-options';
import { esgPrisma } from '@esgcredit/db-esg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Authentication check
    const authSession = await getServerSession(authOptions);
    if (!authSession?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user and check admin role
    const user = await esgPrisma.users.findUnique({
      where: { email: authSession.user.email },
      select: {
        id: true,
        is_admin: true,
      },
    });

    if (!user || !user.is_admin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Get query parameters for date filtering
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '30');
    const domain = searchParams.get('domain') || 'all'; // 'all', 'credit', 'esg'

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build where clause
    const whereClause: any = {
      created_at: {
        gte: startDate,
      },
    };

    if (domain !== 'all') {
      whereClause.domain = domain;
    }

    // ============================================================
    // 1. OVERALL STATISTICS
    // ============================================================
    const [
      totalSessions,
      activeSessions,
      totalMessages,
      uniqueUsers,
      totalTokens,
      totalCost,
    ] = await Promise.all([
      // Total sessions created
      esgPrisma.article_ai_sessions.count({
        where: whereClause,
      }),

      // Active sessions (not expired)
      esgPrisma.article_ai_sessions.count({
        where: {
          ...whereClause,
          expires_at: {
            gt: new Date(),
          },
        },
      }),

      // Total messages (sum of conversation lengths)
      esgPrisma.article_ai_sessions.aggregate({
        where: whereClause,
        _sum: {
          tokens_used: true,
        },
      }).then(result => {
        // Approximate: 1 token = 0.75 words, avg message = 50 words
        const totalTokens = result._sum.tokens_used || 0;
        return Math.floor(totalTokens / 40); // Rough message count estimate
      }),

      // Unique users
      esgPrisma.article_ai_sessions.findMany({
        where: whereClause,
        select: {
          user_id: true,
        },
        distinct: ['user_id'],
      }).then(results => results.length),

      // Total tokens used
      esgPrisma.article_ai_sessions.aggregate({
        where: whereClause,
        _sum: {
          tokens_used: true,
        },
      }).then(result => result._sum.tokens_used || 0),

      // Total cost
      esgPrisma.article_ai_sessions.aggregate({
        where: whereClause,
        _sum: {
          cost_usd: true,
        },
      }).then(result => result._sum.cost_usd || 0),
    ]);

    // ============================================================
    // 2. DOMAIN BREAKDOWN
    // ============================================================
    const domainStats = await esgPrisma.article_ai_sessions.groupBy({
      by: ['domain'],
      where: {
        created_at: {
          gte: startDate,
        },
      },
      _count: {
        id: true,
      },
      _sum: {
        tokens_used: true,
        cost_usd: true,
      },
    });

    // ============================================================
    // 3. DAILY USAGE TREND
    // ============================================================
    const sessions = await esgPrisma.article_ai_sessions.findMany({
      where: whereClause,
      select: {
        created_at: true,
        tokens_used: true,
        cost_usd: true,
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    // Group by day
    const dailyStats: Record<string, { sessions: number; tokens: number; cost: number }> = {};
    sessions.forEach(session => {
      const day = session.created_at.toISOString().split('T')[0];
      if (!dailyStats[day]) {
        dailyStats[day] = { sessions: 0, tokens: 0, cost: 0 };
      }
      dailyStats[day].sessions += 1;
      dailyStats[day].tokens += session.tokens_used || 0;
      dailyStats[day].cost += Number(session.cost_usd) || 0;
    });

    const dailyTrend = Object.entries(dailyStats).map(([date, stats]) => ({
      date,
      sessions: stats.sessions,
      tokens: stats.tokens,
      cost: stats.cost,
    }));

    // ============================================================
    // 4. TOP USERS
    // ============================================================
    const topUsers = await esgPrisma.article_ai_sessions.groupBy({
      by: ['user_id'],
      where: whereClause,
      _count: {
        id: true,
      },
      _sum: {
        tokens_used: true,
        cost_usd: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 10,
    });

    // Fetch user details
    const userIds = topUsers.map(u => u.user_id);
    const users = await esgPrisma.users.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        username: true,
        email: true,
      },
    });

    const userMap = new Map(users.map(u => [u.id, u]));

    const topUsersWithDetails = topUsers.map(stat => {
      const user = userMap.get(stat.user_id);
      const name = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username : 'Unknown';
      
      return {
        userId: stat.user_id,
        name,
        email: user?.email || 'unknown@email.com',
        sessions: stat._count.id,
        tokens: stat._sum.tokens_used || 0,
        cost: Number(stat._sum.cost_usd) || 0,
      };
    });

    // ============================================================
    // 5. TOP ARTICLES (Most Asked About)
    // ============================================================
    const topArticles = await esgPrisma.article_ai_sessions.groupBy({
      by: ['article_id', 'domain'],
      where: whereClause,
      _count: {
        id: true,
      },
      _sum: {
        tokens_used: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 10,
    });

    // ============================================================
    // 6. PERFORMANCE METRICS
    // ============================================================
    const avgTokensPerSession = totalSessions > 0 ? Math.round(totalTokens / totalSessions) : 0;
    const avgCostPerSession = totalSessions > 0 ? (Number(totalCost) / totalSessions) : 0;
    const avgSessionsPerUser = uniqueUsers > 0 ? (totalSessions / uniqueUsers) : 0;

    // ============================================================
    // 7. RECENT ACTIVITY
    // ============================================================
    const recentSessions = await esgPrisma.article_ai_sessions.findMany({
      where: whereClause,
      select: {
        id: true,
        article_id: true,
        domain: true,
        user_id: true,
        created_at: true,
        tokens_used: true,
        cost_usd: true,
        session_data: true,
      },
      orderBy: {
        created_at: 'desc',
      },
      take: 20,
    });

    // Fetch user details for recent sessions
    const recentUserIds = Array.from(new Set(recentSessions.map(s => s.user_id)));
    const recentUsers = await esgPrisma.users.findMany({
      where: {
        id: {
          in: recentUserIds,
        },
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        username: true,
        email: true,
      },
    });

    const recentUserMap = new Map(recentUsers.map(u => [u.id, u]));

    const recentActivity = recentSessions.map(session => {
      const sessionData = session.session_data as any;
      const messageCount = sessionData?.messages?.length || 0;
      const user = recentUserMap.get(session.user_id);
      const userName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username : 'Unknown';

      return {
        sessionId: session.id,
        articleId: session.article_id,
        domain: session.domain,
        userId: session.user_id,
        userName,
        userEmail: user?.email || 'unknown@email.com',
        createdAt: session.created_at,
        messageCount,
        tokens: session.tokens_used || 0,
        cost: Number(session.cost_usd) || 0,
      };
    });

    // ============================================================
    // RESPONSE
    // ============================================================
    return NextResponse.json({
      success: true,
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
      overview: {
        totalSessions,
        activeSessions,
        totalMessages,
        uniqueUsers,
        totalTokens,
        totalCost: Number(totalCost.toFixed(4)),
        avgTokensPerSession,
        avgCostPerSession: Number(avgCostPerSession.toFixed(4)),
        avgSessionsPerUser: Number(avgSessionsPerUser.toFixed(2)),
      },
      domainBreakdown: domainStats.map(stat => ({
        domain: stat.domain,
        sessions: stat._count.id,
        tokens: stat._sum.tokens_used || 0,
        cost: Number(stat._sum.cost_usd) || 0,
      })),
      dailyTrend,
      topUsers: topUsersWithDetails,
      topArticles: topArticles.map(stat => ({
        articleId: stat.article_id,
        domain: stat.domain,
        sessions: stat._count.id,
        tokens: stat._sum.tokens_used || 0,
      })),
      recentActivity,
    });
  } catch (error: any) {
    console.error('[Admin AI Stats] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch AI assistant statistics',
      },
      { status: 500 }
    );
  }
}
