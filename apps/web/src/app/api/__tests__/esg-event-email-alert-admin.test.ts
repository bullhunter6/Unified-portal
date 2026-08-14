import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createRecipient: vi.fn(),
  enforceApiUsage: vi.fn(),
  loadSnapshot: vi.fn(),
  recordUserActivity: vi.fn(),
  requireAdminSession: vi.fn(),
  setRecipientActive: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api-auth", () => ({
  requireAdminSession: mocks.requireAdminSession,
}));
vi.mock("@/lib/api-usage", () => ({
  enforceApiUsage: mocks.enforceApiUsage,
}));
vi.mock("@/lib/user-activity", () => ({
  recordUserActivity: mocks.recordUserActivity,
}));
vi.mock("@/lib/esg-events/digest-admin", () => ({
  ESG_EVENT_DIGEST_DELIVERY_MODES: ["production", "test"],
  ESG_EVENT_DIGEST_DELIVERY_STATUSES: ["queued", "processing", "sent", "failed"],
  loadEsgEventDigestAdminSnapshot: mocks.loadSnapshot,
}));
vi.mock("@/lib/esg-events/digest-recipients", () => ({
  createEsgEventDigestRecipient: mocks.createRecipient,
  setEsgEventDigestRecipientActive: mocks.setRecipientActive,
  DuplicateEsgEventDigestRecipientError: class DuplicateEsgEventDigestRecipientError extends Error {},
  EsgEventDigestRecipientLimitError: class EsgEventDigestRecipientLimitError extends Error {},
  StaleEsgEventDigestRecipientError: class StaleEsgEventDigestRecipientError extends Error {},
}));

import { GET as getAlertAdmin } from "@/app/api/admin/esg-event-email-alerts/route";
import { POST as createRecipient } from "@/app/api/admin/esg-event-email-alerts/recipients/route";
import { PATCH as updateRecipient } from "@/app/api/admin/esg-event-email-alerts/recipients/[id]/route";

const recipient = {
  id: 12,
  email: "ops@example.com",
  isActive: true,
  startsOn: "2026-08-17",
  createdAt: "2026-08-13T08:00:00.000Z",
  updatedAt: "2026-08-13T08:00:00.000Z",
};

function jsonRequest(url: string, method: "POST" | "PATCH", body: BodyInit | null) {
  return new NextRequest(url, {
    method,
    headers: {
      "content-type": "application/json",
      origin: new URL(url).origin,
    },
    body,
  });
}

function denied() {
  return {
    response: NextResponse.json(
      { error: "Admin access required" },
      { status: 403 },
    ),
  };
}

function definedHeaders(values: Record<string, string | undefined>): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(values)) {
    if (value !== undefined) headers.set(name, value);
  }
  return headers;
}

beforeEach(() => {
  mocks.requireAdminSession.mockResolvedValue({
    session: { user: { id: "7", email: "admin@example.test" } },
  });
  mocks.enforceApiUsage.mockResolvedValue(null);
  mocks.loadSnapshot.mockResolvedValue({ deliveries: [], recipients: [] });
  mocks.createRecipient.mockResolvedValue(recipient);
  mocks.setRecipientActive.mockResolvedValue(recipient);
  mocks.recordUserActivity.mockResolvedValue(true);
});

describe("ESG event email-alert admin read route", () => {
  it("checks current database admin access before loading alert data", async () => {
    mocks.requireAdminSession.mockResolvedValueOnce(denied());

    const response = await getAlertAdmin(new NextRequest(
      "http://localhost/api/admin/esg-event-email-alerts",
    ));

    expect(response.status).toBe(403);
    expect(mocks.loadSnapshot).not.toHaveBeenCalled();
  });

  it.each([
    "page=1&page=2",
    "page=1e2",
    "status=cancelled",
    "mode=preview",
    "unknown=true",
  ])("rejects malformed query state before loading data: %s", async (query) => {
    const response = await getAlertAdmin(new NextRequest(
      `http://localhost/api/admin/esg-event-email-alerts?${query}`,
    ));

    expect(response.status).toBe(400);
    expect(mocks.loadSnapshot).not.toHaveBeenCalled();
  });

  it("passes validated filters to the monitoring query", async () => {
    const response = await getAlertAdmin(new NextRequest(
      "http://localhost/api/admin/esg-event-email-alerts?page=2&status=failed&mode=test&recipient=ops",
    ));

    expect(response.status).toBe(200);
    expect(mocks.loadSnapshot).toHaveBeenCalledWith({
      page: 2,
      status: "failed",
      mode: "test",
      recipient: "ops",
    });
  });
});

