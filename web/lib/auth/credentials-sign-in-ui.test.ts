import { describe, expect, it } from "vitest";

import { isPortalAccessEndedSignInResult } from "./credentials-sign-in-ui";

describe("isPortalAccessEndedSignInResult", () => {
  it("is true when code is portal_access_ended", () => {
    expect(isPortalAccessEndedSignInResult({ error: "CredentialsSignin", code: "portal_access_ended" })).toBe(true);
  });

  it("is true when url query contains portal_access_ended", () => {
    expect(
      isPortalAccessEndedSignInResult({
        error: "CredentialsSignin",
        url: "http://localhost:3000/login?error=portal_access_ended",
      }),
    ).toBe(true);
  });

  it("is false when only generic credentials error", () => {
    expect(isPortalAccessEndedSignInResult({ error: "CredentialsSignin", code: undefined })).toBe(false);
    expect(isPortalAccessEndedSignInResult({ error: "CredentialsSignin", url: "/portal" })).toBe(false);
  });

  it("is false when result absent or empty", () => {
    expect(isPortalAccessEndedSignInResult(undefined)).toBe(false);
    expect(isPortalAccessEndedSignInResult(null)).toBe(false);
    expect(isPortalAccessEndedSignInResult({})).toBe(false);
  });
});
