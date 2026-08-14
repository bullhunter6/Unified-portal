import { describe, expect, it } from "vitest";
import {
  describeEsgEventLocation,
  getCountryLabel,
  normalizeAttendanceMode,
  normalizeVenue,
} from "./normalize";
import { normalizeExternalUrl } from "./urls";

describe("event value normalization", () => {
  it("deduplicates equivalent venue name and address", () => {
    expect(normalizeVenue("Dubai World Trade Centre", "Dubai World Trade Centre"))
      .toEqual({ name: "Dubai World Trade Centre", address: null });
    expect(normalizeVenue("DWTC", "Sheikh Zayed Road, Dubai"))
      .toEqual({ name: "DWTC", address: "Sheikh Zayed Road, Dubai" });
  });

  it("does not infer Online from missing location", () => {
    expect(describeEsgEventLocation({ attendanceMode: null, city: null, countryLabel: null }))
      .toBe("Location TBC");
    expect(describeEsgEventLocation({ attendanceMode: "online", city: null, countryLabel: null }))
      .toBe("Online");
    expect(describeEsgEventLocation({ attendanceMode: "hybrid", city: "Geneva", countryLabel: "Switzerland" }))
      .toBe("Geneva, Switzerland · Hybrid");
  });

  it("accepts only constrained attendance values and country codes", () => {
    expect(normalizeAttendanceMode("in_person")).toBe("in_person");
    expect(normalizeAttendanceMode("virtual")).toBeNull();
    expect(getCountryLabel("AE")).toBe("United Arab Emirates");
    expect(getCountryLabel("UAE")).toBeNull();
  });
});
describe("external URL validation", () => {
  it.each([
    "/events/123",
    "javascript:alert(1)",
    "ftp://example.com/file",
    "https://user:password@example.com/private",
  ])("rejects unsafe or non-absolute URL %s", (url) => {
    expect(normalizeExternalUrl(url)).toBeNull();
  });

  it("accepts absolute HTTP(S) event links", () => {
    expect(normalizeExternalUrl("https://example.com/events/1"))
      .toBe("https://example.com/events/1");
  });
});
