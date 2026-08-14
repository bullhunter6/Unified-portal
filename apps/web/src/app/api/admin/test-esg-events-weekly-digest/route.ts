import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/api-auth";
import { enforceApiUsage } from "@/lib/api-usage";
import { requireSameOriginJson } from "@/lib/admin-mutation";
import { recordUserActivity } from "@/lib/user-activity";
import {
  EsgWeeklyDigestQueueError,
  queueEsgEventsWeeklyDigest,
} from "@/lib/esg-events/weekly-digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Queues a test copy only to ESG_EVENTS_DIGEST_TEST_RECIPIENT. */
export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (auth.response) return auth.response;
  const requestError = requireSameOriginJson(request);
  if (requestError) return requestError;

  const adminId = Number(auth.session.user.id);
  if (!Number.isSafeInteger(adminId) || adminId <= 0) {
    return NextResponse.json({ error: "Invalid admin session" }, { status: 401 });
  }
  const limited = await enforceApiUsage(request, {
    feature: "admin_test_email",
    userId: adminId,
    perMinute: 2,
    perDay: 20,
  });
  if (limited) return limited;

  const rawBody = await request.text();
  if (rawBody.trim()) {
    try {
      const body: unknown = JSON.parse(rawBody);
      if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length > 0) {
        return NextResponse.json({ error: "This test endpoint does not accept recipients" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  }

  try {
    const result = await queueEsgEventsWeeklyDigest({
      mode: "test",
      now: new Date(),
      ownerUserId: adminId,
    });
    await recordUserActivity({
      userId: adminId,
      action: "event_digest_test_queued",
      resourceType: "esg_event_digest",
      details: JSON.stringify({
        weekStart: result.weekStart,
        eventCount: result.eventCount,
        recipients: result.deliveries.map((delivery) => delivery.recipient),
      }),
      ipAddress: request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim().slice(0, 45)
        ?? request.headers.get("x-real-ip")?.trim().slice(0, 45)
        ?? null,
      userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
    });
    return NextResponse.json({
      ok: true,
      message: "ESG weekly events test email queued",
      result,
    }, { status: 202 });
  } catch (error) {
    if (error instanceof EsgWeeklyDigestQueueError) {
      return NextResponse.json(
        { ok: false, error: error.message, result: error.result },
        { status: 503 },
      );
    }
    console.error("[admin] ESG weekly events test digest failed", error);
    return NextResponse.json(
      { ok: false, error: "Failed to queue the ESG weekly events test email" },
      { status: 500 },
    );
  }
}
