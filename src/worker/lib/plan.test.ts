import { describe, expect, it } from "vitest";
import { PLAN_LIMITS, hasPlanAccess, planRank } from "./plan";

describe("plan rank", () => {
  it("orders plans by capability", () => {
    expect(planRank("starter")).toBeLessThan(planRank("pro"));
    expect(planRank("pro")).toBeLessThan(planRank("enterprise"));
  });
});

describe("plan access", () => {
  it("allows equal and higher plan access", () => {
    expect(hasPlanAccess("pro", "starter")).toBe(true);
    expect(hasPlanAccess("pro", "pro")).toBe(true);
    expect(hasPlanAccess("starter", "pro")).toBe(false);
  });
});

describe("plan limits", () => {
  it("defines non-zero server limits for each plan", () => {
    expect(PLAN_LIMITS.starter.servers).toBeGreaterThan(0);
    expect(PLAN_LIMITS.pro.servers).toBeGreaterThan(PLAN_LIMITS.starter.servers);
    expect(PLAN_LIMITS.enterprise.servers).toBeGreaterThan(PLAN_LIMITS.pro.servers);
  });
});
