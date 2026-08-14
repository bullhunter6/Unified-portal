export type AttendanceMode = "in_person" | "online" | "hybrid";

export interface EventNormalizationInput {
  id: number;
  eventId: string | null;
  eventName: string | null;
  venueName: string | null;
  venueAddress: string | null;
  tags: string | null;
  source: string | null;
  timezone: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface DateCorrectionOverride {
  /** A reviewed inclusive end date, or null when the event is start-date-only. */
  endDate: string | null;
  /** Absolute source page used to confirm the correction. */
  evidenceUrl: string;
}

export interface EventOverride {
  countryCode?: string | null;
  city?: string | null;
  attendanceMode?: AttendanceMode | null;
  timezoneIana?: string | null;
  evidenceUrl: string;
  note?: string;
  dateCorrection?: DateCorrectionOverride;
}

export interface NormalizationResult {
  countryCode: string | null;
  city: string | null;
  attendanceMode: AttendanceMode | null;
  timezoneIana: string | null;
  matchedBy: string[];
  requiresReview: string[];
}

export interface DateRangeAudit {
  kind: "ok" | "undated" | "reversed" | "long";
  durationDays: number | null;
}

interface CityRule {
  city: string;
  countryCode: string;
  timezoneIana: string;
  patterns: RegExp[];
}

const CITY_RULES: CityRule[] = [
  {
    city: "Abu Dhabi",
    countryCode: "AE",
    timezoneIana: "Asia/Dubai",
    patterns: [/\babu[\s-]*dhabi\b/iu, /أبو\s*ظبي/u, /ابو\s*ظبي/u],
  },
  {
    city: "Dubai",
    countryCode: "AE",
    timezoneIana: "Asia/Dubai",
    patterns: [/\bdubai\b/iu, /دبي/u],
  },
  {
    city: "London",
    countryCode: "GB",
    timezoneIana: "Europe/London",
    patterns: [/\blondon\b/iu],
  },
  {
    city: "Manila",
    countryCode: "PH",
    timezoneIana: "Asia/Manila",
    patterns: [/\bmetro\s+manila\b/iu, /\bmanila\b/iu],
  },
  {
    city: "Geneva",
    countryCode: "CH",
    timezoneIana: "Europe/Zurich",
    patterns: [/\bgeneva\b/iu, /\bgenève\b/iu],
  },
  {
    city: "Riyadh",
    countryCode: "SA",
    timezoneIana: "Asia/Riyadh",
    patterns: [/\briyadh\b/iu, /الرياض/u],
  },
  {
    city: "Singapore",
    countryCode: "SG",
    timezoneIana: "Asia/Singapore",
    patterns: [/\bsingapore\b/iu],
  },
  {
    city: "Paris",
    countryCode: "FR",
    timezoneIana: "Europe/Paris",
    patterns: [/\bparis\b/iu],
  },
  {
    city: "Brussels",
    countryCode: "BE",
    timezoneIana: "Europe/Brussels",
    patterns: [/\bbrussels\b/iu, /\bbruxelles\b/iu],
  },
  {
    city: "New York",
    countryCode: "US",
    timezoneIana: "America/New_York",
    patterns: [/\bnew\s+york(?:\s+city)?\b/iu, /\bnyc\b/iu],
  },
];

const COUNTRY_RULES: Array<{ countryCode: string; patterns: RegExp[] }> = [
  {
    countryCode: "AE",
    patterns: [
      /\bunited\s+arab\s+emirates\b/iu,
      /\buae\b/iu,
      /الإمارات\s+العربية\s+المتحدة/u,
    ],
  },
  {
    countryCode: "GB",
    patterns: [/\bunited\s+kingdom\b/iu, /\bu\.?k\.?\b/iu],
  },
  {
    countryCode: "PH",
    patterns: [/\bphilippines\b/iu],
  },
  {
    countryCode: "CH",
    patterns: [/\bswitzerland\b/iu, /\bsuisse\b/iu],
  },
  {
    countryCode: "SA",
    patterns: [/\bsaudi\s+arabia\b/iu, /المملكة\s+العربية\s+السعودية/u],
  },
  {
    countryCode: "SG",
    patterns: [/\bsingapore\b/iu],
  },
  {
    countryCode: "FR",
    patterns: [/\bfrance\b/iu],
  },
  {
    countryCode: "BE",
    patterns: [/\bbelgium\b/iu, /\bbelgique\b/iu],
  },
  {
    countryCode: "US",
    patterns: [/\bunited\s+states(?:\s+of\s+america)?\b/iu, /\bu\.?s\.?a?\.?\b/iu],
  },
];

const HYBRID_PATTERNS = [
  /\bhybrid\b/iu,
  /\bin[\s-]*person\s+(?:and|&)\s+(?:online|virtual)\b/iu,
  /\bon[\s-]*site\s+(?:and|&)\s+(?:online|virtual)\b/iu,
  /\b(?:online|virtual)\s+(?:and|&)\s+in[\s-]*person\b/iu,
];

const ONLINE_PATTERNS = [
  /\bzoom\b/iu,
  /\bwebinar\b/iu,
  /\bvirtual\s+(?:event|conference|summit|meeting|forum)\b/iu,
  /\bonline(?:[\s-]+only)?\s+(?:event|conference|summit|meeting|forum)\b/iu,
  /\blive[\s-]*stream(?:ed|ing)?\b/iu,
  /\bwebex\b/iu,
  /\bteams\s+meeting\b/iu,
];

const AMBIGUOUS_LOCATION = /^(?:(?:apac|emea|global|worldwide|international|multiple\s+locations|tbc|tbd|n\/?a)(?:[\s,/&|+\-]+|$))+$/iu;
const ISO_DATE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/u;
const ISO_COUNTRY = /^[A-Z]{2}$/u;
const ISO_COUNTRY_CODES = new Set(
  (
    "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ " +
    "BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
    "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ " +
    "DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
    "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY " +
    "HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP " +
    "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY " +
    "MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ " +
    "NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY " +
    "QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ " +
    "TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ " +
    "VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
  ).split(" "),
);

function compact(parts: Array<string | null>): string {
  return parts
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" | ")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
}

function matchesAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function own<T extends object>(value: T, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function isAbsoluteHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function canonicalIanaTimeZone(value: string | null | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate || (!candidate.includes("/") && candidate !== "UTC")) return null;
  try {
    return new Intl.DateTimeFormat("en", { timeZone: candidate }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

function validateOverride(override: EventOverride): string[] {
  const errors: string[] = [];
  if (!isAbsoluteHttpUrl(override.evidenceUrl)) errors.push("override-evidence-url-invalid");
  if (
    own(override, "countryCode") &&
    override.countryCode !== null &&
    (
      !ISO_COUNTRY.test(override.countryCode ?? "") ||
      !ISO_COUNTRY_CODES.has(override.countryCode ?? "")
    )
  ) {
    errors.push("override-country-code-invalid");
  }
  if (override.city !== undefined && override.city !== null && override.city.trim().length > 120) {
    errors.push("override-city-too-long");
  }
  if (
    own(override, "timezoneIana") &&
    override.timezoneIana !== null &&
    !canonicalIanaTimeZone(override.timezoneIana)
  ) {
    errors.push("override-timezone-invalid");
  }
  if (override.dateCorrection) {
    if (!isAbsoluteHttpUrl(override.dateCorrection.evidenceUrl)) {
      errors.push("date-override-evidence-url-invalid");
    }
    if (
      override.dateCorrection.endDate !== null &&
      !isValidCalendarDate(override.dateCorrection.endDate)
    ) {
      errors.push("date-override-end-date-invalid");
    }
  }
  return errors;
}

export function overrideKey(event: Pick<EventNormalizationInput, "id" | "eventId" | "source">): string {
  if (event.eventId?.trim()) return `${event.source?.trim() || "unknown"}:${event.eventId.trim()}`;
  return `id:${event.id}`;
}

export function normalizeEvent(
  event: EventNormalizationInput,
  override?: EventOverride,
): NormalizationResult {
  const venueText = compact([event.venueName, event.venueAddress]);
  const modeText = compact([event.venueName, event.venueAddress, event.eventName, event.tags]);
  const locationText = venueText || compact([event.eventName]);
  const matchedBy: string[] = [];
  const requiresReview: string[] = [];

  let countryCode: string | null = null;
  let city: string | null = null;
  let timezoneIana = canonicalIanaTimeZone(event.timezone);
  let attendanceMode: AttendanceMode | null = null;

  // Mode is resolved first so a city named in an online event title is not
  // accidentally treated as the physical venue.
  if (matchesAny(modeText, HYBRID_PATTERNS)) {
    attendanceMode = "hybrid";
    matchedBy.push("explicit-hybrid");
  } else if (matchesAny(modeText, ONLINE_PATTERNS)) {
    attendanceMode = "online";
    matchedBy.push("explicit-online");
  }

  const ambiguousLocation = AMBIGUOUS_LOCATION.test(locationText);
  if (ambiguousLocation) {
    requiresReview.push("ambiguous-location");
  } else if (attendanceMode !== "online") {
    const cityRule = CITY_RULES.find((rule) => matchesAny(locationText, rule.patterns));
    if (cityRule) {
      city = cityRule.city;
      countryCode = cityRule.countryCode;
      timezoneIana ??= cityRule.timezoneIana;
      matchedBy.push(`city:${cityRule.city}`);
    } else {
      const countryRule = COUNTRY_RULES.find((rule) => matchesAny(locationText, rule.patterns));
      if (countryRule) {
        countryCode = countryRule.countryCode;
        matchedBy.push(`country:${countryRule.countryCode}`);
      }
    }
  }

  if (!attendanceMode && (city || countryCode)) {
    attendanceMode = "in_person";
    matchedBy.push("physical-location");
  }

  if (timezoneIana) matchedBy.push("iana-timezone");

  if (override) {
    const overrideErrors = validateOverride(override);
    if (overrideErrors.length) {
      requiresReview.push(...overrideErrors);
    } else {
      if (own(override, "countryCode")) countryCode = override.countryCode ?? null;
      if (own(override, "city")) city = override.city?.trim() || null;
      if (own(override, "attendanceMode")) attendanceMode = override.attendanceMode ?? null;
      if (own(override, "timezoneIana")) {
        timezoneIana = canonicalIanaTimeZone(override.timezoneIana);
      }
      matchedBy.push("reviewed-override");
    }
  }

  return { countryCode, city, attendanceMode, timezoneIana, matchedBy, requiresReview };
}

function isValidCalendarDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function auditDateRange(
  startDate: string | null,
  endDate: string | null,
  longRangeDays = 31,
): DateRangeAudit {
  if (!startDate && !endDate) return { kind: "undated", durationDays: null };
  if (!startDate || !endDate) return { kind: "ok", durationDays: null };
  if (!isValidCalendarDate(startDate) || !isValidCalendarDate(endDate)) {
    return { kind: "reversed", durationDays: null };
  }

  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  const durationDays = Math.round((end - start) / 86_400_000);
  if (durationDays < 0) return { kind: "reversed", durationDays };
  if (durationDays > longRangeDays) return { kind: "long", durationDays };
  return { kind: "ok", durationDays };
}
