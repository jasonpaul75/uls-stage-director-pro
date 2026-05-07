import { ShowMediaLane } from "@prisma/client";

/** Spec: video uploads ≤ 1 GB / file; music monitored (pragmatic ceiling for uploads). */
export const SHOW_MEDIA_MAX_BYTES: Record<ShowMediaLane, number> = {
  [ShowMediaLane.MUSIC]: 120 * 1024 * 1024,
  [ShowMediaLane.VIDEO]: 1024 * 1024 * 1024,
};

const AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
  "audio/flac",
]);

const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export function allowedContentTypesForLane(lane: ShowMediaLane): Set<string> {
  return lane === ShowMediaLane.MUSIC ? AUDIO_TYPES : VIDEO_TYPES;
}

export function isContentTypeAllowedForLane(lane: ShowMediaLane, contentType: string): boolean {
  const t = contentType.trim().toLowerCase();
  return allowedContentTypesForLane(lane).has(t);
}
