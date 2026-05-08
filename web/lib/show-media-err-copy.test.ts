import { describe, expect, it } from "vitest";

import { SHOW_MEDIA_ERR_COPY } from "@/lib/show-media-err-copy";

describe("SHOW_MEDIA_ERR_COPY", () => {
  it("documents known producer / portal flash keys", () => {
    for (const key of [
      "storage_not_configured",
      "bad_request",
      "bad_project",
      "empty_file",
      "bad_lane",
      "bad_type",
      "too_large",
      "server",
      "not_found",
      "bad_order",
      "import_missing",
    ] as const) {
      expect(SHOW_MEDIA_ERR_COPY[key]?.trim().length).toBeGreaterThan(0);
    }
  });

  it("anchors bad_type to policy summaries", () => {
    expect(SHOW_MEDIA_ERR_COPY.bad_type?.toLowerCase()).toContain("mp3");
    expect(SHOW_MEDIA_ERR_COPY.bad_type).toMatch(/MP4|QuickTime/i);
  });

  it("states both lane ceilings for too_large", () => {
    expect(SHOW_MEDIA_ERR_COPY.too_large).toMatch(/120/i);
    expect(SHOW_MEDIA_ERR_COPY.too_large).toContain("GB");
  });
});
