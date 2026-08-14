import { describe, expect, it } from "vitest";

import {
  buildEsgEventClassificationSql,
  classifyEsgEventFields,
} from "./classification-sql";

describe("legacy ESG event classification", () => {
  it("maps physical venue locations into reachable country and city values", () => {
    expect(classifyEsgEventFields({
      venueName: "Millennium Airport Hotel Dubai",
      venueAddress: "Casablanca Street, Dubai, UAE",
    })).toEqual({
      countryCode: "AE",
      city: "Dubai",
      attendanceMode: "in_person",
    });
  });

  it("keeps mixed physical and virtual records as hybrid locations", () => {
    expect(classifyEsgEventFields({
      venueName: "Geneva, Switzerland & Virtual",
      jsonAttendanceMode: "Mixed",
    })).toEqual({
      countryCode: "CH",
      city: "Geneva",
      attendanceMode: "hybrid",
    });
  });

  it("puts explicit webinars online without inventing a country", () => {
    expect(classifyEsgEventFields({
      eventName: "London climate disclosure webinar",
      jsonAttendanceMode: "Online",
      structuredLocationType: "VirtualLocation",
    })).toEqual({
      countryCode: null,
      city: null,
      attendanceMode: "online",
    });
  });

  it.each(["Global", "APAC", "EMEA", "Americas", "North America", "Various cities"])(
    "leaves the ambiguous region %s unmapped",
    (venueName) => {
      expect(classifyEsgEventFields({ venueName })).toEqual({
        countryCode: null,
        city: null,
        attendanceMode: null,
      });
    },
  );

  it("uses structured legacy JSON before conservative venue fallbacks", () => {
    expect(classifyEsgEventFields({
      structuredCountry: "Belgium",
      structuredCity: "Brussels",
      jsonAttendanceMode: "Offline",
    })).toEqual({
      countryCode: "BE",
      city: "Brussels",
      attendanceMode: "in_person",
    });
  });

  it("builds a single reusable SQL classification join for legacy tables", () => {
    const sql = buildEsgEventClassificationSql({
      countryCode: false,
      city: false,
      attendanceMode: false,
      timezoneIana: false,
      eventData: true,
    });
    expect(sql.join).toContain("e.event_data ->> 'Attendance Mode'");
    expect(sql.join).toContain("esg_class");
    expect(sql.countryCode).toBe("esg_class.country_code");
    expect(sql.attendanceMode).toBe("esg_class.attendance_mode");
  });
});
