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

  const items = await (prisma as any).pdf_translation_jobs.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      filename: true,
      status: true,
      progress: true,
      message: true,
      total_pages: true,
      created_at: true,
      updated_at: true,
    },
    take: 50,
  });

  return NextResponse.json({ success: true, items });
}