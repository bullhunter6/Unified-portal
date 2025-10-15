import { NextResponse } from "next/server";
import { queueWeeklyDigests } from "@/lib/alerts/digest";

/**
 * Cron endpoint to queue weekly digests
 * Triggered: Every Monday at 9:00 AM Dubai time
 * Security: Requires CRON_SECRET in Authorization header
 */
export async function GET(request: Request) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get("authorization");
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (!process.env.CRON_SECRET) {
      console.error("⚠️  CRON_SECRET not set in environment variables");
      return NextResponse.json(
        { error: "Server misconfiguration" },
        { status: 500 }
      );
    }

    if (authHeader !== expectedAuth) {
      console.warn("🚫 Unauthorized cron attempt:", authHeader);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Run the weekly digest job
    console.log("[CRON] 🔔 Starting weekly digest job...");
    const startTime = Date.now();

    await queueWeeklyDigests();

    const duration = Date.now() - startTime;
    console.log(`[CRON] ✅ Weekly digest job completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: "Weekly digests queued successfully",
      duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[CRON] ❌ Weekly digest job failed:", error);
    return NextResponse.json(
      {
        error: "Failed to queue weekly digests",
        message: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
