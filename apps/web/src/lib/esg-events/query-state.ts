import { createEsgRequestClock, isValidMonth } from "./dates";
import { isIso2CountryCode } from "./country";
import {
  ESG_EVENT_FORMAT_VALUES,
  ESG_EVENT_QUICK_WHEN_VALUES,
  type EsgEventFilters,
  type EsgEventFormat,
  type EsgEventQueryIssue,
  type EsgEventSearchParams,
  type EsgEventWhen,
  type ParsedEsgEventSearch,
} from "./types";
import { buildEsgEventQuery } from "./urls";

const PUBLIC_KEYS = ["when", "q", "country", "city", "format", "source", "page"] as const;
const LEGACY_KEYS = ["dateRange", "month", "view", "pageSize"] as const;
const MAX_QUERY_LENGTH = 160;
const MAX_CITY_LENGTH = 120;
const MAX_SOURCE_LENGTH = 120;
const MAX_PAGE = 1_000_000;

type SearchReader = {
  keys: ReadonlyArray<string>;
  getAll(key: string): ReadonlyArray<string>;
};

function toReader(input: EsgEventSearchParams): SearchReader {
  if (input instanceof URLSearchParams) {
    return {
      keys: Array.from(new Set(input.keys())),
      getAll: (key) => input.getAll(key),
    };
  }

  return {
    keys: Object.keys(input),
    getAll: (key) => {
      const value = input[key];
      if (typeof value === "string") return [value];
      return value ? Array.from(value) : [];
    },
  };
}

function compactText(value: string, maxLength: number): string | null {
  const compacted = value.trim().replace(/\s+/g, " ");
  return compacted && compacted.length <= maxLength && !/[\u0000-\u001F\u007F]/.test(compacted)
    ? compacted
    : null;
}

function parseWhen(value: string): EsgEventWhen | null {
  if ((ESG_EVENT_QUICK_WHEN_VALUES as readonly string[]).includes(value)) {
    return value as EsgEventWhen;
  }
  return isValidMonth(value) ? value as EsgEventWhen : null;
}

const LEGACY_MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
] as const;

function parseLegacyMonth(value: string, currentMonth: string): EsgEventWhen | null {
  const normalized = value.trim().toLowerCase();
  if (isValidMonth(normalized)) return normalized as EsgEventWhen;
  const named = /^(january|february|march|april|may|june|july|august|september|october|november|december)(?:[\s-]+(\d{4}))?$/.exec(normalized);
  if (named) {
    const month = LEGACY_MONTH_NAMES.indexOf(named[1] as (typeof LEGACY_MONTH_NAMES)[number]) + 1;
    const year = named[2] ?? currentMonth.slice(0, 4);
    const result = `${year}-${String(month).padStart(2, "0")}`;
    return isValidMonth(result) ? result as EsgEventWhen : null;
  }
  const numeric = /^(0?[1-9]|1[0-2])$/.exec(normalized);
  if (numeric) return `${currentMonth.slice(0, 4)}-${String(Number(numeric[1])).padStart(2, "0")}` as EsgEventWhen;
  return null;
}

function readScalar(
  reader: SearchReader,
  key: string,
  issues: Array<{ key: string; issue: EsgEventQueryIssue }>,
): string | undefined {
  const values = reader.getAll(key);
  if (values.length > 1) {
    issues.push({ key, issue: "duplicate" });
    return undefined;
  }
  return values[0];
}

function isKnownKey(value: string): boolean {
  return (PUBLIC_KEYS as readonly string[]).includes(value) || (LEGACY_KEYS as readonly string[]).includes(value);
}

