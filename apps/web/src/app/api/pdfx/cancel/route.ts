import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";
import { cancelJob } from "@/lib/pdfx/jobRunner";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
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
  const { jobId } = await req.json();

  const row = await (prisma as any).pdf_translation_jobs.findUnique({ where: { id: jobId } });
  if (!row || row.user_id !== userId) return NextResponse.json({ success: false }, { status: 404 });

  cancelJob(jobId);
  await (prisma as any).pdf_translation_jobs.update({
    where: { id: jobId },
    data: { status: "cancelling", message: "Cancelling..." },
  });

  return NextResponse.json({ success: true });
}