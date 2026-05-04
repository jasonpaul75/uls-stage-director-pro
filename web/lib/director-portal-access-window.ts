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
