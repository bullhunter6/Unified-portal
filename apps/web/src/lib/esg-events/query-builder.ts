import { getMonthWindow } from "./dates";
import {
  buildEsgEventClassificationSql,
  type EsgEventSchemaCapabilities,
} from "./classification-sql";
import {
  ESG_MAX_TRUSTED_EVENT_RANGE_DAYS,
  type EsgEventFilters,
  type EsgRequestClock,
} from "./types";

export type EsgEventPredicateField = "when" | "q" | "country" | "city" | "format" | "source";

export type EsgSqlPredicate = {
  text: string;
  values: ReadonlyArray<string | number>;
};

export type { EsgEventSchemaCapabilities } from "./classification-sql";

export type EsgEventDatabaseContext = {
  schema: EsgEventSchemaCapabilities;
  /** A JSON object whose keys are PostgreSQL-recognized timezone names. */
  validTimezonesJson: string;
};

export const CURRENT_ESG_EVENT_SCHEMA: EsgEventSchemaCapabilities = {
  countryCode: true,
  city: true,
  attendanceMode: true,
  timezoneIana: true,
  eventData: false,
};

const CURRENT_DATABASE_CONTEXT: EsgEventDatabaseContext = {
  schema: CURRENT_ESG_EVENT_SCHEMA,
  // Pure predicate callers do not classify instants. The repository always
  // supplies the database-derived timezone set for upcoming/past queries.
  validTimezonesJson: "{}",
};

const EFFECTIVE_START_DATE = "COALESCE(e.start_date, e.end_date)";
const EFFECTIVE_END_DATE = `CASE
  WHEN e.start_date IS NULL THEN e.end_date
  WHEN e.end_date IS NULL
    OR e.end_date < e.start_date
    OR e.end_date > e.start_date + ${ESG_MAX_TRUSTED_EVENT_RANGE_DAYS}
  THEN e.start_date
  ELSE e.end_date
END`;

// Only complete and internally consistent local intervals are treated as instants.
// The timezone lookup is materialized once by the repository and passed as JSON,
// avoiding a pg_timezone_names scan for every row and query branch.
export function buildEsgExactIntervalEligibilitySql(
  schema: EsgEventSchemaCapabilities,
  validTimezonesSql: string,
): string {
  if (!schema.timezoneIana) return "FALSE";
  return `
  WHEN e.start_date IS NOT NULL
    AND e.start_time IS NOT NULL
    AND e.end_time IS NOT NULL
    AND e.timezone_iana IS NOT NULL
    AND (
      e.end_date IS NULL
      OR (
        e.end_date >= e.start_date
        AND e.end_date <= e.start_date + ${ESG_MAX_TRUSTED_EVENT_RANGE_DAYS}
      )
    )
    AND (${validTimezonesSql}) ? e.timezone_iana
    AND (
      (${EFFECTIVE_END_DATE}) > e.start_date
      OR e.end_time >= e.start_time
    )`.replace(/^\s*WHEN\s*/, "");
}

