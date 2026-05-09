import { describe, expect, it } from "vitest";

import { normalizeAwsUserSecretEnv } from "./aws-env-credentials";

describe("normalizeAwsUserSecretEnv", () => {
  it("trims and strips surrounding double quotes", () => {
    expect(normalizeAwsUserSecretEnv('  "AKIAEXAMPLE"  ')).toBe("AKIAEXAMPLE");
  });

  it("strips single quotes", () => {
    expect(normalizeAwsUserSecretEnv("'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'")).toBe(
      "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    );
  });

  it("removes trailing CRLF after trim", () => {
    expect(normalizeAwsUserSecretEnv("secretvalue\r\n")).toBe("secretvalue");
  });
});
