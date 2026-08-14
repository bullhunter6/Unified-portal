import {
  addCalendarDays,
  formatDateInZone,
  isValidDateString,
} from "./dates";

export const ESG_WEEKLY_DIGEST_TIME_ZONE = "Asia/Dubai";
export const ESG_WEEKLY_DIGEST_SEND_HOUR = 9;
export const ESG_WEEKLY_DIGEST_SEND_MINUTE = 0;

export type EsgWeeklyDigestWindow = {
  weekStart: string;
  weekEnd: string;
};

function assertValidInstant(now: Date): void {
  if (Number.isNaN(now.getTime())) {
    throw new RangeError("A valid weekly digest clock is required");
  }
}

function weekdayForCalendarDate(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Returns the Dubai-local Monday through Sunday containing `now`. */
export function getEsgWeeklyDigestWindow(now = new Date()): EsgWeeklyDigestWindow {
  assertValidInstant(now);
  const dubaiToday = formatDateInZone(now, ESG_WEEKLY_DIGEST_TIME_ZONE);
  const daysSinceMonday = (weekdayForCalendarDate(dubaiToday) + 6) % 7;
  const weekStart = addCalendarDays(dubaiToday, -daysSinceMonday);
  return {
    weekStart,
    weekEnd: addCalendarDays(weekStart, 6),
  };
}

/** The edition a newly added/reactivated recipient should start receiving. */
export function getNextEsgWeeklyDigestWindow(now = new Date()): EsgWeeklyDigestWindow {
  const current = getEsgWeeklyDigestWindow(now);
  if (!isEsgWeeklyDigestDue(now)) return current;
  const weekStart = addCalendarDays(current.weekStart, 7);
  return { weekStart, weekEnd: addCalendarDays(weekStart, 6) };
}

/**
 * True from Monday 09:00 through Sunday in Dubai. The delivery layer's
 * week-scoped idempotency key makes repeated polls safe, while this wider due
 * window allows a restarted worker to catch up after the scheduled minute.
 */
export function isEsgWeeklyDigestDue(now = new Date()): boolean {
  assertValidInstant(now);
  const localDate = formatDateInZone(now, ESG_WEEKLY_DIGEST_TIME_ZONE);
  const weekday = weekdayForCalendarDate(localDate);
  if (weekday !== 1) return true;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ESG_WEEKLY_DIGEST_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const read = (type: "hour" | "minute") =>
    Number(parts.find((part) => part.type === type)?.value ?? "-1");

  const hour = read("hour");
  const minute = read("minute");
  return hour > ESG_WEEKLY_DIGEST_SEND_HOUR
    || hour === ESG_WEEKLY_DIGEST_SEND_HOUR
      && minute >= ESG_WEEKLY_DIGEST_SEND_MINUTE;
}

export function assertEsgWeeklyDigestWindow(
  window: EsgWeeklyDigestWindow,
): void {
  if (
    !isValidDateString(window.weekStart)
    || !isValidDateString(window.weekEnd)
    || addCalendarDays(window.weekStart, 6) !== window.weekEnd
  ) {
    throw new RangeError("The ESG weekly digest window must be one Dubai Monday-Sunday week");
  }
  if (weekdayForCalendarDate(window.weekStart) !== 1) {
    throw new RangeError("The ESG weekly digest window must start on Monday");
  }
}
