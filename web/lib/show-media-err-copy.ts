import { ShowMediaLane } from "@prisma/client";

import { SHOW_MEDIA_MAX_BYTES, showMediaAllLanesFriendlyTypeSummary } from "@/lib/show-media-upload-policy";

const musicMb = Math.round(SHOW_MEDIA_MAX_BYTES[ShowMediaLane.MUSIC] / (1024 * 1024));
const videoGb = SHOW_MEDIA_MAX_BYTES[ShowMediaLane.VIDEO] / (1024 * 1024 * 1024);

/**
 * Messages for `media_err` redirects (producer inbox / event) and overlapping `lib_err` keys on the media library page.
 */
export const SHOW_MEDIA_ERR_COPY: Record<string, string> = {
  storage_not_configured:
    "Show media storage is not configured — set AWS_REGION and AWS_S3_ATTACHMENTS_BUCKET (library uploads and cue files share this bucket).",
  bad_request: "Couldn’t process that request — refresh and try again.",
  bad_project: "That intake row is not available for show media.",
  empty_file: "Choose a non-empty file before uploading.",
  bad_lane: "Pick music or video before uploading.",
  bad_type: `That file type isn’t allowed for this lane — ${showMediaAllLanesFriendlyTypeSummary()}`,
  too_large: `That file exceeds the size limit for this lane (music up to ~${musicMb} MB · video up to ~${videoGb} GB per product caps).`,
  server: "Upload failed server-side — check S3 IAM and try again.",
  not_found: "That item isn’t available anymore — refresh the page.",
  bad_order:
    "Couldn’t change order — refresh and try again, or ask your producer if the playlist changed.",
  import_missing: "Couldn’t find that library or source show cue anymore — refresh and pick again.",
};
