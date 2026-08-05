import { NextRequest, NextResponse } from "next/server";
import { esgPrisma } from "@esgcredit/db-esg";
import { requirePdfxUser } from "@/lib/pdfx/auth";
import { getBackgroundJob, isUuid } from "@/lib/jobs/queue";
import { buildPdfxContentDisposition } from "@/lib/pdfx/constants";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requirePdfxUser();
  if (auth.response) return auth.response;
  const jobId = req.nextUrl.searchParams.get("jobId")!;
  if (!isUuid(jobId)) {
    return NextResponse.json({ success: false, error: "Invalid jobId" }, { status: 400 });
  }

  const [row, queueJob] = await Promise.all([
    esgPrisma.pdf_translation_jobs.findFirst({
      where: { id: jobId, user_id: auth.userId },
      select: { filename: true },
    }),
    getBackgroundJob(jobId, auth.userId),
  ]);
  if (!row || !queueJob?.inputData) {
    return NextResponse.json({ success: false }, { status: 404 });
  }
  return new Response(new Uint8Array(queueJob.inputData), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(queueJob.inputData.length),
      "Content-Disposition": buildPdfxContentDisposition("inline", row.filename),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
