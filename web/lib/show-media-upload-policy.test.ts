import { describe, expect, it } from "vitest";

import { ShowMediaLane } from "@prisma/client";

import {
  SHOW_MEDIA_MAX_BYTES,
  allowedContentTypesForLane,
  isContentTypeAllowedForLane,
} from "./show-media-upload-policy";

describe("show-media-upload-policy", () => {
  it("VIDEO allows 1 GiB ceiling", () => {
    expect(SHOW_MEDIA_MAX_BYTES[ShowMediaLane.VIDEO]).toBe(1024 * 1024 * 1024);
  });

  it("accepts MPEG audio only for MUSIC lane", () => {
    expect(isContentTypeAllowedForLane(ShowMediaLane.MUSIC, "audio/mpeg")).toBe(true);
    expect(isContentTypeAllowedForLane(ShowMediaLane.MUSIC, "video/mp4")).toBe(false);
  });

  it("documents known MIME buckets", () => {
    expect(allowedContentTypesForLane(ShowMediaLane.MUSIC).size).toBeGreaterThanOrEqual(3);
    expect(allowedContentTypesForLane(ShowMediaLane.VIDEO).size).toBeGreaterThanOrEqual(2);
  });
});
