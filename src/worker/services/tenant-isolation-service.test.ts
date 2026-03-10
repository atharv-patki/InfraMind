import { describe, expect, it } from "vitest";
import { evaluateTenantIsolation } from "./tenant-isolation-service";

describe("tenant isolation service", () => {
  it("returns adversarial violations for duplicates, orphan sessions, and fanout", () => {
    const violations = evaluateTenantIsolation({
      duplicateMemberships: [{ workspace_id: "ws-1", user_id: "u-1", count: 2 }],
      orphanSessionCount: 3,
      highFanoutUsers: [{ user_id: "u-bot", workspace_count: 40 }],
      highFanoutThreshold: 25,
    });

    expect(violations).toEqual([
      {
        type: "duplicate_membership",
        workspaceId: "ws-1",
        userId: "u-1",
        count: 2,
      },
      {
        type: "orphan_sessions",
        count: 3,
      },
      {
        type: "high_fanout_user",
        userId: "u-bot",
        workspaceCount: 40,
        threshold: 25,
      },
    ]);
  });

  it("returns empty array when no issues are detected", () => {
    const violations = evaluateTenantIsolation({
      duplicateMemberships: [],
      orphanSessionCount: 0,
      highFanoutUsers: [],
      highFanoutThreshold: 25,
    });

    expect(violations).toEqual([]);
  });
});
