import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: {
    ESG_EVENTS_DIGEST_ENABLED: "true",
    ESG_EVENTS_DIGEST_TEST_RECIPIENT: " Test.Target@Example.COM ",
  },
  listRecipients: vi.fn(),
  queryRawUnsafe: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config/env", () => ({ env: mocks.env }));
vi.mock("@esgcredit/db-esg", () => ({
  esgPrisma: {
    $queryRawUnsafe: mocks.queryRawUnsafe,
    $queryRaw: mocks.queryRaw,
  },
}));
vi.mock("./digest-recipients", () => ({
  listEsgEventDigestRecipients: mocks.listRecipients,
}));

import {
  ESG_EVENT_DIGEST_DELIVERY_PAGE_SIZE,
  loadEsgEventDigestAdminSnapshot,
  type EsgEventDigestDeliveryFilters,
} from "./digest-admin";

type DeliveryRow = {
  id: number;
  email_to: string;
  total_items: number | null;
  email_status: string | null;
  created_at: Date;
  sent_at: Date | null;
  job_id: string | null;
  queue_status: string | null;
  attempts: number | null;
  retry_count: number | null;
  last_attempt_at: Date | null;
  last_error: string | null;
  error_message: string | null;
};

function deliveryRow(overrides: Partial<DeliveryRow> = {}): DeliveryRow {
  return {
    id: 1,
    email_to: "recipient@example.com",
    total_items: 4,
    email_status: "pending",
    created_at: new Date("2026-08-10T05:00:00.000Z"),
    sent_at: null,
    job_id: "esg-events-week:2026-08-10",
    queue_status: "queued",
    attempts: 0,
    retry_count: 0,
    last_attempt_at: null,
    last_error: null,
    error_message: null,
    ...overrides,
  };
}

const recipients = [
  {
    id: 1,
    email: "active@example.com",
    isActive: true,
    startsOn: "2026-08-10",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  },
  {
    id: 2,
    email: "paused@example.com",
    isActive: false,
    startsOn: "2026-08-10",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-02T00:00:00.000Z",
  },
];

function mockSnapshotReads(args: {
  rows?: DeliveryRow[];
  count?: number;
  attempted?: number;
  sent?: number;
  lastProductionSentAt?: Date | null;
} = {}): void {
  mocks.queryRawUnsafe
    .mockResolvedValueOnce(args.rows ?? [])
    .mockResolvedValueOnce([{ count: args.count ?? 0 }]);
  mocks.queryRaw.mockResolvedValueOnce([{
    attempted_30d: args.attempted ?? 0,
    sent_30d: args.sent ?? 0,
    last_production_sent_at: args.lastProductionSentAt ?? null,
  }]);
}

beforeEach(() => {
  mocks.listRecipients.mockReset();
  mocks.queryRawUnsafe.mockReset();
  mocks.queryRaw.mockReset();
  mocks.env.ESG_EVENTS_DIGEST_ENABLED = "true";
  mocks.env.ESG_EVENTS_DIGEST_TEST_RECIPIENT = " Test.Target@Example.COM ";
  mocks.listRecipients.mockResolvedValue(recipients);
});

