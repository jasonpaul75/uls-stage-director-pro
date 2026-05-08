import { directorShareFriendlyTypeSummary } from "@/lib/director-share-upload-policy";

/**
 * Messages for `ds_err` query params after portal or producer director-share actions.
 */
export const DIRECTOR_SHARE_ERR_COPY: Record<string, string> = {
  bad_project: "That production isn’t available for this action.",
  bad_request: "Couldn’t process that file request.",
  storage_not_configured: "S3 storage isn’t configured on the server.",
  empty_file: "Upload was empty — try again with a valid file.",
  too_large:
    "That file is too large — director production file uploads are limited to 1 GB each (same ceiling as video cue files).",
  bad_type: `That file type isn’t allowed — ${directorShareFriendlyTypeSummary()}`,
  not_found: "That file is no longer available — refresh the page.",
  server: "Server error — try again shortly.",
};
