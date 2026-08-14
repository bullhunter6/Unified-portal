import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createEsgRequestClock } from "./dates";
import type { EsgEventFilters } from "./types";

const enabled = process.env.RUN_DB_INTEGRATION_TESTS === "1";
const integration = enabled ? describe : describe.skip;
vi.mock("server-only", () => ({}));
const marker = `ESG_LEDGER_INTEGRATION_${process.pid}`;
let prisma: (typeof import("@esgcredit/db-esg"))["esgPrisma"] | undefined;

const clock = createEsgRequestClock(new Date("2026-08-29T12:00:00.000Z"));
const filters = (overrides: Partial<EsgEventFilters> = {}): EsgEventFilters => ({
  when: "all",
  q: marker,
  page: 1,
  ...overrides,
});

integration("ESG event ledger repository", () => {
  beforeAll(async () => {
    ({ esgPrisma: prisma } = await import("@esgcredit/db-esg"));
    await prisma.$executeRaw`
      INSERT INTO events (
        event_id, event_name, event_url, start_date, end_date, start_time,
        end_time, timezone, timezone_iana, venue_name, venue_address,
        country_code, city, attendance_mode, organizer_name, summary, source
      ) VALUES
        (
          ${`${marker}-cross-month`}, ${`${marker} Climate transition forum`},
          'https://events.example.test/cross-month', '2026-08-30'::date,
          '2026-09-02'::date, '09:00'::time, '17:00'::time, 'BST',
          'Europe/London', 'Ledger Hall', 'London, United Kingdom', 'GB',
          'London', 'hybrid', 'Ledger Institute', 'A cross-month fixture',
          'Ledger Source A'
        ),
        (
          ${`${marker}-dubai`}, ${`${marker} Sustainable finance summit`},
          'https://events.example.test/dubai', '2026-09-15'::date, NULL,
          NULL, NULL, 'GST', 'Asia/Dubai', 'Dubai Forum', 'Dubai, UAE',
          'AE', 'Dubai', 'in_person', 'Ledger Institute',
          'A location intersection fixture', 'Ledger Source B'
        ),
        (
          ${`${marker}-online`}, ${`${marker} Disclosure webinar`},
          'https://events.example.test/online', NULL, NULL, NULL, NULL,
          NULL, NULL, 'Zoom', NULL, NULL, NULL, 'online',
          'Ledger Institute', 'An undated online fixture', 'Ledger Source A'
        ),
        (
          ${`${marker}-past`}, ${`${marker} Archived briefing`},
          'https://events.example.test/past', '2026-07-01'::date, NULL,
          NULL, NULL, NULL, NULL, NULL, NULL, 'GB', 'London', 'in_person',
          'Ledger Institute', 'A start-only past fixture', 'Ledger Source B'
        )
    `;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.$executeRaw`DELETE FROM events WHERE event_id LIKE ${`${marker}%`}`;
    await prisma.$disconnect();
  });

  it("intersects month overlap, country, city, format, source, and search", async () => {
    const { listEsgEvents } = await import("./repository");
    const september = await listEsgEvents(filters({ when: "2026-09" }), clock);
    expect(september.total).toBe(2);

    const londonHybrid = await listEsgEvents(filters({
      when: "2026-08",
      country: "GB",
      city: "London",
      format: "hybrid",
      source: "Ledger Source A",
    }), clock);
    expect(londonHybrid.items.map((event) => event.externalId)).toEqual([
      `${marker}-cross-month`,
    ]);

    const undatedOnline = await listEsgEvents(filters({
      when: "tbc",
      format: "online",
      source: "Ledger Source A",
    }), clock);
    expect(undatedOnline.total).toBe(1);
    expect(undatedOnline.items[0]?.temporal.status).toBe("date-tbc");
  });

  it("returns a usable total when the requested page is empty", async () => {
    const { listEsgEvents } = await import("./repository");
    const result = await listEsgEvents(filters({ page: 99 }), clock);
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(4);
    expect(result.totalPages).toBe(1);
  });

  it("keeps facet counts reachable from equivalent list filters", async () => {
    const { listEsgEvents } = await import("./repository");
    const result = await listEsgEvents(filters(), clock);
    expect(result.facets.time.find((facet) => facet.value === "all")?.count).toBe(result.total);
    expect(result.facets.citiesByCountry.GB?.find((city) => city.value === "London")?.count).toBe(2);

    for (const format of result.facets.formats) {
      const reachable = await listEsgEvents(filters({ format: format.value }), clock);
      expect(format.count).toBe(reachable.total);
    }
  });
});
