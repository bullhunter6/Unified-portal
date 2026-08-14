export const ESG_EVENTS_PAGE_SIZE = 20;

// Calendar overlap is useful for conferences and programmes that genuinely span
// several months. Ranges longer than a full leap year are treated as untrusted
// source data and fall back to the event's start date until reviewed.
export const ESG_MAX_TRUSTED_EVENT_RANGE_DAYS = 366;

export const ESG_EVENT_QUICK_WHEN_VALUES = [
  "upcoming",
  "week",
  "past",
  "tbc",
  "all",
] as const;

export type EsgEventQuickWhen = (typeof ESG_EVENT_QUICK_WHEN_VALUES)[number];
export type EsgEventWhen = EsgEventQuickWhen | `${number}-${number}`;

export const ESG_EVENT_FORMAT_VALUES = [
  "in-person",
  "online",
  "hybrid",
  "unknown",
] as const;

export type EsgEventFormat = (typeof ESG_EVENT_FORMAT_VALUES)[number];
export type EsgAttendanceMode = "in_person" | "online" | "hybrid";

export type EsgEventFilters = {
  when: EsgEventWhen;
  q?: string;
  country?: string;
  city?: string;
  format?: EsgEventFormat;
  source?: string;
  page: number;
};

export type EsgEventSearchParamValue = string | readonly string[] | undefined;
export type EsgEventSearchParams = Record<string, EsgEventSearchParamValue> | URLSearchParams;

export type EsgEventQueryIssue =
  | "duplicate"
  | "invalid"
  | "legacy"
  | "unknown"
  | "default-value"
  | "dependent-filter";

export type ParsedEsgEventSearch = {
  filters: EsgEventFilters;
  canonicalSearch: string;
  needsRedirect: boolean;
  issues: ReadonlyArray<{ key: string; issue: EsgEventQueryIssue }>;
};

export type EsgTemporalStatus =
  | "happening-now"
  | "today"
  | "in-progress"
  | "upcoming"
  | "past"
  | "date-tbc";

export type EsgTemporalClassification = {
  status: EsgTemporalStatus;
  precision: "instant" | "date" | "undated";
  startInstant: string | null;
  endInstant: string | null;
};

export type EsgRequestClock = {
  now: Date;
  nowIso: string;
  dubaiToday: string;
  dubaiWeekEnd: string;
  currentMonth: string;
};

export type EsgEventDto = {
  id: number;
  externalId: string | null;
  name: string;
  eventUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  timezoneRaw: string | null;
  timezoneIana: string | null;
  imageUrl: string | null;
  ticketPrice: string | null;
  ticketsUrl: string | null;
  venueName: string | null;
  venueAddress: string | null;
  city: string | null;
  countryCode: string | null;
  countryLabel: string | null;
  attendanceMode: EsgAttendanceMode | null;
  organizerName: string | null;
  organizerUrl: string | null;
  summary: string | null;
  tags: string | null;
  source: string | null;
  createdAt: string | null;
  temporal: EsgTemporalClassification;
};

export type EsgEventSummary = {
  upcoming: number;
  thisMonth: number;
  representedCountries: number;
};

export type EsgCountFacet<T extends string = string> = {
  value: T;
  label: string;
  count: number;
};

export type EsgEventFacets = {
  time: ReadonlyArray<EsgCountFacet<EsgEventQuickWhen>>;
  countries: ReadonlyArray<EsgCountFacet>;
  cities: ReadonlyArray<EsgCountFacet>;
  citiesByCountry: Readonly<Record<string, ReadonlyArray<EsgCountFacet>>>;
  formats: ReadonlyArray<EsgCountFacet<EsgEventFormat>>;
  sources: ReadonlyArray<EsgCountFacet>;
  months: ReadonlyArray<EsgCountFacet>;
};

export type EsgEventListResult = {
  items: ReadonlyArray<EsgEventDto>;
  total: number;
  page: number;
  pageSize: typeof ESG_EVENTS_PAGE_SIZE;
  totalPages: number;
  summary: EsgEventSummary;
  facets: EsgEventFacets;
  clock: EsgRequestClock;
};
