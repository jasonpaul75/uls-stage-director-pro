import { createHash } from "crypto";

import { describe, expect, it, vi } from "vitest";

vi.mock("crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("crypto")>();
  return {
    ...actual,
    randomBytes: (size: number) => Buffer.alloc(size, 0x11),
  };
});

import { createInviteOpaqueToken, hashInviteToken } from "./invite-token";

describe("createInviteOpaqueToken", () => {
  it("returns 64 lowercase hex chars from deterministic randomBytes", () => {
    expect(createInviteOpaqueToken()).toBe("11".repeat(32));
  });
});

describe("hashInviteToken", () => {
  it("SHA-256 hex matches Node crypto over utf8 payload", () => {
    expect(hashInviteToken("hello-token")).toBe(
      createHash("sha256").update("hello-token", "utf8").digest("hex"),
    );
  });

  it("hashes empty string consistently", () => {
    expect(hashInviteToken("")).toBe(createHash("sha256").update("", "utf8").digest("hex"));
  });
});
