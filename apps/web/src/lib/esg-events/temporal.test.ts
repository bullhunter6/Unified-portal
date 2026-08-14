import { describe, expect, it } from "vitest";
import { createEsgRequestClock } from "./dates";
import { classifyEsgEventTemporal } from "./temporal";

const clock = createEsgRequestClock(new Date("2026-08-04T06:30:00.000Z"));
const base = {
  startDate: "2026-08-04",
  endDate: "2026-08-04",
  startTime: null,
  endTime: null,
  timezoneIana: null,
};

describe("classifyEsgEventTemporal", () => {
  it("reserves Happening now for a precise timezone-backed interval", () => {
    expect(classifyEsgEventTemporal({
      ...base,
      startTime: "10:00",
      endTime: "11:00",
      timezoneIana: "Asia/Dubai",
    }, clock)).toMatchObject({
      status: "happening-now",
      precision: "instant",
      startInstant: "2026-08-04T06:00:00.000Z",
      endInstant: "2026-08-04T07:00:00.000Z",
    });
  });

  it("classifies exact intervals before and after now", () => {
    expect(classifyEsgEventTemporal({ ...base, startTime: "11:00", endTime: "12:00", timezoneIana: "Asia/Dubai" }, clock).status)
      .toBe("upcoming");
    expect(classifyEsgEventTemporal({ ...base, startTime: "08:00", endTime: "09:00", timezoneIana: "Asia/Dubai" }, clock).status)
      .toBe("past");
  });

  it("uses Today rather than Happening now for partial time data or an invalid zone", () => {
    expect(classifyEsgEventTemporal({ ...base, startTime: "10:00", timezoneIana: "Asia/Dubai" }, clock))
      .toMatchObject({ status: "today", precision: "date" });
    expect(classifyEsgEventTemporal({ ...base, startTime: "10:00", endTime: "11:00", timezoneIana: "Invalid/Zone" }, clock))
      .toMatchObject({ status: "today", precision: "date" });
  });

  it("supports inclusive date-only ranges", () => {
    expect(classifyEsgEventTemporal({ ...base, startDate: "2026-08-03", endDate: "2026-08-05" }, clock).status)
      .toBe("in-progress");
    expect(classifyEsgEventTemporal({ ...base, startDate: "2026-08-05", endDate: null }, clock).status)
      .toBe("upcoming");
    expect(classifyEsgEventTemporal({ ...base, startDate: "2026-08-03", endDate: null }, clock).status)
      .toBe("past");
  });

  it("uses start-only semantics for reversed ranges", () => {
    expect(classifyEsgEventTemporal({ ...base, startDate: "2026-08-04", endDate: "2026-08-01" }, clock).status)
      .toBe("today");
    expect(classifyEsgEventTemporal({
      ...base,
      startDate: "2026-08-04",
      endDate: "2026-08-01",
      startTime: "08:00",
      endTime: "09:00",
      timezoneIana: "Asia/Dubai",
    }, clock)).toMatchObject({ status: "today", precision: "date" });
  });

  it("uses start-only semantics for implausibly long ranges", () => {
    expect(classifyEsgEventTemporal({
      ...base,
      startDate: "2023-12-19",
      endDate: "2026-09-17",
    }, clock)).toMatchObject({ status: "past", precision: "date" });
  });

  it("keeps truly undated events in Date TBC", () => {
    expect(classifyEsgEventTemporal({ ...base, startDate: null, endDate: null }, clock))
      .toMatchObject({ status: "date-tbc", precision: "undated" });
  });
});
