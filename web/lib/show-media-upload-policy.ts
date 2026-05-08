import { ShowMediaLane } from "@prisma/client";

/** How to disambiguate extension → MIME — show-media/music vs video vs portal director uploads. */
export type AttachmentMimeInferContext =
  | { mode: "show_media_lane"; lane: ShowMediaLane }
  | { mode: "director_share" };

const GENERIC_S3_REPORTED_CT = new Set(["", "application/octet-stream", "binary/octet-stream"]);

export function normalizedContentTypeHeadValue(raw: string): string {
  return (raw.trim().toLowerCase().split(";")[0] ?? "").trim();
}

function extFromFilename(fileName: string): string {
  const base = fileName.trim().replace(/^.*[/\\]/, "").toLowerCase();
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1);
}

function inferMimeCandidates(ext: string, ctx: AttachmentMimeInferContext): string[] {
  switch (ext) {
    case "mp3":
    case "mpga":
    case "mp2":
      return ["audio/mpeg"];
    case "m4a":
    case "aac":
      return ["audio/mp4"];
    case "mp4":
      if (ctx.mode === "show_media_lane") {
        return ctx.lane === ShowMediaLane.MUSIC ? ["audio/mp4"] : ["video/mp4"];
      }
      return ["video/mp4", "audio/mp4"];
    case "wav":
      return ["audio/wav"];
    case "flac":
      return ["audio/flac"];
    case "ogg":
    case "oga":
    case "opus":
      return ["audio/ogg"];
    case "weba":
      return ["audio/webm"];
    case "webm":
      if (ctx.mode === "show_media_lane") {
        return ctx.lane === ShowMediaLane.MUSIC ? ["audio/webm"] : ["video/webm"];
      }
      return ["video/webm", "audio/webm"];
    case "mov":
      return ["video/quicktime"];
    default:
      return [];
  }
}

/** S3 PUT with AWS JS presigner must not carry a Content-Type header; HeadObject often returns a generic MIME — pick first allowed inference from extension. */
export function effectiveContentTypeAfterS3Put(
  headContentType: string,
  fileName: string,
  ctx: AttachmentMimeInferContext,
  allowed: (mime: string) => boolean,
): string {
  const t = normalizedContentTypeHeadValue(headContentType || "application/octet-stream");
  if (!GENERIC_S3_REPORTED_CT.has(t)) return t;

  const ext = extFromFilename(fileName);
  for (const candidate of inferMimeCandidates(ext, ctx)) {
    if (allowed(candidate)) return candidate;
  }
  return t;
}

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

/** Stakeholder-facing line — matches `allowedContentTypesForLane` (update when MIME set changes). */
export function showMediaFriendlyTypeSummary(lane: ShowMediaLane): string {
  return lane === ShowMediaLane.MUSIC
    ? "Common browser audio — e.g. MP3, AAC in MP4/M4A, WAV, WebM audio, Ogg, FLAC."
    : "MP4, WebM, or QuickTime (.mov).";
}

/** When lane isn’t known (e.g. query-string flashes), summarize both MUSIC and VIDEO allowance lists. */
export function showMediaAllLanesFriendlyTypeSummary(): string {
  return `${showMediaFriendlyTypeSummary(ShowMediaLane.MUSIC)} For video, ${showMediaFriendlyTypeSummary(ShowMediaLane.VIDEO)}`;
}

export function showMediaLaneFileAcceptAttr(lane: ShowMediaLane): string {
  return lane === ShowMediaLane.MUSIC ? "audio/*" : "video/*";
}
