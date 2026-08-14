import type { ReactNode } from "react";

export type LedgerStatusTone =
  | "live"
  | "today"
  | "progress"
  | "upcoming"
  | "past"
  | "tbc";

export interface EsgLedgerSummary {
  upcoming: number;
  thisMonth: number;
  countries: number;
}

export interface EsgTimeOption {
  value: string;
  label: string;
  href: string;
  description?: string;
  group?: "quick" | "month";
}

export interface EsgFilterChoice {
  value: string;
  label: string;
  count?: number;
}

export interface EsgCountryChoice extends EsgFilterChoice {
  cities?: EsgFilterChoice[];
}

export interface EsgFilterState {
  q: string;
  country: string;
  city: string;
  format: string;
  source: string;
  /** Empty means the canonical Upcoming view. */
  when?: string;
}

export interface EsgAppliedFilter {
  key: "q" | "country" | "city" | "format" | "source";
  label: string;
  value: string;
  removeHref: string;
}

export interface EsgAgendaEvent {
  id: string;
  title: string;
  summary: string | null;
  detailHref: string;
  officialUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  startDateTime?: string | null;
  endDateTime?: string | null;
  dateMonth: string;
  dateDay: string;
  dateYear: string;
  dateLabel: string;
  statusLabel: string;
  statusTone: LedgerStatusTone;
  timeLabel: string;
  timezoneLabel?: string | null;
  locationLabel: string;
  venueName?: string | null;
  venueAddress?: string | null;
  attendanceLabel?: string | null;
  organizer?: string | null;
  source?: string | null;
}

export interface EsgPageLink {
  page: number;
  href: string;
}

export interface EsgRelatedEvent {
  id: string;
  title: string;
  dateLabel: string;
  locationLabel: string;
  statusLabel?: string;
  href: string;
}

export interface EsgDetailEvent extends EsgAgendaEvent {
  description?: string | null;
  tags?: string[];
  ticketUrl?: string | null;
  media?: ReactNode;
}
