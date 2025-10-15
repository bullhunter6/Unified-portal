import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";
import { esgPrisma } from "@esgcredit/db-esg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/admin/email-queue/clear
 * Clear old emails from queue
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session as any)?.is_admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") || "30");
    const status = searchParams.get("status") || "sent";

    // Delete emails older than X days with specified status
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await esgPrisma.email_queue.deleteMany({
      where: {
        created_at: {
          lt: cutoffDate,
        },
        status,
      },
    });

    return NextResponse.json({
      message: `Cleared ${result.count} emails older than ${days} days`,
      affected: result.count,
    });
  } catch (error: any) {
    console.error("Error clearing email queue:", error);
    return NextResponse.json(
      { error: error.message || "Failed to clear email queue" },
      { status: 500 }
    );
  }
}
