import { describe, expect, it } from "vitest";

import { platformDataPurgeEligibleAtUtc } from "./platform-retention";

describe("platformDataPurgeEligibleAtUtc", () => {
  it("adds 36 calendar months from the UTC conclusion calendar day (end-of-day 23:59:59.999 anchor)", () => {
    const conclusion = new Date(Date.UTC(2024, 0, 15, 12, 0, 0));
    const got = platformDataPurgeEligibleAtUtc(conclusion);
    expect(got.getUTCFullYear()).toBe(2027);
    expect(got.getUTCMonth()).toBe(0);
    expect(got.getUTCDate()).toBe(15);
    expect(got.getUTCHours()).toBe(23);
    expect(got.getUTCMinutes()).toBe(59);
    expect(got.getUTCSeconds()).toBe(59);
    expect(got.getUTCMilliseconds()).toBe(999);
  });
});
