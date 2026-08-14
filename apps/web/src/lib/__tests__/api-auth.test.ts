import { afterEach, describe, expect, it, vi } from "vitest";

type MockSession = {
  role?: string;
  is_admin?: boolean;
  user?: {
    email?: string;
    id?: string;
    role?: string;
    is_admin?: boolean;
    team?: string;
  };
};

async function loadApiAuth({
  cronSecret = "cron-secret",
  dbUser = null,
  session = null,
}: {
  cronSecret?: string;
  dbUser?: { is_admin: boolean | null; is_active_db: boolean } | null;
  session?: MockSession | null;
} = {}) {
  vi.resetModules();
  vi.stubEnv("CRON_SECRET", cronSecret);

  const findUnique = vi.fn().mockResolvedValue(dbUser);
  const getServerSession = vi.fn().mockResolvedValue(session);

  vi.doMock("server-only", () => ({}));
  vi.doMock("next-auth", () => ({ getServerSession }));
  vi.doMock("@/lib/nextauth-options", () => ({ authOptions: {} }));
  vi.doMock("@esgcredit/db-esg", () => ({
    esgPrisma: {
      users: {
        findUnique,
      },
    },
  }));

  const mod = await import("@/lib/api-auth");
  return { ...mod, findUnique, getServerSession };
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("api auth guards", () => {
  it("requireSession returns 401 when there is no session", async () => {
    const { requireSession } = await loadApiAuth({ session: null });

    const result = await requireSession();

    expect(result.response?.status).toBe(401);
    await expect(readJson(result.response!)).resolves.toEqual({ error: "Unauthorized" });
  });

  it("requireSession returns the current session when authenticated", async () => {
    const session = { user: { id: "42", email: "user@example.com" } };
    const { requireSession } = await loadApiAuth({ session });

    const result = await requireSession();

    expect(result.session).toBe(session);
  });

  it("requireUserSession derives a positive numeric user id from the session", async () => {
    const session = { user: { id: "42", email: "user@example.com" } };
    const { requireUserSession } = await loadApiAuth({ session });

    const result = await requireUserSession();

    expect(result.session).toBe(session);
    expect(result.userId).toBe(42);
  });

  it("requireUserSession rejects missing or non-numeric user ids", async () => {
    const { requireUserSession } = await loadApiAuth({
      session: { user: { id: "not-a-number", email: "user@example.com" } },
    });

    const result = await requireUserSession();

    expect(result.response?.status).toBe(401);
  });

  it("requireEmailSession returns a trimmed authenticated email", async () => {
    const session = { user: { id: "42", email: " user@example.com " } };
    const { requireEmailSession } = await loadApiAuth({ session });

    const result = await requireEmailSession();

    expect(result.session).toBe(session);
    expect(result.email).toBe("user@example.com");
  });

  it("requireEmailSession rejects sessions without an email", async () => {
    const { requireEmailSession } = await loadApiAuth({
      session: { user: { id: "42" } },
    });

    const result = await requireEmailSession();

    expect(result.response?.status).toBe(401);
  });

  it("requireAdminSession verifies an admin against current database state", async () => {
    const session = { role: "admin", user: { id: "42", email: "admin@example.com" } };
    const { findUnique, requireAdminSession } = await loadApiAuth({
      dbUser: { is_admin: true, is_active_db: true },
      session,
    });

    const result = await requireAdminSession();

    expect(result.session).toBe(session);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 42 },
      select: { is_admin: true, is_active_db: true },
    });
  });

  it("requireAdminSession returns 403 when a cached admin has been demoted", async () => {
    const session = {
      role: "admin",
      is_admin: true,
      user: { id: "42", email: "user@example.com", role: "admin", is_admin: true },
    };
    const { requireAdminSession } = await loadApiAuth({
      dbUser: { is_admin: false, is_active_db: true },
      session,
    });

    const result = await requireAdminSession();

    expect(result.response?.status).toBe(403);
    await expect(readJson(result.response!)).resolves.toEqual({
      error: "Admin access required",
    });
  });

  it("requireAdminSession returns 401 for a deleted or inactive admin", async () => {
    const session = { role: "admin", user: { id: "42", email: "admin@example.com" } };

    const deleted = await loadApiAuth({ dbUser: null, session });
    const deletedResult = await deleted.requireAdminSession();
    expect(deletedResult.response?.status).toBe(401);

    const inactive = await loadApiAuth({
      dbUser: { is_admin: true, is_active_db: false },
      session,
    });
    const inactiveResult = await inactive.requireAdminSession();
    expect(inactiveResult.response?.status).toBe(401);
  });

  it("requireCronSecret accepts the configured bearer token", async () => {
    const { requireCronSecret } = await loadApiAuth({ cronSecret: " cron-secret " });
    const request = new Request("http://localhost/api/cron", {
      headers: { authorization: "Bearer cron-secret" },
    });

    expect(requireCronSecret(request)).toBeNull();
  });

  it("requireCronSecret returns 401 for an invalid bearer token", async () => {
    const { requireCronSecret } = await loadApiAuth({ cronSecret: "cron-secret" });
    const request = new Request("http://localhost/api/cron", {
      headers: { authorization: "Bearer wrong-secret" },
    });

    const response = requireCronSecret(request);

    expect(response?.status).toBe(401);
    await expect(readJson(response!)).resolves.toEqual({ error: "Unauthorized" });
  });

  it("requireCronSecret fails closed when the cron secret is missing", async () => {
    const { requireCronSecret } = await loadApiAuth({ cronSecret: "" });
    const request = new Request("http://localhost/api/cron", {
      headers: { authorization: "Bearer anything" },
    });

    const response = requireCronSecret(request);

    expect(response?.status).toBe(500);
    await expect(readJson(response!)).resolves.toEqual({
      error: "Server misconfiguration",
    });
  });
});
