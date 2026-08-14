export type EsgEventSchemaCapabilities = {
  countryCode: boolean;
  city: boolean;
  attendanceMode: boolean;
  timezoneIana: boolean;
  eventData: boolean;
};

export type EsgEventClassificationSql = {
  join: string;
  countryCode: string;
  city: string;
  attendanceMode: string;
};

export type EsgEventClassificationInput = {
  normalizedCountryCode?: string | null;
  normalizedCity?: string | null;
  normalizedAttendanceMode?: string | null;
  eventName?: string | null;
  eventUrl?: string | null;
  tags?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  jsonVenueName?: string | null;
  jsonVenueAddress?: string | null;
  jsonAttendanceMode?: string | null;
  structuredCountry?: string | null;
  structuredCity?: string | null;
  structuredLocationType?: string | null;
  structuredAttendanceMode?: string | null;
  onlineEventUrl?: string | null;
};

export type EsgEventClassification = {
  countryCode: string | null;
  city: string | null;
  attendanceMode: "in_person" | "online" | "hybrid" | null;
};

type CityRule = {
  city: string;
  countryCode: string;
  terms: readonly string[];
};

type CountryRule = {
  countryCode: string;
  terms: readonly string[];
};

// These are deliberately conservative location terms observed in the legacy
// event feed. Regional labels such as Global, APAC, EMEA, Americas, and North
// America are intentionally absent.
const CITY_RULES: readonly CityRule[] = [
  { city: "Abu Dhabi", countryCode: "AE", terms: ["abu dhabi", "أبو ظبي", "ابو ظبي"] },
  { city: "Dubai", countryCode: "AE", terms: ["dubai", "دبي"] },
  { city: "London", countryCode: "GB", terms: ["london"] },
  { city: "Manila", countryCode: "PH", terms: ["metro manila", "manila"] },
  { city: "Geneva", countryCode: "CH", terms: ["geneva", "genève"] },
  { city: "Zurich", countryCode: "CH", terms: ["zurich", "zürich"] },
  { city: "Basel", countryCode: "CH", terms: ["basel"] },
  { city: "Riyadh", countryCode: "SA", terms: ["riyadh", "الرياض"] },
  { city: "Singapore", countryCode: "SG", terms: ["singapore"] },
  { city: "Paris", countryCode: "FR", terms: ["paris"] },
  { city: "Brussels", countryCode: "BE", terms: ["brussels", "bruxelles"] },
  { city: "New York", countryCode: "US", terms: ["new york city", "new york, ny", "new york, usa"] },
  { city: "Houston", countryCode: "US", terms: ["houston"] },
  { city: "Ulaanbaatar", countryCode: "MN", terms: ["ulaanbaatar"] },
  { city: "Hong Kong", countryCode: "HK", terms: ["hong kong"] },
  { city: "Macao", countryCode: "MO", terms: ["macao", "macau"] },
  { city: "Bochum", countryCode: "DE", terms: ["bochum"] },
  { city: "Berlin", countryCode: "DE", terms: ["berlin"] },
  { city: "Frankfurt", countryCode: "DE", terms: ["frankfurt"] },
  { city: "Busan", countryCode: "KR", terms: ["busan"] },
  { city: "Cape Town", countryCode: "ZA", terms: ["cape town"] },
  { city: "Madrid", countryCode: "ES", terms: ["madrid"] },
  { city: "Tokyo", countryCode: "JP", terms: ["tokyo"] },
  { city: "Antalya", countryCode: "TR", terms: ["antalya"] },
  { city: "Athens", countryCode: "GR", terms: ["athens"] },
  { city: "Abuja", countryCode: "NG", terms: ["abuja"] },
  { city: "Prague", countryCode: "CZ", terms: ["prague"] },
  { city: "Cork", countryCode: "IE", terms: ["cork"] },
  { city: "Beijing", countryCode: "CN", terms: ["beijing"] },
  { city: "Thimphu", countryCode: "BT", terms: ["thimphu"] },
  { city: "New Delhi", countryCode: "IN", terms: ["new delhi"] },
  { city: "Yerevan", countryCode: "AM", terms: ["yerevan"] },
  { city: "Amsterdam", countryCode: "NL", terms: ["amsterdam"] },
  { city: "Monte Carlo", countryCode: "MC", terms: ["monte carlo"] },
  { city: "Sydney", countryCode: "AU", terms: ["sydney"] },
  { city: "Bangkok", countryCode: "TH", terms: ["bangkok"] },
  { city: "Lisbon", countryCode: "PT", terms: ["lisbon"] },
  { city: "Baku", countryCode: "AZ", terms: ["baku"] },
  { city: "Dhaka", countryCode: "BD", terms: ["dhaka"] },
  { city: "Suva", countryCode: "FJ", terms: ["suva"] },
  { city: "Rome", countryCode: "IT", terms: ["rome"] },
  { city: "Milan", countryCode: "IT", terms: ["milan"] },
  { city: "Muscat", countryCode: "OM", terms: ["muscat"] },
  { city: "Tashkent", countryCode: "UZ", terms: ["tashkent"] },
  { city: "Manama", countryCode: "BH", terms: ["manama"] },
  { city: "Helsinki", countryCode: "FI", terms: ["helsinki"] },
  { city: "Jakarta", countryCode: "ID", terms: ["jakarta"] },
  { city: "Bishkek", countryCode: "KG", terms: ["bishkek"] },
  { city: "Kuwait City", countryCode: "KW", terms: ["kuwait city"] },
  { city: "Mexico City", countryCode: "MX", terms: ["mexico city"] },
  { city: "Kuala Lumpur", countryCode: "MY", terms: ["kuala lumpur"] },
  { city: "Panama City", countryCode: "PA", terms: ["panama city"] },
  { city: "Ashgabat", countryCode: "TM", terms: ["ashgabat"] },
  { city: "São Paulo", countryCode: "BR", terms: ["são paulo", "sao paulo"] },
  { city: "Rio de Janeiro", countryCode: "BR", terms: ["rio de janeiro"] },
] as const;

