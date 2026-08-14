import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/api-auth";
import { loadEsgEventDigestAdminSnapshot } from "@/lib/esg-events/digest-admin";
import { parseEsgEventDigestAdminQuery } from "@/lib/esg-events/digest-admin-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (auth.response) return auth.response;

  const filters = parseEsgEventDigestAdminQuery(request.nextUrl.searchParams);
  if (!filters) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }
  try {
    const snapshot = await loadEsgEventDigestAdminSnapshot(filters);
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    console.error("[admin] Failed to load ESG event email alerts", error);
    return NextResponse.json(
      { error: "Failed to load ESG event email alerts" },
      { status: 500 },
    );
  }
}
