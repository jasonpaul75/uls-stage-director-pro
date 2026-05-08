import { describe, expect, it } from "vitest";

import { DIRECTOR_SHARE_ERR_COPY } from "@/lib/director-share-err-copy";

describe("director-share-err-copy", () => {
  it("explains bad_type with the same MIME guidance as presign / finalize paths", () => {
    expect(DIRECTOR_SHARE_ERR_COPY.bad_type).toContain("MP3");
    expect(DIRECTOR_SHARE_ERR_COPY.bad_type).toMatch(/MP4|QuickTime/);
  });

  it("explains upload size ceiling in stakeholder terms", () => {
    expect(DIRECTOR_SHARE_ERR_COPY.too_large).toContain("1 GB");
    expect(DIRECTOR_SHARE_ERR_COPY.too_large?.toLowerCase()).toContain("director production file");
  });

  it("covers known action error keys", () => {
    expect(DIRECTOR_SHARE_ERR_COPY.bad_request).toBeTruthy();
    expect(DIRECTOR_SHARE_ERR_COPY.storage_not_configured).toBeTruthy();
    expect(DIRECTOR_SHARE_ERR_COPY.not_found).toContain("refresh");
  });
});
