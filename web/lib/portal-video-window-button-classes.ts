/**
 * Tailwind class strings for portal video playback window buttons.
 * Lives in a server-safe module so `portal-show-workspace` (RSC) can pass `className` into the client button.
 */

const videoWinFocusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";

export function portalVideoWindowButtonClass(variant: "primary" | "subtle" = "primary"): string {
  const base = `${videoWinFocusRing} min-h-9 min-w-9 touch-manipulation rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors disabled:opacity-40`;
  if (variant === "subtle") {
    return `${base} font-normal text-uls-muted underline decoration-white/20 underline-offset-2 hover:bg-white/[0.06] hover:text-uls-text hover:decoration-white/40`;
  }
  return `${base} font-medium text-amber-400 underline decoration-amber-500/70 underline-offset-2 hover:bg-amber-500/10 hover:text-amber-300 hover:decoration-amber-400`;
}
