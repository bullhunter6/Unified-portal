import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/api-auth";
import { enforceApiUsage } from "@/lib/api-usage";
import { requireSameOriginJson } from "@/lib/admin-mutation";
import {
  createEsgEventDigestRecipient,
  DuplicateEsgEventDigestRecipientError,
  EsgEventDigestRecipientLimitError,
} from "@/lib/esg-events/digest-recipients";
import { recordUserActivity } from "@/lib/user-activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().trim().max(254).email()
    .transform((value) => value.toLocaleLowerCase("en")),
}).strict();

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (auth.response) return auth.response;
  const requestError = requireSameOriginJson(request);
  if (requestError) return requestError;

  const adminId = Number(auth.session.user.id);
  const limited = await enforceApiUsage(request, {
    feature: "admin_event_digest_recipients",
    userId: adminId,
    perMinute: 10,
    perDay: 100,
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  try {
    const recipient = await createEsgEventDigestRecipient({
      email: parsed.data.email,
      adminUserId: adminId,
    });
    await recordUserActivity({
      userId: adminId,
      action: "event_digest_recipient_added",
      resourceType: "esg_event_digest_recipient",
      resourceId: recipient.id,
      details: JSON.stringify({ email: recipient.email, startsOn: recipient.startsOn }),
      ipAddress: clientIp(request),
      userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
    });
    return NextResponse.json({ ok: true, recipient }, { status: 201 });
  } catch (error) {
    if (error instanceof DuplicateEsgEventDigestRecipientError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof EsgEventDigestRecipientLimitError || error instanceof RangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[admin] Failed to add ESG event digest recipient", error);
    return NextResponse.json({ error: "Failed to add recipient" }, { status: 500 });
  }
}

function clientIp(request: NextRequest): string | null {
  return request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim().slice(0, 45)
    || request.headers.get("x-real-ip")?.trim().slice(0, 45)
    || null;
}
