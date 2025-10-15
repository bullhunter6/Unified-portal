import { NextResponse } from "next/server";
import { ESG_JOBS } from "../upload/jobstore";
import { esgPrisma } from "@esgcredit/db-esg";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("jobId") || "";
  const job = ESG_JOBS.get(id);
  
  console.log(`Status check for job ${id}: ${job ? 'found in memory' : 'not in memory'}`);
  
  if (job) {
    console.log(`Job status: ${job.status}, progress: ${job.progress}%`);
    return NextResponse.json({
      status: job.status,
      progress: job.progress,
      rowsTotal: job.rowsTotal ?? 0,
      rowsDone: job.rowsDone ?? 0,
      error: job.error ?? null,
    });
  }
  // Fallback to DB if not found in memory
  try {
    const dbJob = await esgPrisma.file_uploads.findUnique({ where: { task_id: id } });
    if (!dbJob) {
      console.log(`Job ${id} not found in database either`);
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    
    console.log(`Job ${id} from DB: status=${dbJob.status}`);
    
    // Return actual database status - don't assume completion
    return NextResponse.json({
      status: dbJob.status || "queued",
      progress: dbJob.status === "done" ? 100 : dbJob.status === "processing" ? 50 : 0,
      rowsTotal: 0, // fallback, since not in DB
      rowsDone: 0, // fallback, since not in DB
      error: dbJob.error_message ?? null,
    });
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}