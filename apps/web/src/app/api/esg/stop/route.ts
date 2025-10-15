import { NextResponse } from "next/server";
import { ESG_JOBS } from "../upload/jobstore";
import { esgPrisma } from "@esgcredit/db-esg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { jobId } = await req.json();
    const job = ESG_JOBS.get(jobId);
    
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Mark job as cancelled
    job.cancelled = true;
    job.status = "cancelled";

    // Update database
    await esgPrisma.file_uploads.update({
      where: { task_id: jobId },
      data: { 
        status: "cancelled",
        updated_at: new Date()
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Stop API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to stop job" },
      { status: 500 }
    );
  }
}