import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUserSession: vi.fn(),
  recordUserActivity: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api-auth", () => ({
  requireUserSession: mocks.requireUserSession,
}));
vi.mock("@/lib/user-activity", () => ({
  recordUserActivity: mocks.recordUserActivity,
}));

import { POST } from "@/app/api/tracking/log/route";

function request(body: BodyInit | null, headers: HeadersInit = {}) {
  return new NextRequest("http://localhost/api/tracking/log", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
      ...headers,
    },
    body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUserSession.mockResolvedValue({
    session: { user: { id: "7" } },
    userId: 7,
  });
  mocks.recordUserActivity.mockResolvedValue(true);
});

describe("activity tracking route", () => {
  it("records a validated activity", async () => {
    const response = await POST(request(JSON.stringify({
      action: "view_event",
      resource_type: "event",
      resource_id: "42",
      details: "/esg/events/42",
    }), { "user-agent": "test-agent" }));

    expect(response.status).toBe(200);
    expect(mocks.recordUserActivity).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      action: "view_event",
      resourceType: "event",
      resourceId: 42,
      details: "/esg/events/42",
      userAgent: "test-agent",
    }));
  });

  it.each([
    ["an empty body", null],
    ["a blank body", "   "],
    ["truncated JSON", '{"action":'],
  ])("rejects %s without recording", async (_name, body) => {
    const response = await POST(request(body));

    expect(response.status).toBe(400);
    expect(mocks.recordUserActivity).not.toHaveBeenCalled();
  });

  it.each([null, [], "activity", 42, { unexpected: true }])(
    "rejects an invalid JSON value %#",
    async (body) => {
      const response = await POST(request(JSON.stringify(body)));

      expect(response.status).toBe(400);
      expect(mocks.recordUserActivity).not.toHaveBeenCalled();
    },
  );

  it("rejects unsupported content types before parsing", async () => {
    const response = await POST(request("action=view_page", {
      "content-type": "application/x-www-form-urlencoded",
    }));

    expect(response.status).toBe(415);
    expect(mocks.recordUserActivity).not.toHaveBeenCalled();
  });

  it("rejects oversized payloads", async () => {
    const response = await POST(request(JSON.stringify({
      action: "view_page",
      resource_type: "page",
      details: "x".repeat(9_000),
    })));

    expect(response.status).toBe(413);
    expect(mocks.recordUserActivity).not.toHaveBeenCalled();
  });

  it("authenticates before reading an invalid body", async () => {
    mocks.requireUserSession.mockResolvedValueOnce({
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await POST(request(null));

    expect(response.status).toBe(401);
    expect(mocks.recordUserActivity).not.toHaveBeenCalled();
  });

  it("returns a service error when persistence fails", async () => {
    mocks.recordUserActivity.mockResolvedValueOnce(false);

    const response = await POST(request(JSON.stringify({
      action: "view_page",
      resource_type: "page",
      path: "/admin/events-email-alerts",
    })));

    expect(response.status).toBe(503);
  });
});
