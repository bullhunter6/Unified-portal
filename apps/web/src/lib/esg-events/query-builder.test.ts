import { describe, expect, it } from "vitest";
import { buildEsgEventClassificationSql } from "./classification-sql";
import { createEsgRequestClock } from "./dates";
import { buildEsgEventPredicate } from "./query-builder";

const clock = createEsgRequestClock(new Date("2026-08-04T08:00:00.000Z"));

describe("buildEsgEventPredicate", () => {
  it("uses one parameterized predicate for intersecting discovery filters", () => {
    const predicate = buildEsgEventPredicate({
      when: "2026-08",
      q: "100% net_zero",
      country: "AE",
      city: "Dubai",
      format: "in-person",
      source: "UNEP",
      page: 1,
    }, clock);
    expect(predicate.text).toContain("COALESCE(e.start_date, e.end_date)");
    expect(predicate.text).toContain("e.end_date > e.start_date + 366");
    expect(predicate.text).toContain("esg_class.country_code");
    expect(predicate.text).not.toContain("100% net_zero");
    expect(predicate.values).toEqual([
      "2026-08-01",
      "2026-09-01",
      "%100\\% net\\_zero%",
      "AE",
      "Dubai",
      "in_person",
      "UNEP",
    ]);
  });

  it("treats unknown format as null without treating unknown location as online", () => {
    const predicate = buildEsgEventPredicate({ when: "all", format: "unknown", page: 1 }, clock);
    expect(predicate.text).toContain("esg_class.attendance_mode");
    expect(predicate.text.trim()).toMatch(/IS NULL\)$/);
    expect(predicate.values).toEqual([]);
  });

  it("can omit one dimension to compute reachable facet counts", () => {
    const predicate = buildEsgEventPredicate(
      { when: "week", country: "AE", city: "Dubai", page: 1 },
      clock,
      { exclude: ["when", "country", "city"] },
    );
    expect(predicate.text).toBe("TRUE");
    expect(predicate.values).toEqual([]);
  });

  it("keeps legacy event tables usable until the additive migration is deployed", () => {
    const predicate = buildEsgEventPredicate(
      {
        when: "upcoming",
        q: "climate",
        country: "AE",
        city: "Dubai",
        format: "online",
        page: 1,
      },
      clock,
      {
        database: {
          schema: {
            countryCode: false,
            city: false,
            attendanceMode: false,
            timezoneIana: false,
            eventData: true,
          },
          validTimezonesJson: "{}",
        },
      },
    );

    expect(predicate.text).not.toMatch(/e\.(country_code|city|attendance_mode|timezone_iana)/);
    const classification = buildEsgEventClassificationSql({
      countryCode: false,
      city: false,
      attendanceMode: false,
      timezoneIana: false,
      eventData: true,
    });
    expect(classification.join).toContain("e.event_data");
    expect(predicate.text).toContain("esg_class.country_code");
    expect(predicate.text).not.toContain("FALSE");
    expect(predicate.values).toEqual([
      clock.dubaiToday,
      "%climate%",
      "AE",
      "Dubai",
      "online",
    ]);
  });

  it("uses a request parameter for validated timezones instead of scanning pg_timezone_names", () => {
    const predicate = buildEsgEventPredicate(
      { when: "upcoming", page: 1 },
      clock,
      {
        database: {
          schema: {
            countryCode: true,
            city: true,
            attendanceMode: true,
            timezoneIana: true,
            eventData: false,
          },
          validTimezonesJson: '{"Asia/Dubai":true}',
        },
      },
    );

    expect(predicate.text).toContain("? e.timezone_iana");
    expect(predicate.text).not.toContain("pg_timezone_names");
    expect(predicate.values).toContain('{"Asia/Dubai":true}');
  });
});