export function buildEsgExactEndInstantSql(
  schema: EsgEventSchemaCapabilities,
  validTimezonesSql: string,
): string {
  if (!schema.timezoneIana) return "NULL::timestamptz";
  return `CASE
  WHEN ${buildEsgExactIntervalEligibilitySql(schema, validTimezonesSql)}
  THEN ((${EFFECTIVE_END_DATE}) + e.end_time) AT TIME ZONE e.timezone_iana
  ELSE NULL
END`;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export function buildEsgEventPredicate(
  filters: EsgEventFilters,
  clock: EsgRequestClock,
  options: {
    exclude?: ReadonlyArray<EsgEventPredicateField>;
    database?: EsgEventDatabaseContext;
  } = {},
): EsgSqlPredicate {
  const excluded = new Set(options.exclude ?? []);
  const database = options.database ?? CURRENT_DATABASE_CONTEXT;
  const schema = database.schema;
  const classification = buildEsgEventClassificationSql(schema);
  const clauses: string[] = [];
  const values: Array<string | number> = [];
  const parameter = (value: string | number, cast: string) => {
    values.push(value);
    return `$${values.length}::${cast}`;
  };

  if (!excluded.has("when")) {
    switch (filters.when) {
      case "upcoming": {
        const today = parameter(clock.dubaiToday, "date");
        if (!schema.timezoneIana) {
          clauses.push(`(${EFFECTIVE_END_DATE}) >= ${today}`);
          break;
        }
        const now = parameter(clock.nowIso, "timestamptz");
        const validTimezones = parameter(database.validTimezonesJson, "jsonb");
        const exactEligible = buildEsgExactIntervalEligibilitySql(schema, validTimezones);
        clauses.push(`
          (${EFFECTIVE_END_DATE}) >= (${today} - 1)
          AND CASE
            WHEN ${exactEligible}
            THEN ((${EFFECTIVE_END_DATE}) + e.end_time) AT TIME ZONE e.timezone_iana >= ${now}
            ELSE (${EFFECTIVE_END_DATE}) >= ${today}
          END
        `);
        break;
      }
      case "week": {
        const today = parameter(clock.dubaiToday, "date");
        const weekEnd = parameter(clock.dubaiWeekEnd, "date");
        clauses.push(`(${EFFECTIVE_START_DATE}) <= ${weekEnd} AND (${EFFECTIVE_END_DATE}) >= ${today}`);
        break;
      }
      case "past": {
        const today = parameter(clock.dubaiToday, "date");
        if (!schema.timezoneIana) {
          clauses.push(`(${EFFECTIVE_END_DATE}) < ${today}`);
          break;
        }
        const now = parameter(clock.nowIso, "timestamptz");
        const validTimezones = parameter(database.validTimezonesJson, "jsonb");
        const exactEligible = buildEsgExactIntervalEligibilitySql(schema, validTimezones);
        clauses.push(`
          (${EFFECTIVE_END_DATE}) <= (${today} + 1)
          AND CASE
            WHEN ${exactEligible}
            THEN ((${EFFECTIVE_END_DATE}) + e.end_time) AT TIME ZONE e.timezone_iana < ${now}
            ELSE (${EFFECTIVE_END_DATE}) < ${today}
          END
        `);
        break;
      }
      case "tbc":
        clauses.push("e.start_date IS NULL AND e.end_date IS NULL");
        break;
      case "all":
        break;
      default: {
        const month = getMonthWindow(filters.when);
        const monthStart = parameter(month.start, "date");
        const nextMonth = parameter(month.next, "date");
        clauses.push(`(${EFFECTIVE_START_DATE}) < ${nextMonth} AND (${EFFECTIVE_END_DATE}) >= ${monthStart}`);
      }
    }
  }

  if (!excluded.has("q") && filters.q) {
    const query = parameter(`%${escapeLike(filters.q)}%`, "text");
    clauses.push(`concat_ws(' ',
      e.event_name,
      e.organizer_name,
      e.summary,
      e.tags,
      e.source,
      e.venue_name,
      e.venue_address,
      ${schema.city ? "e.city" : "NULL::text"},
      ${schema.countryCode ? "e.country_code" : "NULL::text"}
    ) ILIKE ${query} ESCAPE '\\'`);
  }
  if (!excluded.has("country") && filters.country) {
    clauses.push(`(${classification.countryCode}) = ${parameter(filters.country, "text")}`);
  }
  if (!excluded.has("city") && filters.city) {
    clauses.push(`lower(${classification.city}) = lower(${parameter(filters.city, "text")})`);
  }
  if (!excluded.has("format") && filters.format) {
    if (filters.format === "unknown") clauses.push(`(${classification.attendanceMode}) IS NULL`);
    else {
      const databaseValue = filters.format === "in-person" ? "in_person" : filters.format;
      clauses.push(`(${classification.attendanceMode}) = ${parameter(databaseValue, "text")}`);
    }
  }
  if (!excluded.has("source") && filters.source) {
    clauses.push(`lower(e.source) = lower(${parameter(filters.source, "text")})`);
  }

  return {
    text: clauses.length ? clauses.map((clause) => `(${clause})`).join(" AND ") : "TRUE",
    values,
  };
}

export const ESG_EFFECTIVE_START_DATE_SQL = EFFECTIVE_START_DATE;
export const ESG_EFFECTIVE_END_DATE_SQL = EFFECTIVE_END_DATE;
