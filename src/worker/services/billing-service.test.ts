import { describe, expect, it } from "vitest";
import { processStripeWebhook } from "./billing-service";

describe("billing service", () => {
  it("parses and maps stripe subscription webhook payload in insecure local mode", async () => {
    const payload = JSON.stringify({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
          customer: "cus_123",
          status: "active",
          current_period_end: 1_900_000_000,
          metadata: {
            userId: "user_1",
            plan: "pro",
          },
        },
      },
    });

    const result = await processStripeWebhook({
      payloadText: payload,
      signatureHeader: null,
      webhookSecret: undefined,
      allowInsecureBypass: true,
      normalizePlan: (value) => (value === "enterprise" ? "enterprise" : value === "starter" ? "starter" : "pro"),
    });

    expect(result.ok).toBe(true);
    expect(result.userId).toBe("user_1");
    expect(result.plan).toBe("pro");
    expect(result.statusValue).toBe("active");
    expect(result.providerSubscriptionId).toBe("sub_123");
  });

  it("rejects malformed webhook payload", async () => {
    const result = await processStripeWebhook({
      payloadText: "{bad-json",
      signatureHeader: null,
      webhookSecret: undefined,
      allowInsecureBypass: true,
      normalizePlan: () => "starter",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });
});
