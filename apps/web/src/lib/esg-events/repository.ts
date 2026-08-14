import "server-only";

import { esgPrisma } from "@esgcredit/db-esg";
import {
  buildEsgEventClassificationSql,
  classifyEsgEventFields,
  type EsgEventClassificationInput,
} from "./classification-sql";
import { createEsgRequestClock, getMonthWindow } from "./dates";
import { getCountryLabel, normalizeEsgEventRow, type RawEsgEventRow } from "./normalize";
import {
  buildEsgExactEndInstantSql,
  buildEsgExactIntervalEligibilitySql,
  buildEsgEventPredicate,
  ESG_EFFECTIVE_END_DATE_SQL,
  ESG_EFFECTIVE_START_DATE_SQL,
  type EsgEventDatabaseContext,
  type EsgEventSchemaCapabilities,
  type EsgSqlPredicate,
} from "./query-builder";
import {
  ESG_EVENTS_PAGE_SIZE,
  type EsgCountFacet,
  type EsgEventDto,
  type EsgEventFacets,
  type EsgEventFilters,
  type EsgEventFormat,
  type EsgEventListResult,
  type EsgEventQuickWhen,
  type EsgEventSummary,
  type EsgRequestClock,
} from "./types";
import {
  assertEsgWeeklyDigestWindow,
  type EsgWeeklyDigestWindow,
} from "./weekly-digest-dates";

const OPTIONAL_EVENT_COLUMNS = [
  "country_code",
  "city",
  "attendance_mode",
  "timezone_iana",
  "event_data",
] as const;

type OptionalEventColumn = (typeof OPTIONAL_EVENT_COLUMNS)[number];
type ColumnNameRow = { column_name: OptionalEventColumn };
type TimezoneNameRow = { name: string };

let databaseContextPromise: Promise<EsgEventDatabaseContext> | null = null;

