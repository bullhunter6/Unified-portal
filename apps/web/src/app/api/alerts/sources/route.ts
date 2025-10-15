import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";
import { esgPrisma } from "@esgcredit/db-esg";
// TODO: Uncomment when credit database is ready
// import { creditPrisma } from "@esgcredit/db-credit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET - Get available sources for each content type
 * 
 * NOTE: Source filtering is implemented but not currently used in the UI.
 * This endpoint is ready for future use when source filtering is needed.
 * 
 * Usage:
 * - ESG domain: Fetches sources from esg_articles table in ESG database
 * - Credit domain: Will fetch from credit_articles table in Credit database (when available)
 * - Both domains: Fetch sources from events and publications tables
 * 
 * To enable in UI: Uncomment the source selection section in AlertSettingsNew.tsx
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const domain = searchParams.get("domain") || "esg";

    let articleSources: { source: string }[] = [];
    let eventSources: { source: string }[] = [];
    let publicationSources: { source: string }[] = [];

    try {
      // Get unique sources from articles based on domain
      if (domain === "credit") {
        // TODO: Use credit database when available
        // try {
        //   articleSources = await creditPrisma.$queryRawUnsafe<{ source: string }[]>(
        //     `SELECT DISTINCT source FROM credit_articles WHERE source IS NOT NULL AND source != '' ORDER BY source`
        //   );
        // } catch (err) {
        //   articleSources = [];
        // }
        
        // For now, return empty array for credit domain
        articleSources = [];
      } else {
        // Use ESG database for esg_articles
        try {
          articleSources = await esgPrisma.$queryRawUnsafe<{ source: string }[]>(
            `SELECT DISTINCT source FROM esg_articles WHERE source IS NOT NULL AND source != '' ORDER BY source`
          );
        } catch (err) {
          articleSources = [];
        }
      }

      // Get unique sources from events (shared across both domains)
      eventSources = await esgPrisma.$queryRawUnsafe<{ source: string }[]>(
        `SELECT DISTINCT source FROM events WHERE source IS NOT NULL AND source != '' ORDER BY source`
      );

      // Get unique sources from publications (shared across both domains)
      publicationSources = await esgPrisma.$queryRawUnsafe<{ source: string }[]>(
        `SELECT DISTINCT source FROM publications WHERE source IS NOT NULL AND source != '' ORDER BY source`
      );
    } catch (error) {
      console.error("Error querying sources:", error);
      // Continue with whatever we have
    }

    return NextResponse.json({
      ok: true,
      success: true,
      sources: {
        articles: articleSources.map(s => s.source),
        events: eventSources.map(s => s.source),
        publications: publicationSources.map(s => s.source),
      },
    });
  } catch (error: any) {
    console.error("Error fetching sources:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to fetch sources" },
      { status: 500 }
    );
  }
}