const COUNTRY_RULES: readonly CountryRule[] = [
  { countryCode: "AE", terms: ["united arab emirates", " uae"] },
  { countryCode: "GB", terms: ["united kingdom", "england"] },
  { countryCode: "PH", terms: ["philippines"] },
  { countryCode: "CH", terms: ["switzerland", "suisse"] },
  { countryCode: "SA", terms: ["saudi arabia"] },
  { countryCode: "US", terms: ["united states of america", "united states", " usa"] },
  { countryCode: "MN", terms: ["mongolia"] },
  { countryCode: "BE", terms: ["belgium", "belgique"] },
  { countryCode: "DE", terms: ["germany", "deutschland"] },
  { countryCode: "KR", terms: ["republic of korea", "south korea"] },
  { countryCode: "ZA", terms: ["south africa"] },
  { countryCode: "ES", terms: ["spain"] },
  { countryCode: "JP", terms: ["japan"] },
  { countryCode: "IN", terms: ["india"] },
  { countryCode: "TR", terms: ["türkiye", "turkiye", "turkey"] },
  { countryCode: "CA", terms: ["canada"] },
  { countryCode: "GR", terms: ["greece"] },
  { countryCode: "NG", terms: ["nigeria"] },
  { countryCode: "CZ", terms: ["czechia", "czech republic"] },
  { countryCode: "IE", terms: ["ireland"] },
  { countryCode: "BT", terms: ["bhutan"] },
  { countryCode: "AM", terms: ["armenia"] },
  { countryCode: "NL", terms: ["netherlands"] },
  { countryCode: "MC", terms: ["monaco"] },
  { countryCode: "FR", terms: ["france"] },
  { countryCode: "AU", terms: ["australia"] },
  { countryCode: "CN", terms: ["china"] },
  { countryCode: "HK", terms: ["hong kong"] },
  { countryCode: "MO", terms: ["macao", "macau"] },
  { countryCode: "BR", terms: ["brazil", "brasil"] },
  { countryCode: "TH", terms: ["thailand"] },
  { countryCode: "PT", terms: ["portugal"] },
  { countryCode: "AZ", terms: ["azerbaijan"] },
  { countryCode: "BD", terms: ["bangladesh"] },
  { countryCode: "FJ", terms: ["fiji"] },
  { countryCode: "IT", terms: ["italy"] },
  { countryCode: "OM", terms: ["oman"] },
  { countryCode: "UZ", terms: ["uzbekistan"] },
  { countryCode: "BH", terms: ["bahrain"] },
  { countryCode: "FI", terms: ["finland"] },
  { countryCode: "ID", terms: ["indonesia"] },
  { countryCode: "KG", terms: ["kyrgyzstan"] },
  { countryCode: "KW", terms: ["kuwait"] },
  { countryCode: "MX", terms: ["mexico"] },
  { countryCode: "MY", terms: ["malaysia"] },
  { countryCode: "PA", terms: ["panama"] },
  { countryCode: "TM", terms: ["turkmenistan"] },
] as const;

