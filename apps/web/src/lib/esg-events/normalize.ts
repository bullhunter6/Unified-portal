import {
  isValidDateString,
  isValidIanaTimeZone,
  normalizeTimeValue,
  trustedEventEndDate,
} from "./dates";
import { getCountryLabel, isIso2CountryCode } from "./country";
import { classifyEsgEventTemporal } from "./temporal";
import type { EsgAttendanceMode, EsgEventDto, EsgRequestClock } from "./types";
import { normalizeExternalUrl } from "./urls";

export type RawEsgEventRow = {
  id: number;
  external_id: string | null;
  event_name: string | null;
  event_url: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  timezone_raw: string | null;
  timezone_iana: string | null;
  image_url: string | null;
  ticket_price: string | null;
  tickets_url: string | null;
  venue_name: string | null;
  venue_address: string | null;
  city: string | null;
  country_code: string | null;
  attendance_mode: string | null;
  organizer_name: string | null;
  organizer_url: string | null;
  summary: string | null;
  tags: string | null;
  source: string | null;
  created_at: string | null;
};

function clean(value: string | null | undefined): string | null {
  const result = value?.trim().replace(/\s+/g, " ");
  return result || null;
}

export { getCountryLabel } from "./country";

export function normalizeVenue(
  rawName: string | null | undefined,
  rawAddress: string | null | undefined,
): { name: string | null; address: string | null } {
  const name = clean(rawName);
  let address = clean(rawAddress);
  if (name && address) {
    const comparable = (value: string) => value.toLocaleLowerCase("en").replace(/[\s,.;:/\\\-_()]+/g, " ").trim();
    if (comparable(name) === comparable(address)) address = null;
  }
  return { name, address };
}

export function normalizeAttendanceMode(value: string | null | undefined): EsgAttendanceMode | null {
  return value === "in_person" || value === "online" || value === "hybrid" ? value : null;
}

export function describeEsgEventLocation(event: {
  attendanceMode: EsgAttendanceMode | null;
  city: string | null;
  countryLabel: string | null;
}): string {
  if (event.attendanceMode === "online") return "Online";
  const place = [event.city, event.countryLabel].filter(Boolean).join(", ");
  if (place && event.attendanceMode === "hybrid") return `${place} · Hybrid`;
  if (place) return place;
  return event.attendanceMode === "hybrid" ? "Hybrid · Location TBC" : "Location TBC";
}

export function normalizeEsgEventRow(row: RawEsgEventRow, clock: EsgRequestClock): EsgEventDto {
  const startDate = isValidDateString(row.start_date) ? row.start_date : null;
  const rawEndDate = isValidDateString(row.end_date) ? row.end_date : null;
  const endDate = trustedEventEndDate(startDate, rawEndDate);
  const startTime = normalizeTimeValue(row.start_time);
  const endTime = normalizeTimeValue(row.end_time);
  const timezoneIana = isValidIanaTimeZone(row.timezone_iana) ? row.timezone_iana : null;
  const countryCode = isIso2CountryCode(row.country_code) ? row.country_code : null;
  const attendanceMode = normalizeAttendanceMode(row.attendance_mode);
  const venue = normalizeVenue(row.venue_name, row.venue_address);
  const temporalInput = { startDate, endDate: rawEndDate, startTime, endTime, timezoneIana };

  return {
    id: row.id,
    externalId: clean(row.external_id),
    name: clean(row.event_name) ?? "Untitled event",
    eventUrl: normalizeExternalUrl(row.event_url),
    startDate,
    endDate,
    startTime,
    endTime,
    timezoneRaw: clean(row.timezone_raw),
    timezoneIana,
    imageUrl: normalizeExternalUrl(row.image_url),
    ticketPrice: clean(row.ticket_price),
    ticketsUrl: normalizeExternalUrl(row.tickets_url),
    venueName: venue.name,
    venueAddress: venue.address,
    city: clean(row.city),
    countryCode,
    countryLabel: getCountryLabel(countryCode),
    attendanceMode,
    organizerName: clean(row.organizer_name),
    organizerUrl: normalizeExternalUrl(row.organizer_url),
    summary: clean(row.summary),
    tags: clean(row.tags),
    source: clean(row.source),
    createdAt: row.created_at,
    temporal: classifyEsgEventTemporal(temporalInput, clock),
  };
}
