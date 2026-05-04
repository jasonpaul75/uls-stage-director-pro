import { describe, expect, it } from "vitest";

import { directorDocuSignLikelyNeedsAction } from "./portal-director-helpers";

describe("directorDocuSignLikelyNeedsAction", () => {
  it("treats terminal mirror states as no attention needed", () => {
    for (const s of ["completed", "voided", "declined", "deleted", "Completed", "VOIDED"]) {
      expect(directorDocuSignLikelyNeedsAction(s)).toBe(false);
    }
  });

  it("treats empty or unknown as needing attention", () => {
    expect(directorDocuSignLikelyNeedsAction("")).toBe(true);
    expect(directorDocuSignLikelyNeedsAction("unknown")).toBe(true);
    expect(directorDocuSignLikelyNeedsAction("  UNKNOWN  ")).toBe(true);
  });

  it("treats in-flight statuses as needing attention", () => {
    expect(directorDocuSignLikelyNeedsAction("sent")).toBe(true);
    expect(directorDocuSignLikelyNeedsAction("delivered")).toBe(true);
    expect(directorDocuSignLikelyNeedsAction("correct")).toBe(true);
  });
});
