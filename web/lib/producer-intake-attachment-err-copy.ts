export const PRODUCER_INTAKE_ATTACH_ERR_COPY: Record<string, string> = {
  storage_not_configured:
    "Private file storage is not configured yet — set AWS_REGION and AWS_S3_ATTACHMENTS_BUCKET on the server (IAM Put/Get/Delete on that prefix).",
  bad_request: "Couldn’t process that upload — refresh and try again.",
  bad_project: "That intake row is not available for attachments.",
  empty_file: "Choose a non-empty file before uploading.",
  bad_type: "That file type isn’t allowed yet — use PDF, Word (.docx), or a common image format.",
  too_large: "That file is larger than the 35 MB limit.",
  server: "Upload failed server-side — check S3 IAM permissions and try again.",
  not_found: "That attachment is no longer on record.",
};
