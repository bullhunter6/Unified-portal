import { describe, expect, it } from "vitest";
import {
  assertEsgWeeklyDigestWindow,
  getEsgWeeklyDigestWindow,
  getNextEsgWeeklyDigestWindow,
  isEsgWeeklyDigestDue,
} from "./weekly-digest-dates";

describe("ESG weekly digest Dubai calendar", () => {
  it("returns the Monday-Sunday window at the confirmed send time", () => {
    const now = new Date("2026-08-10T05:00:30.000Z");
    expect(getEsgWeeklyDigestWindow(now)).toEqual({
      weekStart: "2026-08-10",
      weekEnd: "2026-08-16",
    });
    expect(isEsgWeeklyDigestDue(now)).toBe(true);
  });

  it("anchors delayed runs to the same Monday instead of starting from today", () => {
    expect(getEsgWeeklyDigestWindow(new Date("2026-08-12T12:00:00.000Z"))).toEqual({
      weekStart: "2026-08-10",
      weekEnd: "2026-08-16",
    });
  });

  it("starts recipient changes on the current edition only before Monday 09:00", () => {
    expect(getNextEsgWeeklyDigestWindow(new Date("2026-08-10T04:59:59.000Z"))).toEqual({
      weekStart: "2026-08-10",
      weekEnd: "2026-08-16",
    });
    expect(getNextEsgWeeklyDigestWindow(new Date("2026-08-10T05:00:00.000Z"))).toEqual({
      weekStart: "2026-08-17",
      weekEnd: "2026-08-23",
    });
    expect(getNextEsgWeeklyDigestWindow(new Date("2026-08-13T10:00:00.000Z"))).toEqual({
      weekStart: "2026-08-17",
      weekEnd: "2026-08-23",
    });
  });

  it("uses Dubai-local time and keeps the due window open for catch-up", () => {
    expect(getEsgWeeklyDigestWindow(new Date("2026-08-09T20:30:00.000Z"))).toEqual({
      weekStart: "2026-08-10",
      weekEnd: "2026-08-16",
    });
    expect(isEsgWeeklyDigestDue(new Date("2026-08-10T04:59:59.000Z"))).toBe(false);
    expect(isEsgWeeklyDigestDue(new Date("2026-08-10T05:01:00.000Z"))).toBe(true);
    expect(isEsgWeeklyDigestDue(new Date("2026-08-12T05:00:00.000Z"))).toBe(true);
    expect(isEsgWeeklyDigestDue(new Date("2026-08-16T19:59:59.000Z"))).toBe(true);
    expect(isEsgWeeklyDigestDue(new Date("2026-08-16T20:00:00.000Z"))).toBe(false);
  });

  it("handles a week spanning two calendar years", () => {
    expect(getEsgWeeklyDigestWindow(new Date("2025-12-31T08:00:00.000Z"))).toEqual({
      weekStart: "2025-12-29",
      weekEnd: "2026-01-04",
    });
  });

  it("rejects malformed and non-Monday windows", () => {
    expect(() => assertEsgWeeklyDigestWindow({
      weekStart: "2026-08-11",
      weekEnd: "2026-08-17",
    })).toThrow(/start on Monday/);
    expect(() => assertEsgWeeklyDigestWindow({
      weekStart: "2026-08-10",
      weekEnd: "2026-08-15",
    })).toThrow(/Monday-Sunday/);
    expect(() => getEsgWeeklyDigestWindow(new Date("invalid"))).toThrow(/valid weekly digest clock/);
  });
});
