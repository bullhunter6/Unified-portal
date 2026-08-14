import { describe, expect, it, vi } from "vitest";

vi.mock("./digest-admin", () => ({
  ESG_EVENT_DIGEST_DELIVERY_MODES: ["production", "test"],
  ESG_EVENT_DIGEST_DELIVERY_STATUSES: ["queued", "processing", "sent", "failed"],
}));

import {
  buildEsgEventDigestAdminQuery,
  parseEsgEventDigestAdminQuery,
} from "./digest-admin-query";

describe("parseEsgEventDigestAdminQuery", () => {
  it("uses a bounded first page by default", () => {
    expect(parseEsgEventDigestAdminQuery(new URLSearchParams())).toEqual({
      page: 1,
      status: undefined,
      mode: undefined,
      recipient: undefined,
    });
  });

  it("accepts only the supported filters and trims recipient search", () => {
    expect(parseEsgEventDigestAdminQuery(new URLSearchParams(
      "page=42&status=failed&mode=test&recipient=%20sai%40example.com%20",
    ))).toEqual({
      page: 42,
      status: "failed",
      mode: "test",
      recipient: "sai@example.com",
    });
  });

  it.each([
    "page=0",
    "page=-1",
    "page=01",
    "page=1.5",
    "page=1e2",
    "page=100000",
    "status=cancelled",
    "mode=preview",
    "surprise=true",
    "page=1&page=2",
    "status=sent&status=failed",
    "mode=test&mode=production",
    "recipient=a&recipient=b",
    `recipient=${"a".repeat(121)}`,
    "recipient=hello%0Aworld",
    "recipient=hello%00world",
  ])("rejects malformed or ambiguous scalar state: %s", (query) => {
    expect(parseEsgEventDigestAdminQuery(new URLSearchParams(query))).toBeNull();
  });

  it("builds a canonical query and omits the default page", () => {
    const filters = {
      page: 1,
      status: "sent" as const,
      mode: "production" as const,
      recipient: "ops@example.com",
    };

    expect(buildEsgEventDigestAdminQuery(filters)).toBe(
      "?status=sent&mode=production&recipient=ops%40example.com",
    );
    expect(buildEsgEventDigestAdminQuery(filters, 3)).toBe(
      "?status=sent&mode=production&recipient=ops%40example.com&page=3",
    );
  });
});
