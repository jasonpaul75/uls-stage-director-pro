import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`redirect:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

vi.mock("@/lib/invite-token", () => ({
  createInviteOpaqueToken: vi.fn(() => "f".repeat(64)),
  hashInviteToken: vi.fn(() => "reset-token-hash-fixed"),
}));

const sendPasswordResetEmail = vi.fn();
vi.mock("@/lib/email/send-password-reset", () => ({
  sendPasswordResetEmail: (...args: unknown[]) => sendPasswordResetEmail(...args),
}));

const prismaMocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  tokenDeleteMany: vi.fn(),
  tokenCreate: vi.fn(),
  tokenDeleteOne: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: prismaMocks.userFindUnique },
    passwordResetToken: {
      deleteMany: prismaMocks.tokenDeleteMany,
      create: prismaMocks.tokenCreate,
      delete: prismaMocks.tokenDeleteOne,
    },
  },
}));

describe("requestPasswordReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockReset();
    prismaMocks.userFindUnique.mockReset();
    prismaMocks.tokenDeleteMany.mockReset();
    prismaMocks.tokenCreate.mockReset();
    prismaMocks.tokenDeleteOne.mockReset();
    sendPasswordResetEmail.mockReset().mockResolvedValue(true);
    process.env.APP_BASE_URL = "https://app.example";
  });

  function form(email: string) {
    const fd = new FormData();
    fd.set("email", email);
    return fd;
  }

  it('redirects with sent=1 for malformed email without touching the database', async () => {
    const { requestPasswordReset } = await import("./actions");
    await expect(requestPasswordReset(form("not-email"))).rejects.toThrow("redirect:/login/forgot-password?sent=1");
    expect(prismaMocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("redirects sent=1 for whitespace-only input without querying the DB", async () => {
    const { requestPasswordReset } = await import("./actions");
    await expect(requestPasswordReset(form("   \t"))).rejects.toThrow("redirect:/login/forgot-password?sent=1");
    expect(prismaMocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("redirects sent=1 when normalized email exceeds max length guard", async () => {
    const { requestPasswordReset } = await import("./actions");
    const tooLongLocal = `${"a".repeat(251)}@b.c`; // shape OK, length 255
    await expect(requestPasswordReset(form(tooLongLocal))).rejects.toThrow("redirect:/login/forgot-password?sent=1");
    expect(prismaMocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("redirects with sent=1 when user does not exist or has no password (anti-enumeration)", async () => {
    const { requestPasswordReset } = await import("./actions");
    prismaMocks.userFindUnique.mockResolvedValueOnce(null);

    await expect(requestPasswordReset(form("gone@example.com"))).rejects.toThrow(
      "redirect:/login/forgot-password?sent=1",
    );
    expect(prismaMocks.tokenCreate).not.toHaveBeenCalled();
  });

  it("creates opaque token row and mails reset link using APP_BASE_URL", async () => {
    const { requestPasswordReset } = await import("./actions");
    prismaMocks.userFindUnique.mockResolvedValueOnce({ id: "u1", passwordHash: "bcrypt-hash" });
    prismaMocks.tokenCreate.mockResolvedValueOnce({ id: "row_pw" });

    await expect(requestPasswordReset(form("Pat@Example.COM"))).rejects.toThrow(
      "redirect:/login/forgot-password?sent=1",
    );

    expect(prismaMocks.tokenDeleteMany).toHaveBeenCalledWith({
      where: { userId: "u1", consumedAt: null },
    });
    expect(prismaMocks.tokenCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tokenHash: "reset-token-hash-fixed",
          userId: "u1",
        }),
        select: { id: true },
      }),
    );
    expect(sendPasswordResetEmail).toHaveBeenCalledWith({
      toEmail: "pat@example.com",
      resetUrl: "https://app.example/reset/ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    });
    expect(prismaMocks.tokenDeleteOne).not.toHaveBeenCalled();
  });

  it("strips trailing slash from APP_BASE_URL when building reset link", async () => {
    process.env.APP_BASE_URL = "https://stage.example/";
    const { requestPasswordReset } = await import("./actions");
    prismaMocks.userFindUnique.mockResolvedValueOnce({ id: "u1", passwordHash: "bcrypt-hash" });
    prismaMocks.tokenCreate.mockResolvedValueOnce({ id: "row_x" });

    await expect(requestPasswordReset(form("u@example.com"))).rejects.toThrow(
      "redirect:/login/forgot-password?sent=1",
    );

    expect(sendPasswordResetEmail).toHaveBeenCalledWith({
      toEmail: "u@example.com",
      resetUrl: "https://stage.example/reset/ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    });
  });

  it("redirects sent=1 when user has no password credential", async () => {
    const { requestPasswordReset } = await import("./actions");
    prismaMocks.userFindUnique.mockResolvedValueOnce({ id: "u_oauth", passwordHash: null });

    await expect(requestPasswordReset(form("member@example.com"))).rejects.toThrow(
      "redirect:/login/forgot-password?sent=1",
    );
    expect(prismaMocks.tokenCreate).not.toHaveBeenCalled();
  });

  it("redirects err=server when token row creation fails", async () => {
    const { requestPasswordReset } = await import("./actions");
    prismaMocks.userFindUnique.mockResolvedValueOnce({ id: "u1", passwordHash: "x" });
    prismaMocks.tokenCreate.mockRejectedValueOnce(new Error("db"));

    await expect(requestPasswordReset(form("ok@example.com"))).rejects.toThrow(
      "redirect:/login/forgot-password?err=server",
    );
  });

  it("deletes provisional token when mail send fails", async () => {
    const { requestPasswordReset } = await import("./actions");
    prismaMocks.userFindUnique.mockResolvedValueOnce({ id: "u1", passwordHash: "x" });
    prismaMocks.tokenCreate.mockResolvedValueOnce({ id: "row_fail" });
    sendPasswordResetEmail.mockResolvedValueOnce(false);
    prismaMocks.tokenDeleteOne.mockResolvedValueOnce({});

    await expect(requestPasswordReset(form("ok@example.com"))).rejects.toThrow(
      "redirect:/login/forgot-password?err=mail",
    );
    expect(prismaMocks.tokenDeleteOne).toHaveBeenCalledWith({ where: { id: "row_fail" } });
  });

  it("still redirects err=mail when token cleanup after failed send rejects", async () => {
    const { requestPasswordReset } = await import("./actions");
    prismaMocks.userFindUnique.mockResolvedValueOnce({ id: "u1", passwordHash: "x" });
    prismaMocks.tokenCreate.mockResolvedValueOnce({ id: "row_orphan" });
    sendPasswordResetEmail.mockResolvedValueOnce(false);
    prismaMocks.tokenDeleteOne.mockRejectedValueOnce(new Error("already gone"));

    await expect(requestPasswordReset(form("ok@example.com"))).rejects.toThrow(
      "redirect:/login/forgot-password?err=mail",
    );
  });
});
