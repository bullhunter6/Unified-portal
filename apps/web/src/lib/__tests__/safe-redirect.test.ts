import { describe, expect, it } from "vitest";
import { safeRelativePath, safeSameOriginResultPath } from "@/lib/safe-redirect";

describe("AUTH-02 safe redirects", () => {
  it("accepts normal application-relative paths", () => {
    expect(safeRelativePath("/esg")).toBe("/esg");
    expect(safeRelativePath("/credit/tenders?page=2#results")).toBe(
      "/credit/tenders?page=2#results",
    );
  });

  it.each([
    "https://evil.example/phish",
    "javascript:alert(1)",
    "/javascript:alert(1)",
    "//evil.example/phish",
    "/\\evil.example/phish",
    "/%2f%2fevil.example",
    "/%5cevil.example",
    "/path\nheader",
  ])("rejects an unsafe callback URL: %s", (value) => {
    expect(safeRelativePath(value)).toBeNull();
  });

  it("uses only same-origin paths from NextAuth callback results", () => {
    expect(
      safeSameOriginResultPath(
        "https://portal.example/esg/tools?tab=drivers",
        "https://portal.example",
      ),
    ).toBe("/esg/tools?tab=drivers");
    expect(
      safeSameOriginResultPath(
        "https://evil.example/phish",
        "https://portal.example",
      ),
    ).toBeNull();
  });
});
