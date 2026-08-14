import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  requireCronSecret: vi.fn(),
  enforceApiUsage: vi.fn(),
  queueDue: vi.fn(),
  queueTest: vi.fn(),
  recordUserActivity: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api-auth", () => ({
  requireAdminSession: mocks.requireAdminSession,
  requireCronSecret: mocks.requireCronSecret,
}));
vi.mock("@/lib/api-usage", () => ({ enforceApiUsage: mocks.enforceApiUsage }));
vi.mock("@/lib/user-activity", () => ({
  recordUserActivity: mocks.recordUserActivity,
}));
vi.mock("@/lib/esg-events/weekly-digest", () => ({
  EsgWeeklyDigestQueueError: class EsgWeeklyDigestQueueError extends Error {},
  queueDueEsgEventsWeeklyDigest: mocks.queueDue,
  queueEsgEventsWeeklyDigest: mocks.queueTest,
}));

import { POST as testDigest } from "@/app/api/admin/test-esg-events-weekly-digest/route";
import { GET as runDigestCron } from "@/app/api/cron/esg-events-weekly/route";

const queuedResult = {
  status: "queued",
  mode: "test",
  weekStart: "2026-08-10",
  weekEnd: "2026-08-16",
  eventCount: 3,
  onlineCount: 1,
  otherCount: 2,
  deliveries: [],
};

beforeEach(() => {
  mocks.requireAdminSession.mockResolvedValue({
    session: { user: { id: "7", email: "admin@example.test" } },
  });
  mocks.requireCronSecret.mockReturnValue(null);
  mocks.enforceApiUsage.mockResolvedValue(null);
  mocks.queueDue.mockResolvedValue({ ...queuedResult, mode: "production" });
  mocks.queueTest.mockResolvedValue(queuedResult);
  mocks.recordUserActivity.mockResolvedValue(true);
});

function testEmailRequest(init: { body?: BodyInit | null; headers?: HeadersInit } = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  if (!headers.has("origin")) headers.set("origin", "http://localhost");
  return new NextRequest(
    "http://localhost/api/admin/test-esg-events-weekly-digest",
    {
      method: "POST",
      headers,
      body: init.body,
    },
  );
}

function definedHeaders(values: Record<string, string | undefined>): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(values)) {
    if (value !== undefined) headers.set(name, value);
  }
  return headers;
}

describe("ESG weekly digest routes", () => {
  it("requires an admin before queueing a test email", async () => {
    mocks.requireAdminSession.mockResolvedValueOnce({
      response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
    });

    const response = await testDigest(testEmailRequest());

    expect(response.status).toBe(403);
    expect(mocks.queueTest).not.toHaveBeenCalled();
  });

  it("rejects an attempted recipient override", async () => {
    const response = await testDigest(testEmailRequest({
      body: JSON.stringify({ to: "attacker@example.test" }),
    }));

    expect(response.status).toBe(400);
    expect(mocks.queueTest).not.toHaveBeenCalled();
  });

  it("uses only the server-configured test recipient path", async () => {
    const response = await testDigest(testEmailRequest({ body: "{}" }));

    expect(response.status).toBe(202);
    expect(mocks.queueTest).toHaveBeenCalledWith(expect.objectContaining({
      mode: "test",
      ownerUserId: 7,
    }));
    expect(mocks.queueTest.mock.calls[0][0]).not.toHaveProperty("to");
  });

  it.each([
    {
      name: "a missing JSON content type",
      headers: { origin: "http://localhost" },
      status: 415,
    },
    {
      name: "a missing origin",
      headers: { "content-type": "application/json" },
      status: 403,
    },
    {
      name: "a cross-origin request",
      headers: {
        "content-type": "application/json",
        origin: "https://attacker.example",
      },
      status: 403,
    },
  ])("rejects $name before rate limiting or queueing", async ({ headers, status }) => {
    const response = await testDigest(new NextRequest(
      "http://localhost/api/admin/test-esg-events-weekly-digest",
      { method: "POST", headers: definedHeaders(headers) },
    ));

    expect(response.status).toBe(status);
    expect(mocks.enforceApiUsage).not.toHaveBeenCalled();
    expect(mocks.queueTest).not.toHaveBeenCalled();
  });

  it("does not queue a test delivery after the admin test-email limit is reached", async () => {
    mocks.enforceApiUsage.mockResolvedValueOnce(
      NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 }),
    );

    const response = await testDigest(testEmailRequest());

    expect(response.status).toBe(429);
    expect(mocks.queueTest).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated cron call", async () => {
    mocks.requireCronSecret.mockReturnValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const response = await runDigestCron(new Request(
      "http://localhost/api/cron/esg-events-weekly",
    ));

    expect(response.status).toBe(401);
    expect(mocks.queueDue).not.toHaveBeenCalled();
  });

  it("runs the idempotent due-check for an authorized cron call", async () => {
    const response = await runDigestCron(new Request(
      "http://localhost/api/cron/esg-events-weekly",
    ));

    expect(response.status).toBe(200);
    expect(mocks.queueDue).toHaveBeenCalledOnce();
  });
});
