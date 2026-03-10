import { describe, expect, it } from "vitest";
import { getOpenApiSpec } from "./spec";

describe("openapi spec", () => {
  it("includes responses for every operation", () => {
    const spec = getOpenApiSpec("v1");
    const methods = ["get", "post", "put", "delete", "patch"];

    for (const pathItem of Object.values(spec.paths)) {
      for (const method of methods) {
        const operation = (pathItem as Record<string, { responses?: unknown }>)[method];
        if (!operation) continue;
        expect(operation.responses).toBeTruthy();
      }
    }
  });

  it("publishes both v1 and compatibility server urls", () => {
    const spec = getOpenApiSpec("v1");
    expect(spec.servers.map((server) => server.url)).toEqual(["/api/v1", "/api"]);
  });
});
