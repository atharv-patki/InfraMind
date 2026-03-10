import { describe, expect, it } from "vitest";
import { getPlanLabel, hasPlanAccess, normalizePlan } from "@/react-app/lib/plans";

describe("plans helpers", () => {
  it("normalizes unsupported plans to pro", () => {
    expect(normalizePlan("starter")).toBe("starter");
    expect(normalizePlan("enterprise")).toBe("enterprise");
    expect(normalizePlan("unknown")).toBe("pro");
    expect(normalizePlan(null)).toBe("pro");
  });

  it("respects plan access order", () => {
    expect(hasPlanAccess("enterprise", "starter")).toBe(true);
    expect(hasPlanAccess("pro", "pro")).toBe(true);
    expect(hasPlanAccess("starter", "pro")).toBe(false);
  });

  it("returns readable plan labels", () => {
    expect(getPlanLabel("starter")).toBe("Starter");
    expect(getPlanLabel("pro")).toBe("Pro");
    expect(getPlanLabel("enterprise")).toBe("Enterprise");
  });
});
