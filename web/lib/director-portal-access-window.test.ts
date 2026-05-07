import { describe, expect, it } from "vitest";

import {
  DIRECTOR_PORTAL_PRODUCER_INBOX_WARN_DAYS,
  directorPortalAccessDeadlineUtc,
  DIRECTOR_PORTAL_ACCESS_DAYS_AFTER_CONCLUSION,
  directorPortalProducerInboxCue,
  isDirectorPortalAccessRevoked,
} from "./director-portal-access-window";

describe("directorPortalAccessDeadlineUtc", () => {
  it("normalizes conclusion time-of-day to UTC calendar start before adding 90 days", () => {
    const conclusion = new Date(Date.UTC(2025, 0, 1, 18, 22, 33));
    const deadline = directorPortalAccessDeadlineUtc(conclusion);
    const start = new Date(Date.UTC(2025, 0, 1, 0, 0, 0));
    const expected = new Date(start);
    expected.setUTCDate(expected.getUTCDate() + DIRECTOR_PORTAL_ACCESS_DAYS_AFTER_CONCLUSION);
    expected.setUTCHours(23, 59, 59, 999);
    expect(deadline.getTime()).toBe(expected.getTime());
  });
});

describe("isDirectorPortalAccessRevoked", () => {
  it("returns false when event conclusion is not set", () => {
    expect(isDirectorPortalAccessRevoked(null, new Date("2026-01-01T00:00:00Z"))).toBe(false);
  });

  it("returns false at exactly the computed deadline (through end of access day)", () => {
    const conclusion = new Date(Date.UTC(2025, 0, 15, 9, 0, 0));
    const deadline = directorPortalAccessDeadlineUtc(conclusion);
    expect(isDirectorPortalAccessRevoked(conclusion, deadline)).toBe(false);
  });

  it("returns true immediately after the deadline", () => {
    const conclusion = new Date(Date.UTC(2025, 3, 10, 0, 0, 0));
    const deadline = directorPortalAccessDeadlineUtc(conclusion);
    const after = new Date(deadline.getTime() + 1);
    expect(isDirectorPortalAccessRevoked(conclusion, after)).toBe(true);
  });

  it("returns false well before the deadline", () => {
    const conclusion = new Date(Date.UTC(2025, 8, 1, 0, 0, 0));
    const deadline = directorPortalAccessDeadlineUtc(conclusion);
    const before = new Date(deadline.getTime() - 86_400_000);
    expect(isDirectorPortalAccessRevoked(conclusion, before)).toBe(false);
  });
});

describe("directorPortalProducerInboxCue", () => {
  it("returns null when conclusion is unset", () => {
    expect(directorPortalProducerInboxCue(null, new Date("2026-06-01T00:00:00Z"))).toBeNull();
  });

  it("returns access_ended after the portal window", () => {
    const conclusion = new Date(Date.UTC(2024, 0, 1, 0, 0, 0));
    const at = new Date("2026-06-01T00:00:00Z");
    const deadline = directorPortalAccessDeadlineUtc(conclusion);
    const cue = directorPortalProducerInboxCue(conclusion, at);
    expect(cue?.kind).toBe("access_ended");
    expect(cue?.deadlineUtc.getTime()).toBe(deadline.getTime());
  });

  it("returns access_ending_soon within the warn window", () => {
    const conclusion = new Date(Date.UTC(2026, 1, 1, 0, 0, 0));
    const deadline = directorPortalAccessDeadlineUtc(conclusion);
    const at = new Date(deadline.getTime() - 10 * 86_400_000);
    const cue = directorPortalProducerInboxCue(conclusion, at, DIRECTOR_PORTAL_PRODUCER_INBOX_WARN_DAYS);
    expect(cue?.kind).toBe("access_ending_soon");
    expect(cue?.deadlineUtc.getTime()).toBe(deadline.getTime());
  });

  it("returns null when the deadline is beyond the warn window", () => {
    const conclusion = new Date(Date.UTC(2026, 1, 1, 0, 0, 0));
    const deadline = directorPortalAccessDeadlineUtc(conclusion);
    const at = new Date(deadline.getTime() - 30 * 86_400_000);
    expect(directorPortalProducerInboxCue(conclusion, at, DIRECTOR_PORTAL_PRODUCER_INBOX_WARN_DAYS)).toBeNull();
  });
});
