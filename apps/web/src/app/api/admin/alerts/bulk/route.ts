import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";
import { esgPrisma } from "@esgcredit/db-esg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/alerts/bulk
 * Bulk operations on alerts
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session as any)?.is_admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { action, alertIds } = body;

    if (!action || !Array.isArray(alertIds) || alertIds.length === 0) {
      return NextResponse.json(
        { error: "Invalid request. Provide action and alertIds" },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case "pause":
        result = await esgPrisma.alert_preferences.updateMany({
          where: { id: { in: alertIds } },
          data: { is_active: false },
        });
        break;

      case "resume":
        result = await esgPrisma.alert_preferences.updateMany({
          where: { id: { in: alertIds } },
          data: { is_active: true },
        });
        break;

      case "delete":
        // Delete alert_content_sent first
        await esgPrisma.alert_content_sent.deleteMany({
          where: { alert_preference_id: { in: alertIds } },
        });
        
        result = await esgPrisma.alert_preferences.deleteMany({
          where: { id: { in: alertIds } },
        });
        break;

      case "enable_email":
        result = await esgPrisma.alert_preferences.updateMany({
          where: { id: { in: alertIds } },
          data: { email_enabled: true },
        });
        break;

      case "disable_email":
        result = await esgPrisma.alert_preferences.updateMany({
          where: { id: { in: alertIds } },
          data: { email_enabled: false },
        });
        break;

      default:
        return NextResponse.json(
          { error: "Invalid action. Use: pause, resume, delete, enable_email, disable_email" },
          { status: 400 }
        );
    }

    return NextResponse.json({
      message: `Bulk ${action} completed`,
      affected: result.count,
    });
  } catch (error: any) {
    console.error("Error performing bulk operation:", error);
    return NextResponse.json(
      { error: error.message || "Failed to perform bulk operation" },
      { status: 500 }
    );
  }
}
