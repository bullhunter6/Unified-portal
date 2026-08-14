import { describe, expect, it } from "vitest";
import {
  createEsgRequestClock,
  eventOverlapsMonth,
  getMonthWindow,
  isValidDateString,
  normalizeTimeValue,
  trustedEventEndDate,
  zonedEventInterval,
} from "./dates";

describe("Dubai request clock", () => {
  it("captures the Dubai date and Sunday week boundary once", () => {
    const clock = createEsgRequestClock(new Date("2026-08-06T22:30:00.000Z"));
    expect(clock.dubaiToday).toBe("2026-08-07");
    expect(clock.dubaiWeekEnd).toBe("2026-08-09");
    expect(clock.currentMonth).toBe("2026-08");
  });

  it("handles Sunday as a one-day remaining window", () => {
    const clock = createEsgRequestClock(new Date("2026-08-09T08:00:00.000Z"));
    expect(clock.dubaiToday).toBe("2026-08-09");
    expect(clock.dubaiWeekEnd).toBe("2026-08-09");
  });
});

describe("calendar normalization", () => {
  it("validates real dates and month windows", () => {
    expect(isValidDateString("2024-02-29")).toBe(true);
    expect(isValidDateString("2026-02-29")).toBe(false);
    expect(getMonthWindow("2026-12")).toEqual({
      start: "2026-12-01",
      next: "2027-01-01",
      end: "2026-12-31",
    });
  });

  it("uses inclusive overlap semantics for cross-month events", () => {
    expect(eventOverlapsMonth("2026-08-30", "2026-09-02", "2026-08")).toBe(true);
    expect(eventOverlapsMonth("2026-08-30", "2026-09-02", "2026-09")).toBe(true);
    expect(eventOverlapsMonth("2026-08-30", "2026-09-02", "2026-10")).toBe(false);
  });

  it("falls back to start-only semantics for reversed ranges", () => {
    expect(eventOverlapsMonth("2026-09-02", "2026-08-30", "2026-09")).toBe(true);
    expect(eventOverlapsMonth("2026-09-02", "2026-08-30", "2026-08")).toBe(false);
  });

  it("keeps corrupt multi-year ranges out of intervening months", () => {
    expect(trustedEventEndDate("2023-12-19", "2026-09-17")).toBeNull();
    expect(eventOverlapsMonth("2023-12-19", "2026-09-17", "2026-08")).toBe(false);
    expect(eventOverlapsMonth("2023-12-19", "2026-09-17", "2023-12")).toBe(true);
  });

  it("serializes PostgreSQL TIME text without a 1970 Date anchor", () => {
    expect(normalizeTimeValue("09:30:00.000000")).toBe("09:30");
    expect(normalizeTimeValue("23:59")).toBe("23:59");
    expect(normalizeTimeValue("24:00:00")).toBeNull();
  });
});

describe("timezone-backed intervals", () => {
  it("turns valid Dubai wall-clock times into exact instants", () => {
    const interval = zonedEventInterval({
      startDate: "2026-08-04",
      endDate: "2026-08-04",
      startTime: "10:00",
      endTime: "11:00",
      timezoneIana: "Asia/Dubai",
    });
    expect(interval?.start.toISOString()).toBe("2026-08-04T06:00:00.000Z");
    expect(interval?.end.toISOString()).toBe("2026-08-04T07:00:00.000Z");
  });

  it("rejects invalid zones and internally reversed clock intervals", () => {
    expect(zonedEventInterval({
      startDate: "2026-08-04",
      endDate: "2026-08-04",
      startTime: "11:00",
      endTime: "10:00",
      timezoneIana: "Mars/Olympus",
    })).toBeNull();
  });
});
