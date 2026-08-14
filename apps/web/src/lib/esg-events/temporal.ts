import {
  isValidDateString,
  trustedEventEndDate,
  zonedEventInterval,
} from "./dates";
import type {
  EsgRequestClock,
  EsgTemporalClassification,
} from "./types";

export function classifyEsgEventTemporal(
  event: {
    startDate: string | null;
    endDate: string | null;
    startTime: string | null;
    endTime: string | null;
    timezoneIana: string | null;
  },
  clock: EsgRequestClock,
): EsgTemporalClassification {
  const interval = zonedEventInterval(event);
  if (interval) {
    const timestamp = clock.now.getTime();
    return {
      status: timestamp < interval.start.getTime()
        ? "upcoming"
        : timestamp <= interval.end.getTime()
          ? "happening-now"
          : "past",
      precision: "instant",
      startInstant: interval.start.toISOString(),
      endInstant: interval.end.toISOString(),
    };
  }

  const start = isValidDateString(event.startDate)
    ? event.startDate
    : isValidDateString(event.endDate)
      ? event.endDate
      : null;
  if (!start) {
    return {
      status: "date-tbc",
      precision: "undated",
      startInstant: null,
      endInstant: null,
    };
  }

  // Reversed and implausibly long ranges are deliberately treated as
  // start-date-only records.
  const end = trustedEventEndDate(event.startDate, event.endDate) ?? start;
  const today = clock.dubaiToday;
  const status = today < start
    ? "upcoming"
    : today > end
      ? "past"
      : start === end
        ? "today"
        : "in-progress";

  return {
    status,
    precision: "date",
    startInstant: null,
    endInstant: null,
  };
}