export function parseEsgEventSearchParams(
  input: EsgEventSearchParams,
  options: { now?: Date } = {},
): ParsedEsgEventSearch {
  const reader = toReader(input);
  const clock = createEsgRequestClock(options.now);
  const issues: Array<{ key: string; issue: EsgEventQueryIssue }> = [];

  for (const key of reader.keys) {
    if (!isKnownKey(key)) issues.push({ key, issue: "unknown" });
  }
  for (const key of LEGACY_KEYS) {
    if (reader.getAll(key).length) issues.push({ key, issue: "legacy" });
  }

  const rawWhen = readScalar(reader, "when", issues);
  let when: EsgEventWhen = "upcoming";
  if (rawWhen !== undefined) {
    const parsed = parseWhen(rawWhen);
    if (parsed) {
      when = parsed;
      if (rawWhen === "upcoming") issues.push({ key: "when", issue: "default-value" });
    } else {
      issues.push({ key: "when", issue: "invalid" });
    }
  } else if (reader.getAll("when").length === 0) {
    const legacyRange = readScalar(reader, "dateRange", issues)?.trim().toLowerCase();
    const legacyMonth = readScalar(reader, "month", issues);
    if (legacyRange) {
      const mapped: Record<string, EsgEventWhen> = {
        upcoming: "upcoming",
        "this-week": "week",
        week: "week",
        "this-month": clock.currentMonth as EsgEventWhen,
        past: "past",
        tbc: "tbc",
        all: "all",
      };
      if (mapped[legacyRange]) when = mapped[legacyRange];
      else issues.push({ key: "dateRange", issue: "invalid" });
    } else if (legacyMonth) {
      const parsed = parseLegacyMonth(legacyMonth, clock.currentMonth);
      if (parsed) when = parsed;
      else issues.push({ key: "month", issue: "invalid" });
    }
  }

  const filters: EsgEventFilters = { when, page: 1 };

  const rawQuery = readScalar(reader, "q", issues);
  if (rawQuery !== undefined) {
    const q = compactText(rawQuery, MAX_QUERY_LENGTH);
    if (q) {
      filters.q = q;
      if (q !== rawQuery) issues.push({ key: "q", issue: "invalid" });
    } else if (rawQuery.length) issues.push({ key: "q", issue: "invalid" });
    else issues.push({ key: "q", issue: "default-value" });
  }

  const rawCountry = readScalar(reader, "country", issues);
  if (rawCountry !== undefined) {
    const country = rawCountry.trim().toUpperCase();
    if (isIso2CountryCode(country)) {
      filters.country = country;
      if (country !== rawCountry) issues.push({ key: "country", issue: "invalid" });
    } else issues.push({ key: "country", issue: "invalid" });
  }

  const rawCity = readScalar(reader, "city", issues);
  if (rawCity !== undefined) {
    const city = compactText(rawCity, MAX_CITY_LENGTH);
    if (!filters.country) issues.push({ key: "city", issue: "dependent-filter" });
    else if (city) {
      filters.city = city;
      if (city !== rawCity) issues.push({ key: "city", issue: "invalid" });
    } else issues.push({ key: "city", issue: "invalid" });
  }

  const rawFormat = readScalar(reader, "format", issues);
  if (rawFormat !== undefined) {
    if ((ESG_EVENT_FORMAT_VALUES as readonly string[]).includes(rawFormat)) {
      filters.format = rawFormat as EsgEventFormat;
    } else issues.push({ key: "format", issue: "invalid" });
  }

  const rawSource = readScalar(reader, "source", issues);
  if (rawSource !== undefined) {
    const source = compactText(rawSource, MAX_SOURCE_LENGTH);
    if (source) {
      filters.source = source;
      if (source !== rawSource) issues.push({ key: "source", issue: "invalid" });
    } else issues.push({ key: "source", issue: rawSource.length ? "invalid" : "default-value" });
  }

  const rawPage = readScalar(reader, "page", issues);
  if (rawPage !== undefined) {
    if (/^[1-9]\d*$/.test(rawPage)) {
      const page = Number(rawPage);
      if (Number.isSafeInteger(page) && page <= MAX_PAGE) {
        filters.page = page;
        if (page === 1) issues.push({ key: "page", issue: "default-value" });
      } else issues.push({ key: "page", issue: "invalid" });
    } else issues.push({ key: "page", issue: "invalid" });
  }

  return {
    filters,
    canonicalSearch: buildEsgEventQuery(filters),
    needsRedirect: issues.length > 0,
    issues,
  };
}

export function parseEsgEventId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= 2_147_483_647 ? parsed : null;
}
