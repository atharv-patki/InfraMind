import { describe, expect, it } from "vitest";
import { buildQuotaAlerts, getCurrentUsagePeriod } from "./usage-service";

describe("usage-service", () => {
  it("builds warning and critical quota alerts", () => {
    const alerts = buildQuotaAlerts({
      limits: {
        servers: 10,
        automation_rules: 10,
        api_keys: 10,
        workspace_invites_monthly: 10,
        alerts_created_monthly: 10,
        notification_tests_monthly: 10,
        incident_exports_monthly: 10,
      },
      usage: {
        servers: 8,
        automation_rules: 10,
        api_keys: 1,
        workspace_invites_monthly: 0,
        alerts_created_monthly: 0,
        notification_tests_monthly: 0,
        incident_exports_monthly: 0,
      },
    });

    expect(alerts.length).toBe(2);
    expect(alerts[0]).toMatchObject({
      metric: "automation_rules",
      level: "critical",
      thresholdPercent: 95,
    });
    expect(alerts[1]).toMatchObject({
      metric: "servers",
      level: "warning",
      thresholdPercent: 80,
    });
  });

  it("returns UTC usage period in YYYY-MM format", () => {
    const period = getCurrentUsagePeriod(new Date("2026-03-10T18:10:00.000Z"));
    expect(period).toBe("2026-03");
  });
});
