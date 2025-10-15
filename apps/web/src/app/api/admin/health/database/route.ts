import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";
import { esgPrisma } from "@esgcredit/db-esg";
import { creditPrisma } from "@esgcredit/db-credit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/health/database
 * Get detailed database health metrics
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session as any)?.is_admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // ESG Database Metrics
    const esgMetrics = {
      status: "unknown",
      connectionPool: { active: 0, idle: 0, total: 0 },
      tables: [] as any[],
      totalRecords: 0,
      avgQueryTime: 0,
    };

    try {
      // Test query with timing
      const start = Date.now();
      await esgPrisma.$queryRaw`SELECT 1`;
      const queryTime = Date.now() - start;

      // Get table sizes
      const tablesRaw = await esgPrisma.$queryRaw<any[]>`
        SELECT 
          schemaname as schema,
          tablename as table_name,
          pg_total_relation_size(schemaname||'.'||tablename) as total_size,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size_pretty
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 20
      `;

      // Get record counts for main tables
      const userCount = await esgPrisma.$queryRaw<any[]>`SELECT COUNT(*) as count FROM users`;
      const articlesCount = await esgPrisma.$queryRaw<any[]>`SELECT COUNT(*) as count FROM esg_articles`;
      const eventsCount = await esgPrisma.$queryRaw<any[]>`SELECT COUNT(*) as count FROM events`;
      const alertsCount = await esgPrisma.$queryRaw<any[]>`SELECT COUNT(*) as count FROM alert_preferences`;
      const likesCount = await esgPrisma.$queryRaw<any[]>`SELECT COUNT(*) as count FROM likes`;

      esgMetrics.status = "healthy";
      esgMetrics.tables = tablesRaw.map((table) => ({
        name: table.table_name,
        size: Number(table.total_size),
        sizeFormatted: table.size_pretty,
      }));
      esgMetrics.totalRecords =
        Number(userCount[0]?.count || 0) +
        Number(articlesCount[0]?.count || 0) +
        Number(eventsCount[0]?.count || 0) +
        Number(alertsCount[0]?.count || 0) +
        Number(likesCount[0]?.count || 0);
      esgMetrics.avgQueryTime = queryTime;
    } catch (error: any) {
      esgMetrics.status = "unhealthy";
    }

    // Credit Database Metrics
    const creditMetrics = {
      status: "unknown",
      connectionPool: { active: 0, idle: 0, total: 0 },
      tables: [] as any[],
      totalRecords: 0,
      avgQueryTime: 0,
    };

    try {
      // Test query with timing
      const start = Date.now();
      await creditPrisma.$queryRaw`SELECT 1`;
      const queryTime = Date.now() - start;

      // Get table sizes
      const tablesRaw = await creditPrisma.$queryRaw<any[]>`
        SELECT 
          schemaname as schema,
          tablename as table_name,
          pg_total_relation_size(schemaname||'.'||tablename) as total_size,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size_pretty
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 20
      `;

      // Get record counts for main tables
      const articlesCount = await creditPrisma.$queryRaw<any[]>`SELECT COUNT(*) as count FROM credit_articles`;
      const eventsCount = await creditPrisma.$queryRaw<any[]>`SELECT COUNT(*) as count FROM events`;
      const methodologiesCount = await creditPrisma.$queryRaw<any[]>`SELECT COUNT(*) as count FROM methodologies`;

      creditMetrics.status = "healthy";
      creditMetrics.tables = tablesRaw.map((table) => ({
        name: table.table_name,
        size: Number(table.total_size),
        sizeFormatted: table.size_pretty,
      }));
      creditMetrics.totalRecords =
        Number(articlesCount[0]?.count || 0) +
        Number(eventsCount[0]?.count || 0) +
        Number(methodologiesCount[0]?.count || 0);
      creditMetrics.avgQueryTime = queryTime;
    } catch (error: any) {
      creditMetrics.status = "unhealthy";
    }

    return NextResponse.json({
      esg: esgMetrics,
      credit: creditMetrics,
      overall: {
        status:
          esgMetrics.status === "healthy" && creditMetrics.status === "healthy"
            ? "healthy"
            : "unhealthy",
        totalRecords: esgMetrics.totalRecords + creditMetrics.totalRecords,
        avgQueryTime: (esgMetrics.avgQueryTime + creditMetrics.avgQueryTime) / 2,
      },
    });
  } catch (error: any) {
    console.error("Error fetching database health:", error);
    return NextResponse.json(
      { error: "Failed to fetch database health", details: error.message },
      { status: 500 }
    );
  }
}
