import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/config/env";

export function requireSameOriginJson(request: NextRequest): NextResponse | null {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim();
  if (contentType !== "application/json") {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }

  const origin = request.headers.get("origin");
  const allowed = new Set([request.nextUrl.origin]);
  try {
    allowed.add(new URL(env.NEXTAUTH_URL).origin);
  } catch {
    // Environment validation owns malformed NEXTAUTH_URL reporting elsewhere.
  }
  if (!origin || !allowed.has(origin)) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }
  return null;
}
