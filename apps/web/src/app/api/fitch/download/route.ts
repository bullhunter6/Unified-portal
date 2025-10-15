import { NextResponse } from "next/server";
import { JOBS } from "../upload/jobstore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("jobId") ?? "";
  const job = JOBS.get(id);

  if (!job || job.status !== "done" || !job.buffer) {
    return NextResponse.json({ error: "Not ready" }, { status: 400 });
  }

  return new NextResponse(job.buffer as any, {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition":
        `attachment; filename="${job.filename ?? `fitch-updated-${id}.xlsx`}"`,
      "cache-control": "no-store",
    },
  });
}