"use client";

import type { ReactNode } from "react";

/** Stable window target so each new cue loads in the same operator window (park on a second display, then fullscreen in the browser). */
export const PORTAL_SHOW_MEDIA_VIDEO_WINDOW_NAME = "uls_portal_video_playback";

/**
 * Opens stream URL for this cue — named window stays on secondary display across cue changes when popups allowed.
 * @returns Whether a secondary window/tab was successfully opened (false may mean popup blocked).
 */
export function openShowMediaPlaybackWindow(itemId: string): boolean {
  if (typeof window === "undefined") return false;
  const url = `/api/show-media/${itemId}`;
  const features =
    "width=1280,height=720,menubar=no,toolbar=no,scrollbars=yes,resizable=yes";
  const w = window.open(url, PORTAL_SHOW_MEDIA_VIDEO_WINDOW_NAME, features);
  if (w) {
    w.opener = null;
    void w.focus();
    return true;
  }
  const fallback = window.open(url, "_blank", "noopener,noreferrer");
  return Boolean(fallback);
}

type WindowButtonProps = {
  itemId: string;
  /** Shown inside `aria-label` when explicit label not passed. */
  cueName?: string;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  /** Optional hint paragraph id (e.g. popup troubleshooting). */
  "aria-describedby"?: string;
};

export function PortalShowMediaPlaybackWindowButton({
  itemId,
  cueName,
  children,
  className,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: WindowButtonProps) {
  const trimmed = cueName?.trim();
  const defaultLabel =
    trimmed && trimmed.length > 0
      ? `Open dedicated playback window for ${trimmed}`
      : `Open dedicated video playback window (cue)`;

  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel ?? defaultLabel}
      aria-describedby={ariaDescribedBy}
      onClick={() => openShowMediaPlaybackWindow(itemId)}
    >
      {children}
    </button>
  );
}
