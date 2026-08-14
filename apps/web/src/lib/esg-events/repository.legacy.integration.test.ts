import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createEsgRequestClock } from "./dates";

const enabled = process.env.RUN_LEGACY_DB_INTEGRATION_TESTS === "1";
const integration = enabled ? describe : describe.skip;
vi.mock("server-only", () => ({}));

const marker = `ESG_LEDGER_LEGACY_${process.pid}`;
let prisma: (typeof import("@esgcredit/db-esg"))["esgPrisma"] | undefined;

integration("ESG event ledger legacy-schema compatibility", () => {
  beforeAll(async () => {
    ({ esgPrisma: prisma } = await import("@esgcredit/db-esg"));
    await prisma.$executeRaw`
      INSERT INTO events (
        event_id, event_name, event_url, start_date, end_date, start_time,
        end_time, timezone, venue_name, venue_address, organizer_name,
        summary, source
      ) VALUES (
        ${marker}, ${`${marker} Climate forum`},
        'https://events.example.test/legacy', '2099-08-30'::date,
        '2099-09-02'::date, '09:00'::time, '17:00'::time, 'GST',
        'Legacy Hall', 'Dubai, UAE', 'Legacy Institute',
        'A pre-migration event row', 'Legacy Source'
      )
    `;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.$executeRaw`DELETE FROM events WHERE event_id = ${marker}`;
    await prisma.$disconnect();
  });

  it("derives reachable location and format facets without normalized columns", async () => {
    const { listEsgEvents } = await import("./repository");
    const result = await listEsgEvents(
      { when: "upcoming", q: marker, page: 1 },
      createEsgRequestClock(new Date("2026-08-04T08:00:00.000Z")),
    );

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      countryCode: "AE",
      city: "Dubai",
      attendanceMode: "in_person",
      timezoneIana: null,
    });
    expect(result.facets.countries).toEqual([
      { value: "AE", label: "United Arab Emirates", count: 1 },
    ]);
    expect(result.facets.cities).toEqual([
      { value: "Dubai", label: "Dubai", count: 1 },
    ]);
    expect(result.facets.formats).toEqual([
      { value: "in-person", label: "In person", count: 1 },
    ]);
    expect(result.summary.representedCountries).toBe(1);

    const reachable = await listEsgEvents(
      {
        when: "upcoming",
        q: marker,
        country: "AE",
        city: "Dubai",
        format: "in-person",
        page: 1,
      },
      createEsgRequestClock(new Date("2026-08-04T08:00:00.000Z")),
    );
    expect(reachable.total).toBe(1);
  });
});
