import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";

describe("next.config security headers", () => {
  it("applies baseline browser hardening on all routes", async () => {
    const headersFn = nextConfig.headers;
    expect(typeof headersFn).toBe("function");

    const rules = await headersFn!();

    expect(rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/:path*",
          headers: expect.arrayContaining([
            { key: "X-Frame-Options", value: "SAMEORIGIN" },
            { key: "X-Content-Type-Options", value: "nosniff" },
            { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
            {
              key: "Permissions-Policy",
              value: "camera=(), microphone=(), geolocation=()",
            },
          ]),
        }),
      ]),
    );
  });
});
