import { describe, expect, it } from "vitest";

import { PRODUCER_INTAKE_ATTACH_ERR_COPY } from "./producer-intake-attachment-err-copy";

describe("PRODUCER_INTAKE_ATTACH_ERR_COPY", () => {
  it("documents known attachment error keys", () => {
    for (const key of [
      "storage_not_configured",
      "bad_request",
      "bad_project",
      "empty_file",
      "bad_type",
      "too_large",
      "server",
      "not_found",
    ] as const) {
      expect(PRODUCER_INTAKE_ATTACH_ERR_COPY[key]?.trim().length).toBeGreaterThan(0);
    }
  });
});
