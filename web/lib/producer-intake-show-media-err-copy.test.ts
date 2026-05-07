import { describe, expect, it } from "vitest";

import { PRODUCER_INTAKE_SHOW_MEDIA_ERR_COPY } from "./producer-intake-show-media-err-copy";

describe("PRODUCER_INTAKE_SHOW_MEDIA_ERR_COPY", () => {
  it("documents known error keys", () => {
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
    ] as const) {
      expect(PRODUCER_INTAKE_SHOW_MEDIA_ERR_COPY[key]?.trim().length).toBeGreaterThan(0);
    }
  });
});