describe("ESG event digest recipient creation route", () => {
  const endpoint = "http://localhost/api/admin/esg-event-email-alerts/recipients";

  it("checks current database admin access before validating or mutating", async () => {
    mocks.requireAdminSession.mockResolvedValueOnce(denied());

    const response = await createRecipient(jsonRequest(
      endpoint,
      "POST",
      JSON.stringify({ email: "ops@example.com" }),
    ));

    expect(response.status).toBe(403);
    expect(mocks.enforceApiUsage).not.toHaveBeenCalled();
    expect(mocks.createRecipient).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "non-JSON content",
      headers: { origin: "http://localhost", "content-type": "text/plain" },
      status: 415,
    },
    {
      name: "a missing origin",
      headers: { "content-type": "application/json" },
      status: 403,
    },
    {
      name: "a foreign origin",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      status: 403,
    },
  ])("rejects $name before consuming a mutation budget", async ({ headers, status }) => {
    const response = await createRecipient(new NextRequest(endpoint, {
      method: "POST",
      headers: definedHeaders(headers),
      body: JSON.stringify({ email: "ops@example.com" }),
    }));

    expect(response.status).toBe(status);
    expect(mocks.enforceApiUsage).not.toHaveBeenCalled();
    expect(mocks.createRecipient).not.toHaveBeenCalled();
  });

  it.each([
    { name: "invalid JSON", body: "{" },
    { name: "an array", body: "[]" },
    { name: "a missing email", body: "{}" },
    { name: "a non-string email", body: JSON.stringify({ email: 7 }) },
    { name: "an invalid email", body: JSON.stringify({ email: "not-an-email" }) },
    { name: "an email with CRLF", body: JSON.stringify({ email: "ops@example.com\r\nBcc:evil@example.com" }) },
    {
      name: "unknown fields",
      body: JSON.stringify({ email: "ops@example.com", isAdmin: true }),
    },
    { name: "an oversized email", body: JSON.stringify({ email: "a".repeat(256) }) },
  ])("rejects $name without invoking recipient creation", async ({ body }) => {
    const response = await createRecipient(jsonRequest(endpoint, "POST", body));

    expect(response.status).toBe(400);
    expect(mocks.createRecipient).not.toHaveBeenCalled();
  });

  it("does not mutate after the admin recipient-change limit is reached", async () => {
    mocks.enforceApiUsage.mockResolvedValueOnce(
      NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 }),
    );

    const response = await createRecipient(jsonRequest(
      endpoint,
      "POST",
      JSON.stringify({ email: "ops@example.com" }),
    ));

    expect(response.status).toBe(429);
    expect(mocks.createRecipient).not.toHaveBeenCalled();
  });

  it("passes only the validated email and authenticated admin id to the service", async () => {
    const response = await createRecipient(jsonRequest(
      endpoint,
      "POST",
      JSON.stringify({ email: " OPS@example.com " }),
    ));

    expect(response.status).toBe(201);
    expect(mocks.createRecipient).toHaveBeenCalledWith({
      email: "ops@example.com",
      adminUserId: 7,
    });
    expect(mocks.recordUserActivity).toHaveBeenCalledOnce();
  });
});

describe("ESG event digest recipient update route", () => {
  const endpoint = (id: string) =>
    `http://localhost/api/admin/esg-event-email-alerts/recipients/${id}`;
  const body = JSON.stringify({
    isActive: false,
    expectedUpdatedAt: recipient.updatedAt,
  });
  const context = (id: string) => ({ params: Promise.resolve({ id }) });

  it("checks current database admin access before updating", async () => {
    mocks.requireAdminSession.mockResolvedValueOnce(denied());

    const response = await updateRecipient(
      jsonRequest(endpoint("12"), "PATCH", body),
      context("12"),
    );

    expect(response.status).toBe(403);
    expect(mocks.setRecipientActive).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "non-JSON content",
      headers: { origin: "http://localhost", "content-type": "text/plain" },
      status: 415,
    },
    {
      name: "a missing origin",
      headers: { "content-type": "application/json" },
      status: 403,
    },
    {
      name: "a foreign origin",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      status: 403,
    },
  ])("rejects $name before updating a recipient", async ({ headers, status }) => {
    const response = await updateRecipient(
      new NextRequest(endpoint("12"), {
        method: "PATCH",
        headers: definedHeaders(headers),
        body,
      }),
      context("12"),
    );

    expect(response.status).toBe(status);
    expect(mocks.enforceApiUsage).not.toHaveBeenCalled();
    expect(mocks.setRecipientActive).not.toHaveBeenCalled();
  });

  it.each(["0", "-1", "01", "1.5", "1e2", "Infinity", "2147483648", "99999999999"])(
    "rejects malformed recipient id %s",
    async (id) => {
      const response = await updateRecipient(
        jsonRequest(endpoint(id), "PATCH", body),
        context(id),
      );

      expect(response.status).toBe(400);
      expect(mocks.enforceApiUsage).not.toHaveBeenCalled();
      expect(mocks.setRecipientActive).not.toHaveBeenCalled();
    },
  );

  it.each([
    { name: "invalid JSON", body: "{" },
    { name: "an empty object", body: "{}" },
    { name: "a string active flag", body: JSON.stringify({
      isActive: "false",
      expectedUpdatedAt: recipient.updatedAt,
    }) },
    { name: "a missing concurrency timestamp", body: JSON.stringify({ isActive: false }) },
    { name: "an invalid timestamp", body: JSON.stringify({
      isActive: false,
      expectedUpdatedAt: "yesterday",
    }) },
    { name: "unknown fields", body: JSON.stringify({
      isActive: false,
      expectedUpdatedAt: recipient.updatedAt,
      email: "attacker@example.com",
    }) },
  ])("rejects $name without invoking the update service", async ({ body: invalidBody }) => {
    const response = await updateRecipient(
      jsonRequest(endpoint("12"), "PATCH", invalidBody),
      context("12"),
    );

    expect(response.status).toBe(400);
    expect(mocks.setRecipientActive).not.toHaveBeenCalled();
  });

  it("passes a strict update and authenticated admin id to the service", async () => {
    const response = await updateRecipient(
      jsonRequest(endpoint("12"), "PATCH", body),
      context("12"),
    );

    expect(response.status).toBe(200);
    expect(mocks.setRecipientActive).toHaveBeenCalledWith({
      id: 12,
      isActive: false,
      expectedUpdatedAt: recipient.updatedAt,
      adminUserId: 7,
    });
    expect(mocks.recordUserActivity).toHaveBeenCalledOnce();
  });
});
