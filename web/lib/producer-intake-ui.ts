/** Shared control chrome for producer intake/event workspace sections. */

export const producerIntakeFieldClass =
  "rounded-md border border-uls-border-strong bg-uls-surface-inset px-3 py-2 text-sm text-uls-text placeholder:text-uls-subtle disabled:opacity-40";

/** Native `type="date"` — Chromium draws a dark calendar glyph on dark fields; invert + dark scheme for visibility. */
export const producerIntakeDateFieldClass = `${producerIntakeFieldClass} [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-90 [&::-webkit-calendar-picker-indicator]:invert`;

export const producerIntakeMonoFieldClass =
  "rounded-md border border-uls-border-strong bg-uls-surface-inset px-3 py-2 font-mono text-[13px] text-uls-text placeholder:text-uls-subtle disabled:opacity-40";

export const producerIntakeMutedBoxClass =
  "rounded-md border border-uls-border bg-uls-surface/45 px-3 py-2 text-xs text-uls-muted";

export const producerIntakeInsetFieldsetClass =
  "space-y-2 rounded-md border border-uls-border/90 bg-uls-surface-inset/50 px-3 py-3 text-xs text-uls-muted";
