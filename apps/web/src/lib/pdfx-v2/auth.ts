import "server-only";

import { NextResponse } from "next/server";
import { ensureUserId } from "@/lib/session-user";

export type PdfxUserResult =
  | { userId: number; response?: never }
  | { userId?: never; response: NextResponse };

export async function requirePdfxUser(): Promise<PdfxUserResult> {
  const userId = await ensureUserId();
  return userId
    ? { userId }
    : { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
}
