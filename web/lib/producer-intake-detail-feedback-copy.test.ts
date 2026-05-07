import { describe, expect, it } from "vitest";

import {
  PRODUCER_INTAKE_DOCUSIGN_ERR_COPY,
  PRODUCER_INTAKE_INVITE_ERR_COPY,
  PRODUCER_INTAKE_STRIPE_ERR_COPY,
} from "./producer-intake-detail-feedback-copy";

describe("producer intake feedback copy maps", () => {
  it("covers known invite error keys with non-empty copy", () => {
    for (const key of [
      "missing_email",
      "bad_email",
      "invalid_project",
      "already_member",
      "producer_account",
      "server",
      "mail_failed",
    ] as const) {
      expect(PRODUCER_INTAKE_INVITE_ERR_COPY[key]?.trim().length).toBeGreaterThan(0);
    }
  });

  it("covers known stripe error keys with non-empty copy", () => {
    for (const key of [
      "no_key",
      "already_linked",
      "no_directors",
      "stripe_api",
      "no_customer",
      "bad_amount",
      "invoice_project_mismatch",
      "invoice_not_tracked",
      "bad_invoice_state",
      "bad_line",
      "invalid_project",
    ] as const) {
      expect(PRODUCER_INTAKE_STRIPE_ERR_COPY[key]?.trim().length).toBeGreaterThan(0);
    }
  });

  it("covers known docusign error keys with non-empty copy", () => {
    for (const key of [
      "bad_envelope",
      "placeholder_envelope",
      "envelope_already_linked",
      "api",
      "invalid_project",
    ] as const) {
      expect(PRODUCER_INTAKE_DOCUSIGN_ERR_COPY[key]?.trim().length).toBeGreaterThan(0);
    }
  });
});