async function loadDatabaseContext(): Promise<EsgEventDatabaseContext> {
  const columns = await esgPrisma.$queryRawUnsafe<ColumnNameRow[]>(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'events'
      AND column_name = ANY(ARRAY[
        'country_code',
        'city',
        'attendance_mode',
        'timezone_iana',
        'event_data'
      ])
  `);
  const available = new Set(columns.map((row) => row.column_name));
  const schema: EsgEventSchemaCapabilities = {
    countryCode: available.has("country_code"),
    city: available.has("city"),
    attendanceMode: available.has("attendance_mode"),
    timezoneIana: available.has("timezone_iana"),
    eventData: available.has("event_data"),
  };
  const timezoneRows = schema.timezoneIana
    ? await esgPrisma.$queryRawUnsafe<TimezoneNameRow[]>("SELECT name FROM pg_timezone_names")
    : [];
  return {
    schema,
    validTimezonesJson: JSON.stringify(Object.fromEntries(timezoneRows.map(({ name }) => [name, true]))),
  };
}

function getDatabaseContext(): Promise<EsgEventDatabaseContext> {
  databaseContextPromise ??= loadDatabaseContext().catch((error) => {
    databaseContextPromise = null;
    throw error;
  });
  return databaseContextPromise;
}

function optionalColumn(column: OptionalEventColumn, available: boolean): string {
  return available ? `e.${column}` : "NULL::text";
}

function eventSelect(schema: EsgEventSchemaCapabilities): string {
  const classification = buildEsgEventClassificationSql(schema);
  return `
  e.id,
  e.event_id AS external_id,
  e.event_name,
  e.event_url,
  to_char(e.start_date, 'YYYY-MM-DD') AS start_date,
  to_char(e.end_date, 'YYYY-MM-DD') AS end_date,
  to_char(e.start_time, 'HH24:MI') AS start_time,
  to_char(e.end_time, 'HH24:MI') AS end_time,
  e.timezone AS timezone_raw,
  ${optionalColumn("timezone_iana", schema.timezoneIana)} AS timezone_iana,
  e.image_url,
  e.ticket_price,
  e.tickets_url,
  e.venue_name,
  e.venue_address,
  ${classification.city} AS city,
  ${classification.countryCode} AS country_code,
  ${classification.attendanceMode} AS attendance_mode,
  e.organizer_name,
  e.organizer_url,
  e.summary,
  e.tags,
  e.source,
  to_char(e.created_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS created_at
`;
}

type CountRow = { count: number };
type ValueCountRow = { value: string; count: number };
type CountryCityCountRow = { country_code: string; value: string; count: number };
type DiscoveryClassificationRow = EsgEventClassificationInput;
type SummaryRow = {
  upcoming: number;
  this_month: number;
  represented_countries: number;
};
type TimeFacetRow = {
  upcoming: number;
  week: number;
  past: number;
  tbc: number;
  all_events: number;
};

function incrementCount(map: Map<string, number>, value: string): void {
  map.set(value, (map.get(value) ?? 0) + 1);
}

function countRows(map: Map<string, number>): ValueCountRow[] {
  return Array.from(map, ([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
}

function addParameter(
  values: Array<string | number | null>,
  value: string | number | null,
  cast: string,
): string {
  values.push(value);
  return `$${values.length}::${cast}`;
}

function eventOrder(when: EsgEventFilters["when"]): string {
  if (when === "past") return `${ESG_EFFECTIVE_END_DATE_SQL} DESC NULLS LAST, e.id DESC`;
  if (when === "tbc") return "e.created_at DESC NULLS LAST, e.id DESC";
  return `${ESG_EFFECTIVE_START_DATE_SQL} ASC NULLS LAST, e.start_time ASC NULLS LAST, e.id ASC`;
}

async function queryRows(
  predicate: EsgSqlPredicate,
  filters: EsgEventFilters,
  database: EsgEventDatabaseContext,
): Promise<RawEsgEventRow[]> {
  const classification = buildEsgEventClassificationSql(database.schema);
  const values: Array<string | number | null> = [...predicate.values];
  const limit = addParameter(values, ESG_EVENTS_PAGE_SIZE, "int");
  const offset = addParameter(values, (filters.page - 1) * ESG_EVENTS_PAGE_SIZE, "int");
  return esgPrisma.$queryRawUnsafe<RawEsgEventRow[]>(`
    SELECT ${eventSelect(database.schema)}
    FROM events e
    ${classification.join}
    WHERE ${predicate.text}
    ORDER BY ${eventOrder(filters.when)}
    LIMIT ${limit} OFFSET ${offset}
  `, ...values);
}

async function queryCount(
  predicate: EsgSqlPredicate,
  database: EsgEventDatabaseContext,
): Promise<number> {
  const classification = buildEsgEventClassificationSql(database.schema);
  const classificationJoin = predicate.text.includes("esg_class.") ? classification.join : "";
  const [row] = await esgPrisma.$queryRawUnsafe<CountRow[]>(`
    SELECT COUNT(*)::int AS count
    FROM events e
    ${classificationJoin}
    WHERE ${predicate.text}
  `, ...predicate.values);
  return row?.count ?? 0;
}

async function querySummary(
  filters: EsgEventFilters,
  clock: EsgRequestClock,
  database: EsgEventDatabaseContext,
): Promise<EsgEventSummary> {
  const base = buildEsgEventPredicate(filters, clock, {
    exclude: ["when"],
    database,
  });
  const values: Array<string | number | null> = [...base.values];
  const today = addParameter(values, clock.dubaiToday, "date");
  const now = database.schema.timezoneIana
    ? addParameter(values, clock.nowIso, "timestamptz")
    : "NULL::timestamptz";
  const currentMonth = getMonthWindow(clock.currentMonth);
  const monthStart = addParameter(values, currentMonth.start, "date");
  const nextMonth = addParameter(values, currentMonth.next, "date");
  const validTimezones = database.schema.timezoneIana
    ? addParameter(values, database.validTimezonesJson, "jsonb")
    : "NULL::jsonb";
  const exactEligible = buildEsgExactIntervalEligibilitySql(database.schema, validTimezones);
  const classification = buildEsgEventClassificationSql(database.schema);
  const upcomingCondition = database.schema.timezoneIana
    ? `CASE
        WHEN ${exactEligible}
        THEN ((${ESG_EFFECTIVE_END_DATE_SQL}) + e.end_time) AT TIME ZONE e.timezone_iana >= ${now}
        ELSE (${ESG_EFFECTIVE_END_DATE_SQL}) >= ${today}
      END`
    : `(${ESG_EFFECTIVE_END_DATE_SQL}) >= ${today}`;
  const countriesSql = `COUNT(DISTINCT ${classification.countryCode})
    FILTER (WHERE (${classification.countryCode}) IS NOT NULL)::int`;
  const [row] = await esgPrisma.$queryRawUnsafe<SummaryRow[]>(`
    SELECT
      COUNT(*) FILTER (WHERE
        ${upcomingCondition}
      )::int AS upcoming,
      COUNT(*) FILTER (WHERE
        (${ESG_EFFECTIVE_START_DATE_SQL}) < ${nextMonth}
        AND (${ESG_EFFECTIVE_END_DATE_SQL}) >= ${monthStart}
      )::int AS this_month,
      ${countriesSql} AS represented_countries
    FROM events e
    ${classification.join}
    WHERE ${base.text}
  `, ...values);
  return {
    upcoming: row?.upcoming ?? 0,
    thisMonth: row?.this_month ?? 0,
    representedCountries: row?.represented_countries ?? 0,
  };
}

async function queryValueFacet(
  predicate: EsgSqlPredicate,
  valueSql: string,
  presentSql: string,
  database: EsgEventDatabaseContext,
): Promise<ValueCountRow[]> {
  const classification = buildEsgEventClassificationSql(database.schema);
  const classificationJoin = [predicate.text, valueSql, presentSql].some((sql) => sql.includes("esg_class."))
    ? classification.join
    : "";
  return esgPrisma.$queryRawUnsafe<ValueCountRow[]>(`
    SELECT ${valueSql} AS value, COUNT(*)::int AS count
    FROM events e
    ${classificationJoin}
    WHERE ${predicate.text} AND ${presentSql}
    GROUP BY ${valueSql}
    ORDER BY count DESC, value ASC
  `, ...predicate.values);
}

async function queryDiscoveryFacets(
  filters: EsgEventFilters,
  clock: EsgRequestClock,
  database: EsgEventDatabaseContext,
): Promise<{
  countries: ValueCountRow[];
  cities: ValueCountRow[];
  allCities: CountryCityCountRow[];
  formats: ValueCountRow[];
}> {
  const predicate = buildEsgEventPredicate(filters, clock, {
    exclude: ["country", "city", "format"],
    database,
  });
  const normalizedCountry = database.schema.countryCode ? "e.country_code" : "NULL::text";
  const normalizedCity = database.schema.city ? "e.city" : "NULL::text";
  const normalizedMode = database.schema.attendanceMode ? "e.attendance_mode" : "NULL::text";
  const data = (path: string) => database.schema.eventData
    ? `e.event_data ${path}`
    : "NULL::text";
  const rows = await esgPrisma.$queryRawUnsafe<DiscoveryClassificationRow[]>(`
    SELECT
      ${normalizedCountry} AS "normalizedCountryCode",
      ${normalizedCity} AS "normalizedCity",
      ${normalizedMode} AS "normalizedAttendanceMode",
      e.event_name AS "eventName",
      e.event_url AS "eventUrl",
      e.tags,
      e.venue_name AS "venueName",
      e.venue_address AS "venueAddress",
      ${data("->> 'Venue Name'")} AS "jsonVenueName",
      ${data("->> 'Venue Address'")} AS "jsonVenueAddress",
      ${data("->> 'Attendance Mode'")} AS "jsonAttendanceMode",
      ${data("#>> '{Structured Data,location,address,addressCountry}'")} AS "structuredCountry",
      ${data("#>> '{Structured Data,location,address,addressLocality}'")} AS "structuredCity",
      ${data("#>> '{Structured Data,location,@type}'")} AS "structuredLocationType",
      ${data("#>> '{Structured Data,eventAttendanceMode}'")} AS "structuredAttendanceMode",
      ${data("->> 'Online Event URL'")} AS "onlineEventUrl"
    FROM events e
    WHERE ${predicate.text}
  `, ...predicate.values);

  const countries = new Map<string, number>();
  const cities = new Map<string, number>();
  const countryCities = new Map<string, number>();
  const formats = new Map<string, number>();
  const selectedMode = filters.format === "in-person" ? "in_person" : filters.format;
  const selectedCity = filters.city?.toLocaleLowerCase("en");

  for (const row of rows) {
    const classified = classifyEsgEventFields(row);
    const formatValue = classified.attendanceMode ?? "unknown";
    const matchesFormat = !selectedMode || formatValue === selectedMode;
    const matchesCountry = !filters.country || classified.countryCode === filters.country;
    const matchesCity = !selectedCity || classified.city?.toLocaleLowerCase("en") === selectedCity;

    if (matchesFormat && classified.countryCode) {
      incrementCount(countries, classified.countryCode);
      if (classified.city) {
        incrementCount(countryCities, `${classified.countryCode}\u0000${classified.city}`);
      }
    }
    if (matchesFormat && matchesCountry && classified.city) incrementCount(cities, classified.city);
    if (matchesCountry && matchesCity) incrementCount(formats, formatValue);
  }

  const allCities = Array.from(countryCities, ([key, count]) => {
    const [country_code, value] = key.split("\u0000");
    return { country_code, value, count };
  }).sort((left, right) =>
    left.country_code.localeCompare(right.country_code) ||
    right.count - left.count ||
    left.value.localeCompare(right.value));

  return {
    countries: countRows(countries),
    cities: countRows(cities),
    allCities,
    formats: countRows(formats),
  };
}

async function queryTimeFacet(
  filters: EsgEventFilters,
  clock: EsgRequestClock,
  database: EsgEventDatabaseContext,
): Promise<ReadonlyArray<EsgCountFacet<EsgEventQuickWhen>>> {
  const base = buildEsgEventPredicate(filters, clock, {
    exclude: ["when"],
    database,
  });
  const values: Array<string | number | null> = [...base.values];
  const now = addParameter(values, clock.nowIso, "timestamptz");
  const today = addParameter(values, clock.dubaiToday, "date");
  const weekEnd = addParameter(values, clock.dubaiWeekEnd, "date");
  const validTimezones = database.schema.timezoneIana
    ? addParameter(values, database.validTimezonesJson, "jsonb")
    : "NULL::jsonb";
  const exactEnd = buildEsgExactEndInstantSql(database.schema, validTimezones);
  const classification = buildEsgEventClassificationSql(database.schema);
  const classificationJoin = base.text.includes("esg_class.") ? classification.join : "";
  const [row] = await esgPrisma.$queryRawUnsafe<TimeFacetRow[]>(`
    WITH matching AS (
      SELECT e.*,
        ${exactEnd} AS exact_end
      FROM events e
      ${classificationJoin}
      WHERE ${base.text}
    )
    SELECT
      COUNT(*) FILTER (WHERE
        exact_end >= ${now}
        OR exact_end IS NULL AND (${ESG_EFFECTIVE_END_DATE_SQL.replaceAll("e.", "matching.")}) >= ${today}
      )::int AS upcoming,
      COUNT(*) FILTER (WHERE
        (${ESG_EFFECTIVE_START_DATE_SQL.replaceAll("e.", "matching.")}) <= ${weekEnd}
        AND (${ESG_EFFECTIVE_END_DATE_SQL.replaceAll("e.", "matching.")}) >= ${today}
      )::int AS week,
      COUNT(*) FILTER (WHERE
        exact_end < ${now}
        OR exact_end IS NULL AND (${ESG_EFFECTIVE_END_DATE_SQL.replaceAll("e.", "matching.")}) < ${today}
      )::int AS past,
      COUNT(*) FILTER (WHERE start_date IS NULL AND end_date IS NULL)::int AS tbc,
      COUNT(*)::int AS all_events
    FROM matching
  `, ...values);
  const counts = row ?? { upcoming: 0, week: 0, past: 0, tbc: 0, all_events: 0 };
  return [
    { value: "upcoming", label: "Upcoming", count: counts.upcoming },
    { value: "week", label: "This week", count: counts.week },
    { value: "past", label: "Past", count: counts.past },
    { value: "tbc", label: "Date TBC", count: counts.tbc },
    { value: "all", label: "All", count: counts.all_events },
  ];
}

async function queryMonthFacet(
  filters: EsgEventFilters,
  clock: EsgRequestClock,
  database: EsgEventDatabaseContext,
): Promise<ReadonlyArray<EsgCountFacet>> {
  const predicate = buildEsgEventPredicate(filters, clock, {
    exclude: ["when"],
    database,
  });
  const classification = buildEsgEventClassificationSql(database.schema);
  const classificationJoin = predicate.text.includes("esg_class.") ? classification.join : "";
  const rows = await esgPrisma.$queryRawUnsafe<ValueCountRow[]>(`
    SELECT to_char(months.month_start, 'YYYY-MM') AS value, COUNT(*)::int AS count
    FROM events e
    ${classificationJoin}
    CROSS JOIN LATERAL generate_series(
      date_trunc('month', ${ESG_EFFECTIVE_START_DATE_SQL}),
      date_trunc('month', ${ESG_EFFECTIVE_END_DATE_SQL}),
      interval '1 month'
    ) AS months(month_start)
    WHERE ${predicate.text}
      AND (${ESG_EFFECTIVE_START_DATE_SQL}) IS NOT NULL
      AND (${ESG_EFFECTIVE_END_DATE_SQL}) IS NOT NULL
    GROUP BY months.month_start
    ORDER BY months.month_start ASC
  `, ...predicate.values);
  return rows.map((row) => ({
    value: row.value,
    label: new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" })
      .format(new Date(`${row.value}-01T00:00:00Z`)),
    count: row.count,
  }));
}

async function queryFacets(
  filters: EsgEventFilters,
  clock: EsgRequestClock,
  database: EsgEventDatabaseContext,
): Promise<EsgEventFacets> {
  const sourcePredicate = buildEsgEventPredicate(filters, clock, {
    exclude: ["source"],
    database,
  });
  const [time, discovery, sources, months] = await Promise.all([
    queryTimeFacet(filters, clock, database),
    queryDiscoveryFacets(filters, clock, database),
    queryValueFacet(
      sourcePredicate,
      "e.source",
      "e.source IS NOT NULL AND btrim(e.source) <> ''",
      database,
    ),
    queryMonthFacet(filters, clock, database),
  ]);
  const { countries, cities, allCities, formats } = discovery;
  const formatLabel: Record<EsgEventFormat, string> = {
    "in-person": "In person",
    online: "Online / webinar",
    hybrid: "Hybrid",
    unknown: "Unknown",
  };
  const citiesByCountry: Record<string, EsgCountFacet[]> = {};
  for (const row of allCities) {
    (citiesByCountry[row.country_code] ??= []).push({
      value: row.value,
      label: row.value,
      count: row.count,
    });
  }
  const formatOrder: readonly EsgEventFormat[] = ["online", "hybrid", "in-person", "unknown"];
  const mappedFormats: EsgCountFacet<EsgEventFormat>[] = formats.flatMap((row) => {
    const value = row.value === "in_person" ? "in-person" : row.value;
    if (value !== "in-person" && value !== "online" && value !== "hybrid" && value !== "unknown") return [];
    return [{ value: value as EsgEventFormat, label: formatLabel[value], count: row.count }];
  }).sort((left, right) => formatOrder.indexOf(left.value) - formatOrder.indexOf(right.value));
  return {
    time,
    countries: countries.map((row) => ({ value: row.value, label: getCountryLabel(row.value) ?? row.value, count: row.count })),
    cities: cities.map((row) => ({ value: row.value, label: row.value, count: row.count })),
    citiesByCountry,
    formats: mappedFormats,
    sources: sources.map((row) => ({ value: row.value, label: row.value, count: row.count })),
    months,
  };
}

export async function listEsgEvents(
  filters: EsgEventFilters,
  clock = createEsgRequestClock(),
): Promise<EsgEventListResult> {
  const database = await getDatabaseContext();
  const predicate = buildEsgEventPredicate(filters, clock, { database });
  const [rows, total, summary, facets] = await Promise.all([
    queryRows(predicate, filters, database),
    queryCount(predicate, database),
    querySummary(filters, clock, database),
    queryFacets(filters, clock, database),
  ]);
  return {
    items: rows.map((row) => normalizeEsgEventRow(row, clock)),
    total,
    page: filters.page,
    pageSize: ESG_EVENTS_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / ESG_EVENTS_PAGE_SIZE)),
    summary,
    facets,
    clock,
  };
}

/**
 * Returns every not-yet-past event overlapping an explicit Dubai-local week.
 * This intentionally bypasses ledger pagination and facet queries so the
 * weekly email cannot silently omit events after the first page.
 */
export async function listEsgWeeklyDigestEvents(
  window: EsgWeeklyDigestWindow,
  clock = createEsgRequestClock(),
): Promise<ReadonlyArray<EsgEventDto>> {
  assertEsgWeeklyDigestWindow(window);
  const database = await getDatabaseContext();
  const upcoming = buildEsgEventPredicate(
    { when: "upcoming", page: 1 },
    clock,
    { database },
  );
  const values: Array<string | number | null> = [...upcoming.values];
  const weekEnd = addParameter(values, window.weekEnd, "date");
  const weekStart = addParameter(values, window.weekStart, "date");
  const classification = buildEsgEventClassificationSql(database.schema);
  const rows = await esgPrisma.$queryRawUnsafe<RawEsgEventRow[]>(`
    SELECT ${eventSelect(database.schema)}
    FROM events e
    ${classification.join}
    WHERE ${upcoming.text}
      AND (${ESG_EFFECTIVE_START_DATE_SQL}) <= ${weekEnd}
      AND (${ESG_EFFECTIVE_END_DATE_SQL}) >= ${weekStart}
    ORDER BY ${eventOrder("upcoming")}
  `, ...values);

  return rows.map((row) => normalizeEsgEventRow(row, clock));
}

export async function getEsgEventById(
  id: number,
  clock = createEsgRequestClock(),
): Promise<EsgEventDto | null> {
  if (!Number.isSafeInteger(id) || id < 1 || id > 2_147_483_647) return null;
  const database = await getDatabaseContext();
  const classification = buildEsgEventClassificationSql(database.schema);
  const rows = await esgPrisma.$queryRawUnsafe<RawEsgEventRow[]>(`
    SELECT ${eventSelect(database.schema)}
    FROM events e
    ${classification.join}
    WHERE e.id = $1::int
    LIMIT 1
  `, id);
  return rows[0] ? normalizeEsgEventRow(rows[0], clock) : null;
}

export async function getRelatedEsgEvents(
  event: EsgEventDto,
  clock = createEsgRequestClock(),
  limit = 4,
): Promise<ReadonlyArray<EsgEventDto>> {
  const safeLimit = Math.min(8, Math.max(1, Math.trunc(limit)));
  const database = await getDatabaseContext();
  const classification = buildEsgEventClassificationSql(database.schema);
  const predicate = buildEsgEventPredicate(
    { when: "upcoming", page: 1 },
    clock,
    { database },
  );
  const values: Array<string | number | null> = [...predicate.values];
  const id = addParameter(values, event.id, "int");
  const country = addParameter(values, event.countryCode, "text");
  const city = addParameter(values, event.city, "text");
  const source = addParameter(values, event.source, "text");
  const rowLimit = addParameter(values, safeLimit, "int");
  const locationPriority = `CASE
    WHEN ${country} IS NOT NULL AND (${classification.countryCode}) = ${country} THEN 4
    ELSE 0
  END`;
  const cityPriority = `CASE
    WHEN ${city} IS NOT NULL AND lower(${classification.city}) = lower(${city}) THEN 3
    ELSE 0
  END`;
  const rows = await esgPrisma.$queryRawUnsafe<RawEsgEventRow[]>(`
    SELECT ${eventSelect(database.schema)}
    FROM events e
    ${classification.join}
    WHERE ${predicate.text} AND e.id <> ${id}
    ORDER BY (
      ${locationPriority}
      + ${cityPriority}
      + CASE WHEN ${source} IS NOT NULL AND lower(e.source) = lower(${source}) THEN 2 ELSE 0 END
    ) DESC,
    ${ESG_EFFECTIVE_START_DATE_SQL} ASC NULLS LAST,
    e.id ASC
    LIMIT ${rowLimit}
  `, ...values);
  return rows.map((row) => normalizeEsgEventRow(row, clock));
}
