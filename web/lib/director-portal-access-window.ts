/**
 * Director portal access (ULS_Stage_Director_PRO.md § Director access cutoff):
 * portal access is revoked after 90 calendar days from the event conclusion date.
 * Uses UTC calendar components of `eventConclusionAt` so the window is stable across timezones.
 */

export const DIRECTOR_PORTAL_ACCESS_DAYS_AFTER_CONCLUSION = 90;

/** Last instant (UTC) directors may use the portal for this production. */
export function directorPortalAccessDeadlineUtc(eventConclusionAt: Date): Date {
  const d = new Date(
    Date.UTC(
      eventConclusionAt.getUTCFullYear(),
      eventConclusionAt.getUTCMonth(),
      eventConclusionAt.getUTCDate(),
    ),
  );
  d.setUTCDate(d.getUTCDate() + DIRECTOR_PORTAL_ACCESS_DAYS_AFTER_CONCLUSION);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/** When `eventConclusionAt` is null, the production is treated as not concluded yet — access stays open. */
export function isDirectorPortalAccessRevoked(
  eventConclusionAt: Date | null,
  at: Date = new Date(),
): boolean {
  if (eventConclusionAt == null) return false;
  return at.getTime() > directorPortalAccessDeadlineUtc(eventConclusionAt).getTime();
}

/** Producer inbox: warn when portal access is within this many days of the UTC deadline. */
export const DIRECTOR_PORTAL_PRODUCER_INBOX_WARN_DAYS = 14;

export type DirectorPortalProducerInboxCue =
  | { kind: "access_ended"; deadlineUtc: Date }
  | { kind: "access_ending_soon"; deadlineUtc: Date };

/** Optional badge data for producer queue rows — ended access, or approaching the 90-day cutoff. */
export function directorPortalProducerInboxCue(
  eventConclusionAt: Date | null,
  at: Date = new Date(),
  warnWithinDays: number = DIRECTOR_PORTAL_PRODUCER_INBOX_WARN_DAYS,
): DirectorPortalProducerInboxCue | null {
  if (eventConclusionAt == null) return null;
  const deadline = directorPortalAccessDeadlineUtc(eventConclusionAt);
  if (isDirectorPortalAccessRevoked(eventConclusionAt, at)) {
    return { kind: "access_ended", deadlineUtc: deadline };
  }
  const msLeft = deadline.getTime() - at.getTime();
  if (msLeft <= 0) return null;
  const daysLeft = msLeft / 86_400_000;
  if (daysLeft <= warnWithinDays) {
    return { kind: "access_ending_soon", deadlineUtc: deadline };
  }
  return null;
}
