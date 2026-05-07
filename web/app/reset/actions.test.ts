import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("bcryptjs", () => ({
  hashSync: vi.fn(() => "hashed-new-password"),
}));

vi.mock("@/lib/invite-token", () => ({
  hashInviteToken: vi.fn(() => "pw-reset-hash"),
}));

const findFirstTok = vi.fn();
const userFindUnique = vi.fn();
const userUpdate = vi.fn();
const tokenUpdate = vi.fn();
const $transaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    passwordResetToken: {
      findFirst: findFirstTok,
      update: tokenUpdate,
    },
    user: {
      findUnique: userFindUnique,
      update: userUpdate,
    },
    $transaction,
  },
}));

const TOKEN = "c".repeat(64);

describe("submitPasswordReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstTok.mockReset();
    userFindUnique.mockReset();
    userUpdate.mockReset();
    tokenUpdate.mockReset();
    $transaction.mockReset();
  });

  function fd(pw = "correcthorse1234", confirm?: string, token = TOKEN) {
    const f = new FormData();
    f.set("token", token);
    f.set("password", pw);
    f.set("confirm", confirm ?? pw);
    return f;
  }

  it("returns invalid when token is not 64 hex", async () => {
    const { submitPasswordReset } = await import("./actions");
    const out = await submitPasswordReset(fd("longpassword1", undefined, "short"));
    expect(out).toEqual({ ok: false, message: "Invalid reset link." });
    expect(findFirstTok).not.toHaveBeenCalled();
  });

  it("rejects 64-character tokens outside lowercase hex", async () => {
    const { submitPasswordReset } = await import("./actions");
    const out = await submitPasswordReset(fd("longpassword1", undefined, `B${TOKEN.slice(1)}`));
    expect(out).toEqual({ ok: false, message: "Invalid reset link." });
    expect(findFirstTok).not.toHaveBeenCalled();
  });

  it("returns friendly message when row is gone or expired", async () => {
    const { submitPasswordReset } = await import("./actions");
    findFirstTok.mockResolvedValueOnce(null);
    const out = await submitPasswordReset(fd());
    expect(out.ok).toBe(false);
    expect(out.ok === false && out.message).toContain("expired");
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it("rejects short password", async () => {
    const { submitPasswordReset } = await import("./actions");
    findFirstTok.mockResolvedValueOnce({ id: "t1", userId: "u1" });

    const out = await submitPasswordReset(fd("short", "short"));
    expect(out).toEqual({ ok: false, message: "Choose a password of at least 10 characters." });
  });

  it("rejects mismatched confirmation", async () => {
    const { submitPasswordReset } = await import("./actions");
    findFirstTok.mockResolvedValueOnce({ id: "t1", userId: "u1" });

    const out = await submitPasswordReset(fd("correcthorse1234", "otherpassword9"));
    expect(out).toEqual({ ok: false, message: "Passwords do not match." });
  });

  it("returns error when user record has no usable email", async () => {
    const { submitPasswordReset } = await import("./actions");
    findFirstTok.mockResolvedValueOnce({ id: "t1", userId: "u1" });
    userFindUnique.mockResolvedValueOnce({ email: null });

    const out = await submitPasswordReset(fd());
    expect(out).toEqual({
      ok: false,
      message: "Something went wrong. Request a fresh reset email.",
    });
    expect($transaction).not.toHaveBeenCalled();
  });

  it("returns error when user row is missing for token target", async () => {
    const { submitPasswordReset } = await import("./actions");
    findFirstTok.mockResolvedValueOnce({ id: "t1", userId: "ghost" });
    userFindUnique.mockResolvedValueOnce(null);

    const out = await submitPasswordReset(fd());

    expect(out).toEqual({
      ok: false,
      message: "Something went wrong. Request a fresh reset email.",
    });
    expect($transaction).not.toHaveBeenCalled();
  });

  it("consumes token and returns email on success", async () => {
    const { submitPasswordReset } = await import("./actions");
    const { hashSync } = await import("bcryptjs");
    findFirstTok.mockResolvedValueOnce({ id: "tok_ok", userId: "user_ok" });
    userFindUnique.mockResolvedValueOnce({ email: "pat@example.com" });
    $transaction.mockResolvedValueOnce([{}, {}]);

    const out = await submitPasswordReset(fd());

    expect(out).toEqual({ ok: true, emailForSignIn: "pat@example.com" });
    expect(hashSync).toHaveBeenCalledWith("correcthorse1234", 12);
    expect($transaction).toHaveBeenCalledTimes(1);
    expect(($transaction.mock.calls[0][0] as unknown[]).length).toBe(2);
  });

  it("maps transaction failure to generic error", async () => {
    const { submitPasswordReset } = await import("./actions");
    findFirstTok.mockResolvedValueOnce({ id: "t1", userId: "u1" });
    userFindUnique.mockResolvedValueOnce({ email: "x@test.com" });
    $transaction.mockRejectedValueOnce(new Error("deadlock"));

    const out = await submitPasswordReset(fd());
    expect(out).toEqual({ ok: false, message: "Could not reset password right now." });
  });
});
