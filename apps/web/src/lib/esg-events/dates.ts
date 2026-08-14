import {
  ESG_MAX_TRUSTED_EVENT_RANGE_DAYS,
  type EsgRequestClock,
} from "./types";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d{1,6})?)?$/;

function partsInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

export function formatDateInZone(date: Date, timeZone: string): string {
  const parts = partsInZone(date, timeZone);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function isValidDateString(value: string | null | undefined): value is string {
  if (!value) return false;
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isValidMonth(value: string | null | undefined): value is string {
  if (!value) return false;
  const match = MONTH_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  return year >= 1900 && year <= 2200;
}

export function normalizeTimeValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = TIME_PATTERN.exec(value.trim());
  return match ? `${match[1]}:${match[2]}` : null;
}

export function addCalendarDays(value: string, days: number): string {
  if (!isValidDateString(value)) throw new RangeError(`Invalid calendar date: ${value}`);
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function getMonthWindow(month: string): { start: string; next: string; end: string } {
  if (!isValidMonth(month)) throw new RangeError(`Invalid calendar month: ${month}`);
  const [year, monthNumber] = month.split("-").map(Number);
  const nextDate = new Date(Date.UTC(year, monthNumber, 1));
  const endDate = new Date(Date.UTC(year, monthNumber, 0));
  return {
    start: `${month}-01`,
    next: nextDate.toISOString().slice(0, 10),
    end: endDate.toISOString().slice(0, 10),
  };
}

function calendarDayNumber(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

/**
 * Returns an end date only when it is a credible inclusive range boundary.
 * Reversed and implausibly long ranges deliberately use start-date-only
 * semantics so bad scraper values cannot make one event appear in every month.
 */
export function trustedEventEndDate(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): string | null {
  if (!isValidDateString(endDate)) return null;
  if (!isValidDateString(startDate)) return endDate;
  if (endDate < startDate) return null;
  const durationDays = calendarDayNumber(endDate) - calendarDayNumber(startDate);
  return durationDays <= ESG_MAX_TRUSTED_EVENT_RANGE_DAYS ? endDate : null;
}

export function eventOverlapsMonth(
  startDate: string | null,
  endDate: string | null,
  month: string,
): boolean {
  const { start: monthStart, end: monthEnd } = getMonthWindow(month);
  const start = isValidDateString(startDate) ? startDate : isValidDateString(endDate) ? endDate : null;
  if (!start) return false;
  const end = trustedEventEndDate(startDate, endDate) ?? start;
  return start <= monthEnd && end >= monthStart;
}

export function createEsgRequestClock(now = new Date()): EsgRequestClock {
  const captured = new Date(now.getTime());
  if (Number.isNaN(captured.getTime())) throw new RangeError("A valid request clock is required");
  const dubaiToday = formatDateInZone(captured, "Asia/Dubai");
  const [year, month, day] = dubaiToday.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const daysUntilSunday = (7 - weekday) % 7;
  return {
    now: captured,
    nowIso: captured.toISOString(),
    dubaiToday,
    dubaiWeekEnd: addCalendarDays(dubaiToday, daysUntilSunday),
    currentMonth: dubaiToday.slice(0, 7),
  };
}

export function isValidIanaTimeZone(value: string | null | undefined): value is string {
  if (!value || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

function localDateTimeToInstant(date: string, time: string, timeZone: string): Date | null {
  if (!isValidDateString(date) || !normalizeTimeValue(time) || !isValidIanaTimeZone(timeZone)) {
    return null;
  }
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wallTime = Date.UTC(year, month - 1, day, hour, minute, 0);

  const offsetAt = (instant: number) => {
    const zoned = partsInZone(new Date(instant), timeZone);
    const asUtc = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second,
    );
    return asUtc - Math.floor(instant / 1000) * 1000;
  };

  let instant = wallTime - offsetAt(wallTime);
  instant = wallTime - offsetAt(instant);
  const candidate = new Date(instant);
  const check = partsInZone(candidate, timeZone);
  if (
    check.year !== year ||
    check.month !== month ||
    check.day !== day ||
    check.hour !== hour ||
    check.minute !== minute
  ) {
    return null;
  }
  return candidate;
}

export function zonedEventInterval(args: {
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  timezoneIana: string | null;
}): { start: Date; end: Date } | null {
  const { startDate, startTime, endTime, timezoneIana } = args;
  const normalizedStartTime = normalizeTimeValue(startTime);
  const normalizedEndTime = normalizeTimeValue(endTime);
  if (
    !isValidDateString(startDate) ||
    !normalizedStartTime ||
    !normalizedEndTime ||
    !isValidIanaTimeZone(timezoneIana)
  ) {
    return null;
  }
  const trustedEndDate = trustedEventEndDate(startDate, args.endDate);
  if (isValidDateString(args.endDate) && !trustedEndDate) return null;
  const endDate = trustedEndDate ?? startDate;
  const start = localDateTimeToInstant(startDate, normalizedStartTime, timezoneIana);
  const end = localDateTimeToInstant(endDate, normalizedEndTime, timezoneIana);
  return start && end && end >= start ? { start, end } : null;
}
