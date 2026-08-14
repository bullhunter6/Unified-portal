import { describe, expect, it } from "vitest";
import type { EsgEventDto } from "./types";
import {
  formatEsgWeeklyDigestRange,
  renderEsgWeeklyDigest,
} from "./weekly-digest-template";

function event(overrides: Partial<EsgEventDto> = {}): EsgEventDto {
  return {
    id: 7,
    externalId: null,
    name: "Climate summit",
    eventUrl: "https://events.example.test/official",
    startDate: "2026-08-10",
    endDate: "2026-08-10",
    startTime: "09:30",
    endTime: "11:00",
    timezoneRaw: null,
    timezoneIana: "Asia/Dubai",
    imageUrl: null,
    ticketPrice: null,
    ticketsUrl: null,
    venueName: null,
    venueAddress: null,
    city: "Dubai",
    countryCode: "AE",
    countryLabel: "United Arab Emirates",
    attendanceMode: "in_person",
    organizerName: "ESG Institute",
    organizerUrl: null,
    summary: "A practical agenda for sustainability leaders.",
    tags: null,
    source: "Example Source",
    createdAt: null,
    temporal: {
      status: "upcoming",
      precision: "instant",
      startInstant: "2026-08-10T05:30:00.000Z",
      endInstant: "2026-08-10T07:00:00.000Z",
    },
    ...overrides,
  };
}

describe("ESG weekly digest template", () => {
  it("formats a compact inclusive week range", () => {
    expect(formatEsgWeeklyDigestRange("2026-08-10", "2026-08-16"))
      .toBe("10 Aug–16 Aug 2026");
  });

  it("separates online events and escapes database content in HTML", () => {
    const rendered = renderEsgWeeklyDigest({
      weekStart: "2026-08-10",
      weekEnd: "2026-08-16",
      portalBaseUrl: "https://portal.example.test/base?ignored=yes",
      events: [
        event({
          id: 1,
          name: "Webinar <script>alert('x')</script>",
          attendanceMode: "online",
          city: null,
          countryCode: null,
          countryLabel: null,
          eventUrl: "https://events.example.test/?a=1&b=2",
        }),
        event({ id: 2, name: "Dubai forum" }),
      ],
    });

    expect(rendered.onlineCount).toBe(1);
    expect(rendered.otherCount).toBe(1);
    expect(rendered.html.indexOf("Online &amp; webinars"))
      .toBeLessThan(rendered.html.indexOf("In person &amp; hybrid"));
    expect(rendered.html).toContain("Webinar &lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
    expect(rendered.html).not.toContain("<script>alert");
    expect(rendered.html).toContain("a=1&amp;b=2");
    expect(rendered.html).toContain("https://portal.example.test/esg/events/1");
    expect(rendered.html).toContain("View details</a>");
    expect(rendered.html).toContain("Official website</a>");
  });

  it("renders a useful no-events test email", () => {
    const rendered = renderEsgWeeklyDigest({
      weekStart: "2026-08-10",
      weekEnd: "2026-08-16",
      portalBaseUrl: "http://localhost:3000",
      events: [],
      testMode: true,
    });

    expect(rendered.subject).toMatch(/^\[TEST\]/);
    expect(rendered.text).toContain("No confirmed ESG events");
    expect(rendered.html).toContain("production recipients were not used");
    expect(rendered.html).toContain("Browse all ESG events");
  });

  it("rejects non-HTTP portal URLs", () => {
    expect(() => renderEsgWeeklyDigest({
      weekStart: "2026-08-10",
      weekEnd: "2026-08-16",
      portalBaseUrl: "javascript:alert(1)",
      events: [],
    })).toThrow("HTTP or HTTPS");
  });
});
