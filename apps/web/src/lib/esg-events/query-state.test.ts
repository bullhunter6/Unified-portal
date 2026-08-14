import { describe, expect, it } from "vitest";
import { parseEsgEventId, parseEsgEventSearchParams } from "./query-state";
import { buildEsgEventsUrl, updateEsgEventFilters } from "./urls";

const NOW = new Date("2026-08-04T08:00:00.000Z");

describe("parseEsgEventSearchParams", () => {
  it("uses and omits the canonical Upcoming default", () => {
    const parsed = parseEsgEventSearchParams(new URLSearchParams(), { now: NOW });
    expect(parsed.filters).toEqual({ when: "upcoming", page: 1 });
    expect(parsed.canonicalSearch).toBe("");
    expect(parsed.needsRedirect).toBe(false);

    const explicit = parseEsgEventSearchParams(new URLSearchParams("when=upcoming&page=1"), { now: NOW });
    expect(explicit.canonicalSearch).toBe("");
    expect(explicit.needsRedirect).toBe(true);
  });

  it("accepts the strict public filter contract and produces stable ordering", () => {
    const parsed = parseEsgEventSearchParams(new URLSearchParams(
      "source=UNEP&format=in-person&city=Dubai&country=AE&q=climate&when=2026-08&page=3",
    ), { now: NOW });
    expect(parsed.filters).toEqual({
      when: "2026-08",
      q: "climate",
      country: "AE",
      city: "Dubai",
      format: "in-person",
      source: "UNEP",
      page: 3,
    });
    expect(parsed.canonicalSearch).toBe(
      "when=2026-08&q=climate&country=AE&city=Dubai&format=in-person&source=UNEP&page=3",
    );
    expect(parsed.needsRedirect).toBe(false);
  });

  it.each([
    "page=1e2",
    "page=2.5",
    "page=Infinity",
    "page=0",
    "page=-1",
    "when=2026-13",
    "when=0000-01",
    "format=virtual",
    "country=ZZ",
  ])("sanitizes malformed scalar state: %s", (query) => {
    const parsed = parseEsgEventSearchParams(new URLSearchParams(query), { now: NOW });
    expect(parsed.filters).toEqual({ when: "upcoming", page: 1 });
    expect(parsed.needsRedirect).toBe(true);
  });

  it("rejects duplicate scalar parameters instead of choosing one", () => {
    const parsed = parseEsgEventSearchParams(
      new URLSearchParams("country=AE&country=GB&source=A&source=B"),
      { now: NOW },
    );
    expect(parsed.filters.country).toBeUndefined();
    expect(parsed.filters.source).toBeUndefined();
    expect(parsed.issues.filter((issue) => issue.issue === "duplicate")).toHaveLength(2);
  });

  it("drops a city without a validated country", () => {
    const parsed = parseEsgEventSearchParams(new URLSearchParams("city=Dubai"), { now: NOW });
    expect(parsed.filters.city).toBeUndefined();
    expect(parsed.issues).toContainEqual({ key: "city", issue: "dependent-filter" });
  });

  it("drops a dependent city when the country is not a real ISO-3166 code", () => {
    const parsed = parseEsgEventSearchParams(
      new URLSearchParams("country=ZZ&city=Zzyzx"),
      { now: NOW },
    );
    expect(parsed.filters.country).toBeUndefined();
    expect(parsed.filters.city).toBeUndefined();
    expect(parsed.issues).toContainEqual({ key: "country", issue: "invalid" });
    expect(parsed.issues).toContainEqual({ key: "city", issue: "dependent-filter" });
  });

  it("normalizes safe text and country casing while rejecting overlong text", () => {
    const normalized = parseEsgEventSearchParams(
      new URLSearchParams("q=%20net%20%20zero%20&country=ae&city=%20Abu%20%20Dhabi%20"),
      { now: NOW },
    );
    expect(normalized.filters).toMatchObject({ q: "net zero", country: "AE", city: "Abu Dhabi" });
    expect(normalized.needsRedirect).toBe(true);

    const overlong = parseEsgEventSearchParams(
      new URLSearchParams({ q: "x".repeat(161), source: "y".repeat(121) }),
      { now: NOW },
    );
    expect(overlong.filters.q).toBeUndefined();
    expect(overlong.filters.source).toBeUndefined();
  });

  it("canonicalizes legacy time, grid, and page-size links", () => {
    const week = parseEsgEventSearchParams(
      new URLSearchParams("dateRange=this-week&view=grid&pageSize=50"),
      { now: NOW },
    );
    expect(week.filters.when).toBe("week");
    expect(week.canonicalSearch).toBe("when=week");

    const month = parseEsgEventSearchParams(new URLSearchParams("month=August%202026"), { now: NOW });
    expect(month.filters.when).toBe("2026-08");

    const thisMonth = parseEsgEventSearchParams(new URLSearchParams("dateRange=this-month"), { now: NOW });
    expect(thisMonth.filters.when).toBe("2026-08");
  });

  it("removes unknown parameters from the canonical URL", () => {
    const parsed = parseEsgEventSearchParams(new URLSearchParams("when=all&surprise=yes"), { now: NOW });
    expect(parsed.canonicalSearch).toBe("when=all");
    expect(parsed.issues).toContainEqual({ key: "surprise", issue: "unknown" });
  });
});

describe("event URL and ID helpers", () => {
  it.each(["0", "-1", "1.5", "1e2", "Infinity", " 1", "2147483648"])(
    "rejects malformed event id %s",
    (id) => expect(parseEsgEventId(id)).toBeNull(),
  );
  it("accepts a strict positive database id", () => expect(parseEsgEventId("42")).toBe(42));

  it("resets pagination and clears an incompatible city on country change", () => {
    const next = updateEsgEventFilters(
      { when: "all", country: "AE", city: "Dubai", page: 7 },
      { country: "GB" },
    );
    expect(next).toEqual({ when: "all", country: "GB", page: 1 });
    expect(buildEsgEventsUrl(next)).toBe("/esg/events?when=all&country=GB");
  });
});
