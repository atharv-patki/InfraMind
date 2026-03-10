import type { Hono } from "hono";
import { getOpenApiSpec } from "../openapi/spec";

type WorkerApp = Hono<{ Bindings: Env }>;

export function registerMetaRoutes(app: WorkerApp, apiVersion: string): void {
  app.get("/api/openapi.json", (c) => {
    return c.json(getOpenApiSpec(apiVersion));
  });

  app.all("/api/v1/*", (c) => {
    const url = new URL(c.req.url);
    url.pathname = c.req.path.replace(/^\/api\/v1/, "/api");

    try {
      return app.fetch(new Request(url.toString(), c.req.raw), c.env, c.executionCtx);
    } catch {
      return app.fetch(new Request(url.toString(), c.req.raw), c.env);
    }
  });
}
