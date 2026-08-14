import assert from "node:assert/strict";

import {
  auditDateRange,
  normalizeEvent,
  type AttendanceMode,
  type EventNormalizationInput,
} from "./location-normalizer.mts";

interface Expected {
  countryCode: string | null;
  city: string | null;
  attendanceMode: AttendanceMode | null;
  timezoneIana: string | null;
}

function fixture(
  name: string,
  input: Partial<EventNormalizationInput>,
  expected: Expected,
): void {
  const event: EventNormalizationInput = {
    id: 1,
    eventId: name,
    eventName: "ESG event",
    venueName: null,
    venueAddress: null,
    tags: null,
    source: "fixture",
    timezone: null,
    startDate: "2026-08-04",
    endDate: "2026-08-05",
    ...input,
  };
  const actual = normalizeEvent(event);
  assert.deepEqual(
    {
      countryCode: actual.countryCode,
      city: actual.city,
      attendanceMode: actual.attendanceMode,
      timezoneIana: actual.timezoneIana,
    },
    expected,
    name,
  );
}

fixture(
  "dubai-ae",
  { venueName: "Dubai World Trade Centre", venueAddress: "Dubai, UAE" },
  { countryCode: "AE", city: "Dubai", attendanceMode: "in_person", timezoneIana: "Asia/Dubai" },
);
fixture(
  "london-gb",
  { venueName: "QEII Centre", venueAddress: "London, United Kingdom" },
  { countryCode: "GB", city: "London", attendanceMode: "in_person", timezoneIana: "Europe/London" },
);
fixture(
  "manila-ph",
  { venueAddress: "Makati, Metro Manila, Philippines" },
  { countryCode: "PH", city: "Manila", attendanceMode: "in_person", timezoneIana: "Asia/Manila" },
);
fixture(
  "geneva-hybrid",
  { eventName: "Hybrid sustainability forum", venueAddress: "Geneva, Switzerland" },
  { countryCode: "CH", city: "Geneva", attendanceMode: "hybrid", timezoneIana: "Europe/Zurich" },
);
fixture(
  "zoom-online",
  { eventName: "Climate disclosure webinar", venueName: "Zoom" },
  { countryCode: null, city: null, attendanceMode: "online", timezoneIana: null },
);
fixture(
  "arabic-abu-dhabi",
  { venueAddress: "أبو ظبي، الإمارات العربية المتحدة" },
  { countryCode: "AE", city: "Abu Dhabi", attendanceMode: "in_person", timezoneIana: "Asia/Dubai" },
);
fixture(
  "ambiguous-apac-global",
  { venueAddress: "APAC / Global" },
  { countryCode: null, city: null, attendanceMode: null, timezoneIana: null },
);

assert.deepEqual(auditDateRange("2026-08-04", "2026-08-03"), {
  kind: "reversed",
  durationDays: -1,
});
assert.deepEqual(auditDateRange("2026-01-01", "2026-03-01"), {
  kind: "long",
  durationDays: 59,
});
assert.deepEqual(auditDateRange("2026-08-04", null), {
  kind: "ok",
  durationDays: null,
});

console.log("ESG event normalization fixtures: 10 passed");
