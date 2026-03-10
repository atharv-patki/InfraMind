import { describe, expect, it } from "vitest";
import app from "../index";

describe("load and chaos integration", () => {
  it("handles burst load for openapi endpoints within healthy error budget", async () => {
    const env = {} as Env;
    const totalRequests = 120;
    const latencies: number[] = [];

    const tasks = Array.from({ length: totalRequests }, async (_unused, index) => {
      const url =
        index % 2 === 0
          ? "http://localhost/api/openapi.json"
          : "http://localhost/api/v1/openapi.json";
      const started = Date.now();
      const response = await app.request(url, undefined, env);
      latencies.push(Date.now() - started);
      return response.status;
    });

    const statuses = await Promise.all(tasks);
    const successCount = statuses.filter((status) => status === 200).length;
    const successRate = successCount / totalRequests;

    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const p95Latency = sortedLatencies[p95Index] ?? 0;

    expect(successRate).toBeGreaterThanOrEqual(0.99);
    expect(p95Latency).toBeLessThan(200);
  });

  it("survives chaos path mix without internal server errors", async () => {
    const env = {} as Env;
    const urls = [
      "http://localhost/api/openapi.json",
      "http://localhost/api/v1/openapi.json",
      "http://localhost/api/sessions",
      "http://localhost/api/oauth/google/redirect_url",
      "http://localhost/api/unknown/route",
    ];

    const tasks = Array.from({ length: 90 }, async (_unused, index) => {
      const url = urls[index % urls.length];
      const method = url.endsWith("/sessions") ? "POST" : "GET";
      const response = await app.request(url, { method }, env);
      return response.status;
    });

    const statuses = await Promise.all(tasks);
    const has500 = statuses.some((status) => status >= 500);

    expect(has500).toBe(false);
  });
});
