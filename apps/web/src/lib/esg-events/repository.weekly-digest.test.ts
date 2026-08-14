import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEsgRequestClock } from "./dates";

const mocks = vi.hoisted(() => ({
  queryRawUnsafe: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@esgcredit/db-esg", () => ({
  esgPrisma: {
    $queryRawUnsafe: mocks.queryRawUnsafe,
  },
}));

const clock = createEsgRequestClock(new Date("2026-08-10T05:00:00.000Z"));

describe("listEsgWeeklyDigestEvents", () => {
  beforeEach(() => {
    mocks.queryRawUnsafe.mockReset();
  });

  it("rejects a non-Monday-Sunday window before querying", async () => {
    const { listEsgWeeklyDigestEvents } = await import("./repository");
    await expect(listEsgWeeklyDigestEvents({
      weekStart: "2026-08-11",
      weekEnd: "2026-08-17",
    }, clock)).rejects.toThrow(/start on Monday/);
    expect(mocks.queryRawUnsafe).not.toHaveBeenCalled();
  });

  it("loads every overlapping upcoming event without ledger pagination", async () => {
    mocks.queryRawUnsafe
      .mockResolvedValueOnce([
        { column_name: "country_code" },
        { column_name: "city" },
        { column_name: "attendance_mode" },
        { column_name: "timezone_iana" },
      ])
      .mockResolvedValueOnce([{ name: "Asia/Dubai" }])
      .mockResolvedValueOnce([{
        id: 42,
        external_id: "digest-event-42",
        event_name: "Circular economy forum",
        event_url: "https://events.example.test/circular",
        start_date: "2026-08-10",
        end_date: "2026-08-10",
        start_time: "08:30",
        end_time: "09:30",
        timezone_raw: "GST",
        timezone_iana: "Asia/Dubai",
        image_url: null,
        ticket_price: null,
        tickets_url: null,
        venue_name: "Forum Hall",
        venue_address: "Dubai",
        city: "Dubai",
        country_code: "AE",
        attendance_mode: "hybrid",
        organizer_name: "Circular Institute",
        organizer_url: null,
        summary: "A weekly digest fixture",
        tags: null,
        source: "Fixture Source",
        created_at: "2026-08-01T00:00:00",
      }]);

    const { listEsgWeeklyDigestEvents } = await import("./repository");
    const result = await listEsgWeeklyDigestEvents({
      weekStart: "2026-08-10",
      weekEnd: "2026-08-16",
    }, clock);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 42,
      countryCode: "AE",
      city: "Dubai",
      attendanceMode: "hybrid",
      temporal: { status: "happening-now", precision: "instant" },
    });

    const [sql, ...parameters] = mocks.queryRawUnsafe.mock.calls[2];
    expect(sql).toContain("COALESCE(e.start_date, e.end_date)");
    expect(sql).toContain("<= $4::date");
    expect(sql).toContain(">= $5::date");
    expect(sql).toContain("ORDER BY COALESCE(e.start_date, e.end_date) ASC NULLS LAST");
    expect(sql).not.toMatch(/\bLIMIT\b|\bOFFSET\b/);
    expect(parameters).toEqual([
      "2026-08-10",
      "2026-08-10T05:00:00.000Z",
      JSON.stringify({ "Asia/Dubai": true }),
      "2026-08-16",
      "2026-08-10",
    ]);
  });
});
