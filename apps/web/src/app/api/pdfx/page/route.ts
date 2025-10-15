import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";

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
  const page = Number(req.nextUrl.searchParams.get("page") || 1);

  const row = await (prisma as any).pdf_translation_jobs.findUnique({ where: { id: jobId } });
  if (!row || row.user_id !== userId)
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  const list = (row.translated_pages as any[]) || [];
  const item = list.find((p) => p?.page_number === page) || null;

  return NextResponse.json({
    success: true,
    page,
    originalText: item?.original_text ?? "",
    translatedText: item?.translated_text ?? "",
  });
}