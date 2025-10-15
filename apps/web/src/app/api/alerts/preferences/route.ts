import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";
import { esgPrisma } from "@esgcredit/db-esg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/alerts/preferences - Get all user's alert configurations
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number((session.user as any).id);
    const { searchParams } = new URL(req.url);
    const domain = searchParams.get("domain") || "esg";

    // Get all alerts for the user and domain
    // Now domain can be an array, so we filter by domains array containing the requested domain
    const alerts = await esgPrisma.$queryRaw<any[]>`
      SELECT * FROM alert_preferences
      WHERE user_id = ${userId} 
        AND (domains @> ARRAY[${domain}]::varchar[] OR domain = ${domain})
      ORDER BY created_at DESC
    `;

    return NextResponse.json({
      ok: true,
      success: true,
      alerts: alerts || [],
    });
  } catch (error: any) {
    console.error("Error fetching alert preferences:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to fetch preferences" },
      { status: 500 }
    );
  }
}

// POST /api/alerts/preferences - Create a new alert configuration
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number((session.user as any).id);
    const body = await req.json();

    const emailAddr = body.email_address || (session.user as any).email;

    // Insert new alert configuration
    const [newAlert] = await esgPrisma.$queryRaw<any[]>`
      INSERT INTO alert_preferences (
        user_id, domain, domains, alert_name, alert_type, is_active,
        weekly_digest, daily_digest, immediate_alerts,
        alert_articles, alert_events, alert_publications,
        sources, keywords,
        immediate_sources, immediate_keywords, immediate_content_types,
        team_likes_only, email_enabled, email_address,
        digest_day, digest_hour, timezone,
        created_at, updated_at
      ) VALUES (
        ${userId}, ${body.domains?.[0] || body.domain || "esg"}, 
        ${body.domains || [body.domain || "esg"]}::varchar[], 
        ${body.alert_name || "New Alert"}, 
        ${body.alert_type || "weekly_digest"}, ${body.is_active !== false},
        ${body.alert_type === "weekly_digest"}, ${body.alert_type === "daily_digest"}, 
        ${body.alert_type === "immediate_alerts"},
        ${body.alert_articles !== false}, ${body.alert_events !== false}, 
        ${body.alert_publications !== false},
        ${body.sources || []}::text[], ${body.keywords || []}::text[],
        ${body.immediate_sources || []}::text[], ${body.immediate_keywords || []}::text[], 
        ${body.immediate_content_types || ["articles"]}::text[],
        ${body.team_likes_only !== false}, ${body.email_enabled !== false}, ${emailAddr},
        ${body.digest_day || "monday"}, ${body.digest_hour || 9}, ${body.timezone || "Asia/Dubai"},
        NOW(), NOW()
      )
      RETURNING *
    `;

    return NextResponse.json({
      ok: true,
      success: true,
      message: "Alert created successfully",
      alert: newAlert,
    });
  } catch (error: any) {
    console.error("Error creating alert:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to create alert" },
      { status: 500 }
    );
  }
}

// DELETE /api/alerts/preferences - Reset preferences to defaults
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number((session.user as any).id);
    const { searchParams } = new URL(req.url);
    const domain = searchParams.get("domain");

    if (!domain || !["esg", "credit"].includes(domain)) {
      return NextResponse.json(
        { error: "Invalid domain parameter" },
        { status: 400 }
      );
    }

    await esgPrisma.$queryRaw`
      DELETE FROM alert_preferences
      WHERE user_id = ${userId} AND domain = ${domain}
    `;

    return NextResponse.json({
      success: true,
      message: `Alert preferences for ${domain} domain reset to defaults`,
    });
  } catch (error: any) {
    console.error("Error deleting alert preferences:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete preferences" },
      { status: 500 }
    );
  }
}