const STRUCTURED_COUNTRY_ALIASES: Readonly<Record<string, string>> = {
  ae: "AE",
  australia: "AU",
  be: "BE",
  belgium: "BE",
  cn: "CN",
  czechia: "CZ",
  england: "GB",
  france: "FR",
  gb: "GB",
  germany: "DE",
  in: "IN",
  ireland: "IE",
  monaco: "MC",
  netherlands: "NL",
  nigeria: "NG",
  sg: "SG",
  singapore: "SG",
  "united arab emirates": "AE",
  "united kingdom": "GB",
  "united states": "US",
  "united states of america": "US",
  us: "US",
};

function assertAlias(alias: string): void {
  if (!/^[a-z][a-z0-9_]*$/.test(alias)) throw new Error("Invalid SQL table alias");
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function containsAny(textSql: string, terms: readonly string[]): string {
  const patterns = terms.map((term) => sqlLiteral(`%${term}%`)).join(", ");
  return `${textSql} ILIKE ANY (ARRAY[${patterns}]::text[])`;
}

function clean(value: string | null | undefined): string | null {
  const result = value?.trim().replace(/\s+/g, " ");
  return result || null;
}

function textContainsAny(value: string, terms: readonly string[]): boolean {
  const comparable = value.toLocaleLowerCase("en");
  return terms.some((term) => comparable.includes(term.toLocaleLowerCase("en")));
}

export function classifyEsgEventFields(
  input: EsgEventClassificationInput,
): EsgEventClassification {
  const venueText = [
    input.venueName,
    input.venueAddress,
    input.jsonVenueName,
    input.jsonVenueAddress,
  ].map(clean).filter(Boolean).join(" ");
  const locationText = venueText || clean(input.eventName) || "";
  const locationMatchText = [input.structuredCity, locationText].map(clean).filter(Boolean).join(" ");
  const modeText = [venueText, input.eventName, input.tags, input.eventUrl]
    .map(clean)
    .filter(Boolean)
    .join(" ");

  const topMode = clean(input.jsonAttendanceMode)?.toLocaleLowerCase("en");
  let inferredMode: EsgEventClassification["attendanceMode"] = topMode === "online"
    ? "online"
    : topMode === "offline"
      ? "in_person"
      : topMode === "mixed"
        ? "hybrid"
        : null;
  const structuredMode = clean(input.structuredAttendanceMode)?.toLocaleLowerCase("en") ?? "";
  if (!inferredMode && structuredMode.includes("mixedeventattendancemode")) inferredMode = "hybrid";
  if (!inferredMode && structuredMode.includes("onlineeventattendancemode")) inferredMode = "online";
  if (!inferredMode && structuredMode.includes("offlineeventattendancemode")) inferredMode = "in_person";
  if (
    !inferredMode &&
    (
      /(^|[^A-Za-z0-9])hybrid([^A-Za-z0-9]|$)/i.test(modeText) ||
      /(?:\sand\s|\s&\s)(?:online|virtual)/i.test(locationText)
    )
  ) {
    inferredMode = "hybrid";
  }
  if (
    !inferredMode &&
    (
      clean(input.structuredLocationType)?.toLocaleLowerCase("en") === "virtuallocation" ||
      Boolean(clean(input.onlineEventUrl)) ||
      /(^|[^A-Za-z0-9])(online|webinars?|zoom|virtual|webcasts?|webex)([^A-Za-z0-9]|$)|live[ -]?stream|teams[ -]+meeting/i.test(modeText)
    )
  ) {
    inferredMode = "online";
  }

  const normalizedAttendance = input.normalizedAttendanceMode === "in_person" ||
    input.normalizedAttendanceMode === "online" ||
    input.normalizedAttendanceMode === "hybrid"
    ? input.normalizedAttendanceMode
    : null;
  const explicitMode = normalizedAttendance ?? inferredMode;
  const cityRule = CITY_RULES.find((rule) => textContainsAny(locationMatchText, rule.terms));
  const structuredCountry = clean(input.structuredCountry)?.toLocaleLowerCase("en") ?? "";
  const specialTerritory = textContainsAny(locationMatchText, ["macao", "macau"])
    ? "MO"
    : textContainsAny(locationMatchText, ["hong kong"])
      ? "HK"
      : null;
  const namedCountry = COUNTRY_RULES.find((rule) => textContainsAny(locationText, rule.terms));
  const countryCandidate = specialTerritory ??
    STRUCTURED_COUNTRY_ALIASES[structuredCountry] ??
    cityRule?.countryCode ??
    namedCountry?.countryCode ??
    null;
  const normalizedCountry = clean(input.normalizedCountryCode)?.toUpperCase() ?? null;
  const countryCode = normalizedCountry ?? (explicitMode === "online" ? null : countryCandidate);
  const normalizedCity = clean(input.normalizedCity);
  const structuredCity = clean(input.structuredCity);
  const city = normalizedCity ?? (
    explicitMode === "online"
      ? null
      : cityRule?.city ?? (countryCandidate && structuredCity && structuredCity.length <= 120
        ? structuredCity
        : null)
  );
  const attendanceMode = explicitMode ?? (countryCode ? "in_person" : null);

  return { countryCode, city, attendanceMode };
}

function ruleCase(
  textSql: string,
  rules: ReadonlyArray<{ terms: readonly string[] }>,
  value: (rule: { terms: readonly string[] }) => string,
): string {
  return rules
    .map((rule) => `WHEN ${containsAny(textSql, rule.terms)} THEN ${sqlLiteral(value(rule))}`)
    .join("\n");
}

export function buildEsgEventClassificationSql(
  schema: EsgEventSchemaCapabilities,
  alias = "e",
): EsgEventClassificationSql {
  assertAlias(alias);
  const column = (name: string) => `${alias}.${name}`;
  const eventData = (path: string) => schema.eventData
    ? `${column("event_data")} ${path}`
    : "NULL::text";
  const jsonVenueName = eventData("->> 'Venue Name'");
  const jsonVenueAddress = eventData("->> 'Venue Address'");
  const rawVenueText = `concat_ws(' ', ${column("venue_name")}, ${column("venue_address")}, ${jsonVenueName}, ${jsonVenueAddress})`;
  const locationText = `CASE
    WHEN NULLIF(btrim(${rawVenueText}), '') IS NOT NULL THEN ${rawVenueText}
    ELSE COALESCE(${column("event_name")}, '')
  END`;
  const structuredCountry = eventData("#>> '{Structured Data,location,address,addressCountry}'");
  const structuredCity = eventData("#>> '{Structured Data,location,address,addressLocality}'");
  const structuredLocationType = eventData("#>> '{Structured Data,location,@type}'");
  const structuredMode = eventData("#>> '{Structured Data,eventAttendanceMode}'");
  const jsonAttendanceMode = eventData("->> 'Attendance Mode'");
  const onlineEventUrl = eventData("->> 'Online Event URL'");
  const normalizedMode = schema.attendanceMode
    ? `NULLIF(btrim(${column("attendance_mode")}), '')`
    : "NULL::text";
  const normalizedCountry = schema.countryCode
    ? `NULLIF(upper(btrim(${column("country_code")})), '')`
    : "NULL::text";
  const normalizedCity = schema.city
    ? `NULLIF(btrim(${column("city")}), '')`
    : "NULL::text";

  const rawJoin = `CROSS JOIN LATERAL (
    SELECT
      ${structuredCountry} AS structured_country,
      ${structuredCity} AS structured_city,
      ${structuredLocationType} AS structured_location_type,
      ${structuredMode} AS structured_mode,
      ${jsonAttendanceMode} AS json_attendance_mode,
      ${onlineEventUrl} AS online_event_url,
      ${rawVenueText} AS venue_text
  ) esg_raw`;
  const textJoin = `CROSS JOIN LATERAL (
    SELECT
      ${locationText.replaceAll(rawVenueText, "esg_raw.venue_text")} AS location_text,
      concat_ws(' ', esg_raw.venue_text, ${column("event_name")}, ${column("tags")}, ${column("event_url")}) AS mode_text
  ) esg_text`;
  const locationMatchText = "concat_ws(' ', esg_raw.structured_city, esg_text.location_text)";
  const modeText = "esg_text.mode_text";

  const structuredCountryCase = `CASE lower(btrim(esg_raw.structured_country))
    ${Object.entries(STRUCTURED_COUNTRY_ALIASES)
      .map(([name, code]) => `WHEN ${sqlLiteral(name)} THEN ${sqlLiteral(code)}`)
      .join("\n")}
    ELSE NULL::text
  END`;
  const cityCountryCase = `CASE
    ${ruleCase(locationMatchText, CITY_RULES, (rule) => (rule as CityRule).countryCode)}
    ELSE NULL::text
  END`;
  const namedCountryCase = `CASE
    ${ruleCase(locationText, COUNTRY_RULES, (rule) => (rule as CountryRule).countryCode)}
    ELSE NULL::text
  END`;
  // Macao/Hong Kong location evidence is more specific than a parent-country
  // code occasionally emitted by third-party structured data.
  const legacyCountryCandidate = `COALESCE(
    CASE
      WHEN ${containsAny(locationMatchText, ["macao", "macau"])} THEN 'MO'
      WHEN ${containsAny(locationMatchText, ["hong kong"])} THEN 'HK'
      ELSE NULL::text
    END,
    ${structuredCountryCase},
    ${cityCountryCase},
    ${namedCountryCase}
  )`;

  const topLevelMode = `CASE lower(btrim(esg_raw.json_attendance_mode))
    WHEN 'online' THEN 'online'
    WHEN 'offline' THEN 'in_person'
    WHEN 'mixed' THEN 'hybrid'
    ELSE NULL::text
  END`;
  const schemaMode = `CASE
    WHEN lower(esg_raw.structured_mode) LIKE '%mixedeventattendancemode' THEN 'hybrid'
    WHEN lower(esg_raw.structured_mode) LIKE '%onlineeventattendancemode' THEN 'online'
    WHEN lower(esg_raw.structured_mode) LIKE '%offlineeventattendancemode' THEN 'in_person'
    ELSE NULL::text
  END`;
  const inferredMode = `CASE
    WHEN ${modeText} ~* '(^|[^[:alnum:]])hybrid([^[:alnum:]]|$)'
      OR ${locationText} ILIKE ANY (ARRAY['% and online%', '% & online%', '% and virtual%', '% & virtual%']::text[])
    THEN 'hybrid'
    WHEN lower(esg_raw.structured_location_type) = 'virtuallocation'
      OR NULLIF(btrim(esg_raw.online_event_url), '') IS NOT NULL
      OR ${modeText} ~* '(^|[^[:alnum:]])(online|webinars?|zoom|virtual|webcasts?|webex)([^[:alnum:]]|$)|live[ -]?stream|teams[ -]+meeting'
    THEN 'online'
    ELSE NULL::text
  END`;
  const explicitMode = `COALESCE(${topLevelMode}, ${schemaMode}, ${inferredMode})`;

  const cityRuleCase = `CASE
    ${ruleCase(locationMatchText, CITY_RULES, (rule) => (rule as CityRule).city)}
    ELSE NULL::text
  END`;
  const legacyJoin = `CROSS JOIN LATERAL (
    SELECT
      ${legacyCountryCandidate} AS country_candidate,
      ${cityRuleCase} AS mapped_city,
      ${explicitMode} AS explicit_mode
  ) esg_legacy`;
  const effectiveExplicitMode = `COALESCE(${normalizedMode}, esg_legacy.explicit_mode)`;
  const legacyCountry = `CASE
    WHEN (${effectiveExplicitMode}) = 'online' THEN NULL::text
    ELSE esg_legacy.country_candidate
  END`;
  const countryCode = `COALESCE(${normalizedCountry}, ${legacyCountry})`;
  const structuredCityFallback = `CASE
    WHEN esg_legacy.country_candidate IS NOT NULL
      AND NULLIF(btrim(esg_raw.structured_city), '') IS NOT NULL
      AND length(btrim(esg_raw.structured_city)) <= 120
    THEN btrim(esg_raw.structured_city)
    ELSE NULL::text
  END`;
  const city = `COALESCE(
    ${normalizedCity},
    CASE
      WHEN (${effectiveExplicitMode}) = 'online' THEN NULL::text
      ELSE COALESCE(esg_legacy.mapped_city, ${structuredCityFallback})
    END
  )`;
  const attendanceMode = `COALESCE(
    ${effectiveExplicitMode},
    CASE WHEN (${countryCode}) IS NOT NULL THEN 'in_person' ELSE NULL::text END
  )`;
  const finalJoin = `CROSS JOIN LATERAL (
    SELECT
      ${countryCode} AS country_code,
      ${city} AS city,
      ${attendanceMode} AS attendance_mode
  ) esg_class`;

  return {
    join: `${rawJoin}\n${textJoin}\n${legacyJoin}\n${finalJoin}`,
    countryCode: "esg_class.country_code",
    city: "esg_class.city",
    attendanceMode: "esg_class.attendance_mode",
  };
}
