/** Product spec (insurance & compliance): platform-held unified retention baseline (36 months after event conclusion). Purge/anonymize runbook uses this instant as eligibility (subject to legal hold). */

export const PLATFORM_DATA_RETENTION_MONTHS_AFTER_CONCLUSION = 36;

/** First UTC instant at/after which runbook may treat platform-held copies as eligible (subject to legal hold and counsel). */
export function platformDataPurgeEligibleAtUtc(eventConclusionAt: Date): Date {
  const d = new Date(
    Date.UTC(
      eventConclusionAt.getUTCFullYear(),
      eventConclusionAt.getUTCMonth(),
      eventConclusionAt.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
  d.setUTCMonth(d.getUTCMonth() + PLATFORM_DATA_RETENTION_MONTHS_AFTER_CONCLUSION);
  return d;
}

export function describePlatformRetentionLine(eventConclusionAt: Date | null): string | null {
  if (eventConclusionAt == null) {
    return "Set event conclusion once the show closes out — retention countdown (36 months, UTC calendar) stays pending until then.";
  }
  const utc = platformDataPurgeEligibleAtUtc(eventConclusionAt);
  const label =
    utc.toISOString().replace("T", " ").slice(0, 16) + " UTC (36 months after recorded conclusion)";
  return `Earliest purge eligibility anchor (runbook — not automatic): ${label}.`;
}
