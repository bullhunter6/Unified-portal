import { NextResponse } from "next/server";
import { ESG_JOBS } from "../upload/jobstore";
import { esgPrisma } from "@esgcredit/db-esg";
import * as fs from "fs";
import * as path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "esg");

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("jobId") || "";
  
  // First try in-memory job
  const job = ESG_JOBS.get(id);
  if (job && job.status === "done" && job.buffer) {
    return new NextResponse(new Uint8Array(job.buffer), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${job.filename ?? `esg_updated_${id}.xlsx`}"`,
        "cache-control": "no-store"
      }
    });
  }
  
  // Fallback to database and disk file
  try {
    const dbJob = await esgPrisma.file_uploads.findUnique({ where: { task_id: id } });
    if (!dbJob || dbJob.status !== "done" || !dbJob.output_filename) {
      return NextResponse.json({ error: "File not ready for download" }, { status: 400 });
    }
    
    const filePath = path.join(UPLOAD_DIR, dbJob.output_filename);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
    }
    
    const fileBuffer = fs.readFileSync(filePath);
    return new NextResponse(fileBuffer, {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${dbJob.output_filename}"`,
        "cache-control": "no-store"
      }
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}