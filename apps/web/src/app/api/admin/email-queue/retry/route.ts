import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";
import { esgPrisma } from "@esgcredit/db-esg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/email-queue/retry
 * Retry failed emails
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session as any)?.is_admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { emailIds } = body;

    if (!Array.isArray(emailIds) || emailIds.length === 0) {
      return NextResponse.json(
        { error: "Provide emailIds array" },
        { status: 400 }
      );
    }

    // Reset failed emails to queued status
    const result = await esgPrisma.email_queue.updateMany({
      where: {
        id: { in: emailIds },
        status: "failed",
      },
      data: {
        status: "queued",
        attempts: 0,
        last_error: null,
        scheduled_for: new Date(),
      },
    });

    return NextResponse.json({
      message: "Emails queued for retry",
      affected: result.count,
    });
  } catch (error: any) {
    console.error("Error retrying emails:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retry emails" },
      { status: 500 }
    );
  }
}
