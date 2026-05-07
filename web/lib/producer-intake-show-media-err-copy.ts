export const PRODUCER_INTAKE_SHOW_MEDIA_ERR_COPY: Record<string, string> = {
  storage_not_configured:
    "Show media storage is not configured — set AWS_REGION and AWS_S3_ATTACHMENTS_BUCKET (objects use the project-show-media prefix).",
  bad_request: "Couldn’t process that request — refresh and try again.",
  bad_project: "That intake row is not available for show media.",
  empty_file: "Choose a non-empty file before uploading.",
  bad_lane: "Pick music or video before uploading.",
  bad_type: "That file type isn’t allowed for this lane — use common audio (MP3, M4A, WAV, …) or video (MP4, WebM, MOV).",
  too_large: "That file exceeds the size limit for this lane (video up to 1 GB per product spec).",
  server: "Upload failed server-side — check S3 IAM and try again.",
  not_found: "That media row is no longer on record.",
  bad_order: "Couldn’t reorder — refresh and try again.",
  import_missing: "Couldn’t find that library or source show cue anymore — refresh and pick again.",
};
