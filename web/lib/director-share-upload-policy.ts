import {
  SHOW_MEDIA_MAX_BYTES,
  allowedContentTypesForLane,
  showMediaFriendlyTypeSummary,
} from "@/lib/show-media-upload-policy";
import { ShowMediaLane } from "@prisma/client";

/** Same MIME allowlist union as music + video show-media lanes — portal Director production files. */
const DIRECTOR_SHARE_TYPES = new Set<string>([
  ...allowedContentTypesForLane(ShowMediaLane.MUSIC),
  ...allowedContentTypesForLane(ShowMediaLane.VIDEO),
]);

/** Match product ceiling for heavy video payloads (≤ 1 GB). */
export const DIRECTOR_SHARE_MAX_BYTES = SHOW_MEDIA_MAX_BYTES[ShowMediaLane.VIDEO];

export function isDirectorShareContentTypeAllowed(contentType: string): boolean {
  return DIRECTOR_SHARE_TYPES.has(contentType.trim().toLowerCase());
}

/** Stakeholder-facing line for Production files uploads (combined music + video allowlist). */
export function directorShareFriendlyTypeSummary(): string {
  return `Use ${showMediaFriendlyTypeSummary(ShowMediaLane.MUSIC)} For video, ${showMediaFriendlyTypeSummary(ShowMediaLane.VIDEO)}`;
}
