import { NextRequest, NextResponse } from "next/server";
import { esgPrisma } from "@esgcredit/db-esg";
import { requirePdfxUser } from "@/lib/pdfx/auth";
import { requestBackgroundJobCancellation } from "@/lib/jobs/queue";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requirePdfxUser();
  if (auth.response) return auth.response;
  const { jobId } = await req.json();
  const status = await requestBackgroundJobCancellation(jobId, auth.userId);
  if (!status) return NextResponse.json({ success: false }, { status: 404 });
  if (status === "done" || status === "error") {
    return NextResponse.json(
      { success: false, status, error: "This job is already finished" },
      { status: 409 },
    );
  }
  const domainStatus = status === "cancelled" ? "cancelled" : "cancelling";
  await esgPrisma.pdf_translation_jobs.updateMany({
    where: {
      id: jobId,
      user_id: auth.userId,
      status: { in: ["queued", "processing", "cancelling"] },
    },
    data: {
      status: domainStatus,
      message: status === "cancelled" ? "Cancelled" : "Cancelling...",
      progress: status === "cancelled" ? 100 : undefined,
      completed_at: status === "cancelled" ? new Date() : undefined,
    },
  });

  return NextResponse.json({ success: true, status: domainStatus });
}
