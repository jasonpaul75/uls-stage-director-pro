import { describe, expect, it } from "vitest";

import { ShowMediaLane } from "@prisma/client";

import {
  SHOW_MEDIA_MAX_BYTES,
  allowedContentTypesForLane,
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
});
