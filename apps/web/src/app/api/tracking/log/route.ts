import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserSession } from "@/lib/api-auth";
import { requireSameOriginJson } from "@/lib/admin-mutation";
import { recordUserActivity } from "@/lib/user-activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024;

const activityBodySchema = z.object({
  action: z.enum(["view_page", "view_article", "view_event"]),
  resource_type: z.enum(["page", "article", "event"]),
  resource_id: z.union([
    z.number().int().positive().max(2_147_483_647),
    z.string().regex(/^\d+$/).transform(Number)
      .refine((value) => Number.isSafeInteger(value) && value > 0 && value <= 2_147_483_647),
  ]).nullable().optional(),
  details: z.string().trim().min(1).max(2_048).nullable().optional(),
  path: z.string().trim().min(1).max(2_048).nullable().optional(),
}).strict().superRefine((value, context) => {
  if (!value.details && !value.path) {
    context.addIssue({
      code: "custom",
      message: "Activity details or path is required",
      path: ["details"],
    });
  }
});

export async function POST(request: NextRequest) {
  const auth = await requireUserSession();
  if (auth.response) return auth.response;

  const requestError = requireSameOriginJson(request);
  if (requestError) return requestError;

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Activity payload is too large" }, { status: 413 });
  }

  const rawBody = await request.text();
  if (!rawBody.trim()) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Activity payload is too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = activityBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid activity payload" }, { status: 400 });
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor
    ? forwardedFor.split(",", 1)[0]?.trim().slice(0, 45) || null
    : request.headers.get("x-real-ip")?.trim().slice(0, 45) || null;

  const success = await recordUserActivity({
    userId: auth.userId,
    action: parsed.data.action,
    resourceType: parsed.data.resource_type,
    resourceId: parsed.data.resource_id,
    details: parsed.data.details ?? parsed.data.path,
    ipAddress,
    userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
  });

  if (!success) {
    return NextResponse.json({ error: "Failed to log activity" }, { status: 503 });
  }

  return NextResponse.json({ success: true });
}
