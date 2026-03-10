import { describe, expect, it } from "vitest";
import app from "../index";

describe("api version compatibility", () => {
  it("serves OpenAPI from both /api and /api/v1 without redirect", async () => {
    const env = {} as Env;

    const baseRes = await app.request("http://localhost/api/openapi.json", undefined, env);
    const v1Res = await app.request("http://localhost/api/v1/openapi.json", undefined, env);

    expect(baseRes.status).toBe(200);
    expect(v1Res.status).toBe(200);
    expect(v1Res.headers.get("location")).toBeNull();

    const baseSpec = (await baseRes.json()) as { info: { version: string } };
    const v1Spec = (await v1Res.json()) as { info: { version: string } };
    expect(baseSpec.info.version).toBe("v1");
    expect(v1Spec.info.version).toBe("v1");
  });
});
