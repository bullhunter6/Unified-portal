import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const responses: unknown[][] = [];
  const sql: string[] = [];
  const values: unknown[][] = [];
  const queryRaw = vi.fn(
    async (strings: TemplateStringsArray, ...parameters: unknown[]): Promise<unknown[]> => {
      sql.push(strings.join("?"));
      values.push(parameters);
      return responses.shift() ?? [];
    },
  );
  const transaction = vi.fn(
    async (callback: (client: { $queryRaw: typeof queryRaw }) => Promise<unknown>) =>
      callback({ $queryRaw: queryRaw }),
  );
  return { queryRaw, responses, sql, transaction, values };
});

vi.mock("@esgcredit/db-esg", () => ({
  esgPrisma: {
    $queryRaw: mocks.queryRaw,
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/config/env", () => ({ env: {} }));

beforeEach(() => {
  mocks.responses.length = 0;
  mocks.sql.length = 0;
  mocks.values.length = 0;
  vi.clearAllMocks();
});

describe("enqueueEmailWithHistory", () => {
  it("preserves existing user-owned callers that do not supply a delivery key", async () => {
    mocks.responses.push([{ id: 12 }], [{ id: 22 }]);
    const { enqueueEmailWithHistory } = await import("./email-queue");

    const result = await enqueueEmailWithHistory({
      userId: 7,
      to: "user@example.com",
      subject: "Existing alert",
      text: "Plain text",
      domain: "esg",
      alertType: "weekly_digest",
    });

    expect(result).toEqual({ queueId: 22, historyId: 12, deduplicated: false });
    expect(mocks.values[0]).toContain(7);
    expect(mocks.values[0]).toContain(null);
  });

  it("queues a system-owned email and records its permanent delivery key", async () => {
    mocks.responses.push([{ id: 41 }], [{ id: 91 }]);
    const { enqueueEmailWithHistory } = await import("./email-queue");

    const result = await enqueueEmailWithHistory({
      userId: null,
      to: "recipient@example.com",
      subject: "This week's ESG events",
      text: "Plain text",
      html: "<p>HTML</p>",
      domain: "esg",
      alertType: "event_digest",
      contentType: "event",
      contentIds: [7, 8],
      totalItems: 2,
      deliveryKey: "esg-events:2026-08-10:recipient@example.com",
      templateVersion: "v1",
      jobId: "esg-events:2026-08-10",
      metadata: { weekStart: "2026-08-10" },
    });

    expect(result).toEqual({ queueId: 91, historyId: 41, deduplicated: false });
    expect(mocks.sql[0]).toContain("delivery_key");
    expect(mocks.sql[0]).toContain("ON CONFLICT DO NOTHING");
    expect(mocks.values[0]).toContain(null);
    expect(mocks.values[0]).toContain("esg-events:2026-08-10:recipient@example.com");
    expect(mocks.values[1]).toContain('{"weekStart":"2026-08-10"}');
  });

  it("returns the existing queue when a delivery key was already enqueued", async () => {
    mocks.responses.push([], [{ id: 41 }], [{ id: 91 }]);
    const { enqueueEmailWithHistory } = await import("./email-queue");

    const result = await enqueueEmailWithHistory({
      userId: null,
      to: "recipient@example.com",
      subject: "This week's ESG events",
      text: "Plain text",
      domain: "esg",
      alertType: "event_digest",
      deliveryKey: "esg-events:2026-08-10:recipient@example.com",
    });

    expect(result).toEqual({ queueId: 91, historyId: 41, deduplicated: true });
    expect(mocks.sql).toHaveLength(3);
    expect(mocks.sql[1]).toContain("WHERE delivery_key =");
    expect(mocks.sql[2]).toContain("WHERE alert_history_id =");
  });

  it("remains deduplicated after the old queue row has been cleaned up", async () => {
    mocks.responses.push([], [{ id: 41 }], []);
    const { enqueueEmailWithHistory } = await import("./email-queue");

    const result = await enqueueEmailWithHistory({
      userId: null,
      to: "recipient@example.com",
      subject: "This week's ESG events",
      text: "Plain text",
      domain: "esg",
      alertType: "event_digest",
      deliveryKey: "esg-events:2026-08-10:recipient@example.com",
    });

    expect(result).toEqual({ queueId: null, historyId: 41, deduplicated: true });
  });

  it("rejects malformed ownership and delivery identifiers before opening a transaction", async () => {
    const { enqueueEmailWithHistory } = await import("./email-queue");
    const base = {
      to: "recipient@example.com",
      subject: "Digest",
      text: "Digest",
      domain: "esg",
      alertType: "event_digest",
    };

    await expect(enqueueEmailWithHistory({ ...base, userId: 0 })).rejects.toThrow(
      "userId must be a positive integer or null",
    );
    await expect(
      enqueueEmailWithHistory({ ...base, userId: null, deliveryKey: " " }),
    ).rejects.toThrow("deliveryKey must contain 1-180 characters");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("markEmailAsSent", () => {
  it("clears stale retry errors and persists attempts into durable history", async () => {
    mocks.responses.push([{ id: 91 }]);
    const { markEmailAsSent } = await import("./email-queue");

    await expect(markEmailAsSent(91, "worker-1", "provider-message-7"))
      .resolves.toBe(true);

    expect(mocks.sql[0]).toContain("last_error = NULL");
    expect(mocks.sql[0]).toContain("RETURNING id, alert_history_id, attempts");
    expect(mocks.sql[0]).toContain("error_message = NULL");
    expect(mocks.sql[0]).toContain("retry_count = sent.attempts");
    expect(mocks.values[0]).toEqual(["provider-message-7", 91, "worker-1"]);
  });
});
