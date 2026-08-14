import type {
  EsgAgendaEvent,
  EsgDetailEvent,
  EsgRelatedEvent,
  LedgerStatusTone,
} from "@/components/esg-events/types";
import { describeEsgEventLocation } from "@/lib/esg-events/normalize";
import type { EsgEventDto, EsgTemporalStatus } from "@/lib/esg-events/types";
import { buildEsgEventDetailUrl } from "@/lib/esg-events/urls";
import type { EsgEventFilters } from "@/lib/esg-events/types";

const longDate = new Intl.DateTimeFormat("en", {
  timeZone: "UTC",
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

const monthDay = new Intl.DateTimeFormat("en", {
  timeZone: "UTC",
  month: "long",
  day: "numeric",
});

const yearMonth = new Intl.DateTimeFormat("en", {
  timeZone: "UTC",
  year: "numeric",
  month: "long",
});

function dateFromIso(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatEventDateRange(startDate: string | null, endDate: string | null): string {
  const start = startDate ?? endDate;
  if (!start) return "Date to be confirmed";
  const validEnd = endDate && endDate >= start ? endDate : start;
  if (start === validEnd) return longDate.format(dateFromIso(start));

  const first = dateFromIso(start);
  const last = dateFromIso(validEnd);
  if (first.getUTCFullYear() === last.getUTCFullYear()) {
    return `${monthDay.format(first)} – ${monthDay.format(last)}, ${last.getUTCFullYear()}`;
  }
  return `${monthDay.format(first)}, ${first.getUTCFullYear()} – ${monthDay.format(last)}, ${last.getUTCFullYear()}`;
}

export function formatEventTime(startTime: string | null, endTime: string | null): string {
  if (startTime && endTime) return `${startTime}–${endTime}`;
  if (startTime) return `From ${startTime}`;
  if (endTime) return `Until ${endTime}`;
  return "Time TBC";
}

export function formatMonthLabel(month: string): string {
  return yearMonth.format(dateFromIso(`${month}-01`));
}

function statusPresentation(status: EsgTemporalStatus): {
  label: string;
  tone: LedgerStatusTone;
} {
  switch (status) {
    case "happening-now":
      return { label: "Happening now", tone: "live" };
    case "today":
      return { label: "Today", tone: "today" };
    case "in-progress":
      return { label: "In progress", tone: "progress" };
    case "past":
      return { label: "Past", tone: "past" };
    case "date-tbc":
      return { label: "Date TBC", tone: "tbc" };
    default:
      return { label: "Upcoming", tone: "upcoming" };
  }
}

function attendanceLabel(event: EsgEventDto): string | null {
  switch (event.attendanceMode) {
    case "in_person":
      return "In person";
    case "online":
      return "Online";
    case "hybrid":
      return "Hybrid";
    default:
      return null;
  }
}

function eventDateParts(event: EsgEventDto) {
  const date = event.startDate ?? event.endDate;
  if (!date) return { dateMonth: "DATE", dateDay: "TBC", dateYear: "" };
  const parsed = dateFromIso(date);
  return {
    dateMonth: new Intl.DateTimeFormat("en", { timeZone: "UTC", month: "short" })
      .format(parsed)
      .toUpperCase(),
    dateDay: String(parsed.getUTCDate()).padStart(2, "0"),
    dateYear: String(parsed.getUTCFullYear()),
  };
}

export function toAgendaEvent(
  event: EsgEventDto,
  returnFilters: EsgEventFilters,
): EsgAgendaEvent {
  const status = statusPresentation(event.temporal.status);
  return {
    id: String(event.id),
    title: event.name,
    summary: event.summary,
    detailHref: buildEsgEventDetailUrl(event.id, returnFilters),
    officialUrl: event.eventUrl,
    startDate: event.startDate,
    endDate: event.endDate,
    startDateTime: event.temporal.startInstant
      ?? (event.startDate && event.startTime ? `${event.startDate}T${event.startTime}` : null),
    endDateTime: event.temporal.endInstant
      ?? (event.endTime && (event.endDate ?? event.startDate)
        ? `${event.endDate ?? event.startDate}T${event.endTime}`
        : null),
    ...eventDateParts(event),
    dateLabel: formatEventDateRange(event.startDate, event.endDate),
    statusLabel: status.label,
    statusTone: status.tone,
    timeLabel: formatEventTime(event.startTime, event.endTime),
    timezoneLabel: event.timezoneIana ?? event.timezoneRaw,
    locationLabel: describeEsgEventLocation(event),
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    attendanceLabel: attendanceLabel(event),
    organizer: event.organizerName,
    source: event.source,
  };
}

export function toDetailEvent(event: EsgEventDto): Omit<EsgDetailEvent, "media"> {
  return {
    ...toAgendaEvent(event, { when: "upcoming", page: 1 }),
    detailHref: `/esg/events/${event.id}`,
    description: event.summary,
    tags: event.tags
      ? event.tags.split(/[,;|]/).map((tag) => tag.trim()).filter(Boolean).slice(0, 12)
      : [],
    ticketUrl: event.ticketsUrl,
  };
}

export function toRelatedEvent(event: EsgEventDto, returnPath: string): EsgRelatedEvent {
  const status = statusPresentation(event.temporal.status);
  return {
    id: String(event.id),
    title: event.name,
    dateLabel: formatEventDateRange(event.startDate, event.endDate),
    locationLabel: describeEsgEventLocation(event),
    statusLabel: status.label,
    href: `/esg/events/${event.id}?back=${encodeURIComponent(returnPath)}`,
  };
}
