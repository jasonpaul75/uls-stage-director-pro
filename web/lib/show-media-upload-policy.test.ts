import { describe, expect, it } from "vitest";

import { ShowMediaLane } from "@prisma/client";

import {
  SHOW_MEDIA_MAX_BYTES,
  allowedContentTypesForLane,
  effectiveContentTypeAfterS3Put,
  isContentTypeAllowedForLane,
  showMediaAllLanesFriendlyTypeSummary,
  showMediaFriendlyTypeSummary,
} from "./show-media-upload-policy";

describe("show-media-upload-policy", () => {
  it("VIDEO allows 1 GiB ceiling", () => {
    expect(SHOW_MEDIA_MAX_BYTES[ShowMediaLane.VIDEO]).toBe(1024 * 1024 * 1024);
  });

  it("accepts MPEG audio only for MUSIC lane", () => {
    expect(isContentTypeAllowedForLane(ShowMediaLane.MUSIC, "audio/mpeg")).toBe(true);
    expect(isContentTypeAllowedForLane(ShowMediaLane.MUSIC, "video/mp4")).toBe(false);
  });

  it("friendly type summaries align with MUSIC vs VIDEO lanes", () => {
    expect(showMediaFriendlyTypeSummary(ShowMediaLane.MUSIC).toLowerCase()).toContain("mp3");
    expect(showMediaFriendlyTypeSummary(ShowMediaLane.VIDEO).toLowerCase()).toContain("mp4");
    expect(allowedContentTypesForLane(ShowMediaLane.MUSIC).size).toBeGreaterThanOrEqual(3);
    expect(allowedContentTypesForLane(ShowMediaLane.VIDEO).size).toBeGreaterThanOrEqual(2);
  });

  it("combined lane summary includes both music and video hints", () => {
    const s = showMediaAllLanesFriendlyTypeSummary().toLowerCase();
    expect(s).toContain("mp3");
    expect(s).toContain("mp4");
  });

  it("effectiveContentTypeAfterS3Put prefers HeadObject when specific", () => {
    const got = effectiveContentTypeAfterS3Put(
      "audio/wav",
      "wrong.exe",
      { mode: "show_media_lane", lane: ShowMediaLane.MUSIC },
      (m) => isContentTypeAllowedForLane(ShowMediaLane.MUSIC, m),
    );
    expect(got).toBe("audio/wav");
  });

  it("effectiveContentTypeAfterS3Put infers MIME from extension for generic HEAD", () => {
    const got = effectiveContentTypeAfterS3Put(
      "application/octet-stream",
      "track.mp3",
      { mode: "show_media_lane", lane: ShowMediaLane.MUSIC },
      (m) => isContentTypeAllowedForLane(ShowMediaLane.MUSIC, m),
    );
    expect(got).toBe("audio/mpeg");
  });

  it("effectiveContentTypeAfterS3Put picks video WebM vs audio WebM by lane", () => {
    const audio = effectiveContentTypeAfterS3Put(
      "binary/octet-stream",
      "cue.webm",
      { mode: "show_media_lane", lane: ShowMediaLane.MUSIC },
      (m) => isContentTypeAllowedForLane(ShowMediaLane.MUSIC, m),
    );
    const video = effectiveContentTypeAfterS3Put(
      "binary/octet-stream",
      "cue.webm",
      { mode: "show_media_lane", lane: ShowMediaLane.VIDEO },
      (m) => isContentTypeAllowedForLane(ShowMediaLane.VIDEO, m),
    );
    expect(audio).toBe("audio/webm");
    expect(video).toBe("video/webm");
  });
});
