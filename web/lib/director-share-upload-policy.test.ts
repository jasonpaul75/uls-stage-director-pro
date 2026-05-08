import { describe, expect, it } from "vitest";

import {
  DIRECTOR_SHARE_MAX_BYTES,
  directorShareFriendlyTypeSummary,
  isDirectorShareContentTypeAllowed,
} from "@/lib/director-share-upload-policy";

describe("director-share-upload-policy", () => {
  it("allows common audio and video types", () => {
    expect(isDirectorShareContentTypeAllowed("audio/mpeg")).toBe(true);
    expect(isDirectorShareContentTypeAllowed("video/mp4")).toBe(true);
  });

  it("rejects arbitrary binaries", () => {
    expect(isDirectorShareContentTypeAllowed("application/zip")).toBe(false);
  });

  it("caps at 1GB class ceiling", () => {
    expect(DIRECTOR_SHARE_MAX_BYTES).toBe(1024 * 1024 * 1024);
  });

  it("surfaces stakeholder-facing type hints", () => {
    expect(directorShareFriendlyTypeSummary()).toContain("MP3");
    expect(directorShareFriendlyTypeSummary()).toMatch(/MP4|QuickTime/);
  });
});
