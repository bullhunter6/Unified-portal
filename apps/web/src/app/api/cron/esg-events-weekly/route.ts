import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/api-auth";
import {
  EsgWeeklyDigestQueueError,
  queueDueEsgEventsWeeklyDigest,
} from "@/lib/esg-events/weekly-digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function run(request: Request) {
  const authError = requireCronSecret(request);
  if (authError) return authError;

  try {
    const result = await queueDueEsgEventsWeeklyDigest(new Date());
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    if (error instanceof EsgWeeklyDigestQueueError) {
      return NextResponse.json(
        { ok: false, error: error.message, result: error.result },
        { status: 503 },
      );
    }
    console.error("[cron] ESG weekly events digest failed", error);
    return NextResponse.json(
      { ok: false, error: "Failed to queue the ESG weekly events digest" },
      { status: 500 },
    );
  }
}

/** Protected backstop for an external scheduler; the durable worker also runs this due-check. */
export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
