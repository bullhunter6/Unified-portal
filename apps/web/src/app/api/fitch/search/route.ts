import { NextResponse } from "next/server";
import { searchCompanyCached } from "@/lib/fitch";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = (searchParams.get("name") ?? "").trim();
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

  try {
    const { company, fromCache } = await searchCompanyCached(name);
    if (!company) return NextResponse.json({ company: null, fromCache });
    return NextResponse.json({ company, fromCache });
  } catch (e: any) {
    console.error("Fitch search error:", e);
    return NextResponse.json({ error: e.message || "Search failed" }, { status: 500 });
  }
}