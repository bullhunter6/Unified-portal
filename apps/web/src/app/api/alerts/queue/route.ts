import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";
import {
  processEmailQueue,
  getQueueStats,
  cleanupEmailQueue,
} from "@/lib/alerts/email-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/alerts/queue - Get email queue statistics
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can view queue stats
    const isAdmin = (session.user as any).is_admin;
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const stats = await getQueueStats();

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error("Error fetching queue stats:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch queue stats" },
      { status: 500 }
    );
  }
}

// POST /api/alerts/queue - Process email queue manually
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can trigger queue processing
    const isAdmin = (session.user as any).is_admin;
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { action = "process", batchSize = 10 } = body;

    if (action === "process") {
      const stats = await processEmailQueue("manual-trigger", batchSize);
      return NextResponse.json({
        success: true,
        message: "Email queue processed",
        stats,
      });
    } else if (action === "cleanup") {
      const count = await cleanupEmailQueue(30);
      return NextResponse.json({
        success: true,
        message: `Cleaned up ${count} old emails`,
        count,
      });
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'process' or 'cleanup'" },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("Error processing queue:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process queue" },
      { status: 500 }
    );
  }
}