describe("ESG event digest admin monitoring", () => {
  it("keeps sent and failed history useful after queue cleanup", async () => {
    mockSnapshotReads({
      rows: [
        deliveryRow({
          id: 11,
          email_to: "sent@example.com",
          email_status: "sent",
          sent_at: new Date("2026-08-10T05:00:05.000Z"),
          queue_status: null,
          attempts: null,
          retry_count: 2,
        }),
        deliveryRow({
          id: 12,
          email_to: "failed@example.com",
          email_status: "failed",
          job_id: "test:esg-events-week:2026-08-10",
          queue_status: null,
          attempts: null,
          retry_count: 3,
          error_message: "SMTP rejected the recipient",
        }),
      ],
      count: 2,
    });

    const snapshot = await loadEsgEventDigestAdminSnapshot({ page: 1 });

    expect(snapshot.deliveries).toEqual([
      expect.objectContaining({
        id: 11,
        recipient: "sent@example.com",
        mode: "production",
        weekStart: "2026-08-10",
        status: "sent",
        attempts: 2,
        sentAt: "2026-08-10T05:00:05.000Z",
        error: null,
      }),
      expect.objectContaining({
        id: 12,
        recipient: "failed@example.com",
        mode: "test",
        weekStart: "2026-08-10",
        status: "failed",
        attempts: 3,
        error: "SMTP rejected the recipient",
      }),
    ]);
  });

  it("gives a recognized live queue state and diagnostics precedence over history", async () => {
    mockSnapshotReads({
      rows: [deliveryRow({
        email_status: "failed",
        retry_count: 3,
        error_message: "persistent terminal failure",
        queue_status: "processing",
        attempts: 4,
        last_attempt_at: new Date("2026-08-10T05:02:00.000Z"),
        last_error: "worker retry in progress",
      })],
      count: 1,
    });

    const snapshot = await loadEsgEventDigestAdminSnapshot({ page: 1 });

    expect(snapshot.deliveries[0]).toMatchObject({
      status: "processing",
      attempts: 4,
      lastAttemptAt: "2026-08-10T05:02:00.000Z",
      error: "worker retry in progress",
    });
  });

  it("binds status and escaped recipient search without interpolating user input", async () => {
    const filters: EsgEventDigestDeliveryFilters = {
      page: 3,
      status: "failed",
      mode: "test",
      recipient: "ops%_team'@example.com",
    };
    mockSnapshotReads();

    await loadEsgEventDigestAdminSnapshot(filters);

    const [rowsSql, ...rowValues] = mocks.queryRawUnsafe.mock.calls[0];
    const [countSql, ...countValues] = mocks.queryRawUnsafe.mock.calls[1];
    expect(rowsSql).toContain("h.job_id LIKE 'test:esg-events-week:%'");
    expect(rowsSql).toContain("= $1::text");
    expect(rowsSql).toContain("ILIKE $2::text ESCAPE '\\'");
    expect(rowsSql).toContain("LIMIT $3::int OFFSET $4::int");
    expect(rowsSql).not.toContain(filters.recipient);
    expect(rowValues).toEqual([
      "failed",
      "%ops\\%\\_team'@example.com%",
      ESG_EVENT_DIGEST_DELIVERY_PAGE_SIZE,
      2 * ESG_EVENT_DIGEST_DELIVERY_PAGE_SIZE,
    ]);
    expect(countSql).toContain("= $1::text");
    expect(countSql).toContain("ILIKE $2::text ESCAPE '\\'");
    expect(countValues).toEqual(rowValues.slice(0, 2));
  });

  it.each([
    ["production", "h.job_id LIKE 'esg-events-week:%'"],
    ["test", "h.job_id LIKE 'test:esg-events-week:%'"],
  ] as const)("applies the safe %s mode predicate to rows and totals", async (mode, predicate) => {
    mockSnapshotReads();

    await loadEsgEventDigestAdminSnapshot({ page: 1, mode });

    expect(mocks.queryRawUnsafe.mock.calls[0][0]).toContain(predicate);
    expect(mocks.queryRawUnsafe.mock.calls[1][0]).toContain(predicate);
    expect(mocks.queryRawUnsafe.mock.calls[0].slice(1)).toEqual([
      ESG_EVENT_DIGEST_DELIVERY_PAGE_SIZE,
      0,
    ]);
    expect(mocks.queryRawUnsafe.mock.calls[1].slice(1)).toEqual([]);
  });

  it("maps persistent totals, pages, recipients, metrics, and environment state", async () => {
    const lastSent = new Date("2026-08-10T05:03:00.000Z");
    mockSnapshotReads({
      rows: [deliveryRow({ total_items: null, job_id: "unrecognized-job" })],
      count: 41,
      attempted: 9,
      sent: 8,
      lastProductionSentAt: lastSent,
    });

    const snapshot = await loadEsgEventDigestAdminSnapshot({ page: 3 });

    expect(snapshot).toMatchObject({
      recipients,
      totalDeliveries: 41,
      totalPages: 3,
      activeRecipients: 1,
      successfulLast30Days: 8,
      attemptedLast30Days: 9,
      lastProductionSentAt: lastSent.toISOString(),
      testRecipient: "test.target@example.com",
      scheduleEnabled: true,
    });
    expect(snapshot.deliveries[0]).toMatchObject({
      weekStart: null,
      eventCount: 0,
      mode: "production",
    });
    expect(mocks.queryRawUnsafe.mock.calls[0].slice(-2)).toEqual([
      ESG_EVENT_DIGEST_DELIVERY_PAGE_SIZE,
      2 * ESG_EVENT_DIGEST_DELIVERY_PAGE_SIZE,
    ]);
  });

  it("keeps an empty ledger on page one and reports disabled configuration", async () => {
    mocks.env.ESG_EVENTS_DIGEST_ENABLED = "false";
    mocks.env.ESG_EVENTS_DIGEST_TEST_RECIPIENT = "";
    mockSnapshotReads();

    const snapshot = await loadEsgEventDigestAdminSnapshot({ page: 1 });

    expect(snapshot.totalDeliveries).toBe(0);
    expect(snapshot.totalPages).toBe(1);
    expect(snapshot.deliveries).toEqual([]);
    expect(snapshot.scheduleEnabled).toBe(false);
    expect(snapshot.testRecipient).toBe("");
  });
});
