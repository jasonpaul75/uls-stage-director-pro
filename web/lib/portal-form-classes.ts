/** Shared portal director/producer-visible form controls (aligned with Phase 5 producer admin). */
export const portalInputClass =
  "rounded-md border border-uls-border-strong bg-uls-surface-inset px-3 py-2 text-sm text-uls-text outline-none ring-uls-accent/20 focus:border-uls-accent focus:ring-2";

/** Native date picker affordance stays dark-on-dark without WebKit tweaks + `color-scheme`. */
export const portalDateInputClass = `${portalInputClass} [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-90 [&::-webkit-calendar-picker-indicator]:invert`;
