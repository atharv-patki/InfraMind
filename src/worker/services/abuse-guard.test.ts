import { describe, expect, it } from "vitest";
import { getEmailDomain } from "./abuse-guard";

describe("abuse-guard", () => {
  it("normalizes and extracts email domain", () => {
    expect(getEmailDomain("  USER@Example.COM ")).toBe("example.com");
  });

  it("returns empty domain for invalid values", () => {
    expect(getEmailDomain("invalid-email")).toBe("");
    expect(getEmailDomain("test@")).toBe("");
  });
});
