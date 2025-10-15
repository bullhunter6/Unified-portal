import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";
import { jobInputPath } from "@/lib/pdfx/fs";
import fs from "node:fs";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ success: false }, { status: 401 });
  
  const prisma = getPrisma("esg");
  const user = await (prisma as any).users.findUnique({
    where: { email: session.user.email }
  });
  
  if (!user) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }
  
  const userId = user.id;
  const jobId = req.nextUrl.searchParams.get("jobId")!;
  if (!jobId) return NextResponse.json({ success: false, error: "Missing jobId" }, { status: 400 });

  const row = await (prisma as any).pdf_translation_jobs.findUnique({ where: { id: jobId } });
  if (!row || row.user_id !== userId) return NextResponse.json({ success: false }, { status: 404 });

  const p = jobInputPath(row.stored_filename);
  if (!fs.existsSync(p)) return NextResponse.json({ success: false }, { status: 404 });

  const stat = fs.statSync(p);
  const stream = fs.createReadStream(p);
  return new Response(stream as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(stat.size),
      "Content-Disposition": `inline; filename="${encodeURIComponent(row.filename)}"`,
    },
  });
}