import { describe, expect, it } from "vitest";

import { normalizeEmail } from "./normalize-email";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Pat.DOE@Example.COM \n")).toBe("pat.doe@example.com");
  });

  it("maps whitespace-only input to empty string", () => {
    expect(normalizeEmail(" \t")).toBe("");
  });

  it("normalizes NFC-like stable strings without collapsing plus-addressing semantics", () => {
    expect(normalizeEmail("User+TAG@DOMAIN.org")).toBe("user+tag@domain.org");
  });
});
