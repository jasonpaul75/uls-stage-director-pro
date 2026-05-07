import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalRole, ProjectRole } from "@prisma/client";

vi.mock("@/lib/invite-token", () => ({
  hashInviteToken: vi.fn(() => "hashed-token-fixture"),
}));

vi.mock("bcryptjs", () => ({
  hashSync: vi.fn(() => "hashed-password-mock"),
}));

const prismaMocks = vi.hoisted(() => ({
  directorInviteFindFirst: vi.fn(),
  inviteUpdate: vi.fn(),
  userFindUnique: vi.fn(),
  userCreate: vi.fn(),
  projectMemberUpsert: vi.fn(),
  projectMemberCreate: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    directorInvite: {
      findFirst: prismaMocks.directorInviteFindFirst,
      update: prismaMocks.inviteUpdate,
    },
    user: {
      findUnique: prismaMocks.userFindUnique,
      create: prismaMocks.userCreate,
    },
    projectMember: {
      upsert: prismaMocks.projectMemberUpsert,
      create: prismaMocks.projectMemberCreate,
    },
    $transaction: prismaMocks.$transaction,
  },
}));

const revalidateProducerOverview = vi.fn();
const revalidateProjectMirrorCache = vi.fn();
vi.mock("@/lib/revalidate-project-mirror-cache", () => ({
  revalidateProducerOverview,
  revalidateProjectMirrorCache,
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

const VALID_TOKEN = "a".repeat(64);
/** Token length 64 but fails `TOKEN_RE` (needs lowercase hex only). */

const MIXED_HEX_TOKEN = `A${"a".repeat(63)}`;

function fdExisting(token = VALID_TOKEN) {
  const f = new FormData();
  f.set("token", token);
  return f;
}

function fdNewAccount(overrides: Partial<Record<string, string>> = {}) {
  const f = new FormData();
  f.set("token", VALID_TOKEN);
  f.set("name", overrides.name ?? "Pat Director");
  f.set("password", overrides.password ?? "correcthorse1234");
  f.set("confirm", overrides.confirm ?? "correcthorse1234");
  return f;
}

const future = () => new Date(Date.now() + 86400_000);
const past = () => new Date(Date.now() - 86400_000);

describe("acceptInviteExistingDirector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects invalid token shape without loading the invite", async () => {
    const { acceptInviteExistingDirector } = await import("./actions");

    await expect(acceptInviteExistingDirector(fdExisting("short"))).rejects.toThrow("redirect:/invite/invalid");
    expect(prismaMocks.directorInviteFindFirst).not.toHaveBeenCalled();
  });

  it("rejects 64-char tokens outside lowercase hex alphabet", async () => {
    const { acceptInviteExistingDirector } = await import("./actions");

    await expect(acceptInviteExistingDirector(fdExisting(MIXED_HEX_TOKEN))).rejects.toThrow(
      "redirect:/invite/invalid",
    );
    expect(prismaMocks.directorInviteFindFirst).not.toHaveBeenCalled();
  });

  it("redirects when invite is not found", async () => {
    const { acceptInviteExistingDirector } = await import("./actions");
    prismaMocks.directorInviteFindFirst.mockResolvedValueOnce(null);

    await expect(acceptInviteExistingDirector(fdExisting())).rejects.toThrow("redirect:/invite/invalid");
  });

  it("redirects when invite is expired", async () => {
    const { acceptInviteExistingDirector } = await import("./actions");
    prismaMocks.directorInviteFindFirst.mockResolvedValueOnce({
      id: "inv1",
      email: "d@example.com",
      projectId: "proj1",
      expiresAt: past(),
    });

    await expect(acceptInviteExistingDirector(fdExisting())).rejects.toThrow("redirect:/invite/invalid");
  });

  it("redirects with mismatch when no user exists for invite email", async () => {
    const { acceptInviteExistingDirector } = await import("./actions");
    prismaMocks.directorInviteFindFirst.mockResolvedValueOnce({
      id: "inv1",
      email: "d@example.com",
      projectId: "proj1",
      expiresAt: future(),
    });
    prismaMocks.userFindUnique.mockResolvedValueOnce(null);

    await expect(acceptInviteExistingDirector(fdExisting())).rejects.toThrow(
      `redirect:/invite/${VALID_TOKEN}?error=mismatch`,
    );
    expect(prismaMocks.$transaction).not.toHaveBeenCalled();
  });

  it("redirects with mismatch when account is not director-class", async () => {
    const { acceptInviteExistingDirector } = await import("./actions");
    prismaMocks.directorInviteFindFirst.mockResolvedValueOnce({
      id: "inv1",
      email: "prod@example.com",
      projectId: "proj1",
      expiresAt: future(),
    });
    prismaMocks.userFindUnique.mockResolvedValueOnce({ id: "u1", globalRole: GlobalRole.PRODUCER });

    await expect(acceptInviteExistingDirector(fdExisting())).rejects.toThrow(
      `redirect:/invite/${VALID_TOKEN}?error=mismatch`,
    );
    expect(prismaMocks.$transaction).not.toHaveBeenCalled();
  });

  it("consumes invite, upserts membership, revalidates, sends to login (director)", async () => {
    const { acceptInviteExistingDirector } = await import("./actions");
    prismaMocks.directorInviteFindFirst.mockResolvedValueOnce({
      id: "inv1",
      email: "dir@example.com",
      projectId: "proj1",
      expiresAt: future(),
    });
    prismaMocks.userFindUnique.mockResolvedValueOnce({ id: "u_dir", globalRole: GlobalRole.DIRECTOR });

    prismaMocks.projectMemberUpsert.mockResolvedValueOnce({});
    prismaMocks.inviteUpdate.mockResolvedValueOnce({});

    prismaMocks.$transaction.mockImplementationOnce(async (fn: (tx: never) => Promise<void>) => {
      await fn({
        projectMember: { upsert: prismaMocks.projectMemberUpsert },
        directorInvite: { update: prismaMocks.inviteUpdate },
      });
    });

    await expect(acceptInviteExistingDirector(fdExisting())).rejects.toThrow(
      `redirect:/login?joined=1&callbackUrl=${encodeURIComponent("/portal")}&prefill=${encodeURIComponent("dir@example.com")}`,
    );

    expect(prismaMocks.projectMemberUpsert).toHaveBeenCalled();
    expect(prismaMocks.inviteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "inv1" }, data: { consumedAt: expect.any(Date) } }),
    );
    expect(revalidateProducerOverview).toHaveBeenCalled();
    expect(revalidateProjectMirrorCache).toHaveBeenCalledWith("proj1");
  });

  it("treats ULS_ADMIN inbox proof the same as an existing director membership", async () => {
    const { acceptInviteExistingDirector } = await import("./actions");
    prismaMocks.directorInviteFindFirst.mockResolvedValueOnce({
      id: "inv_admin",
      email: "staff@uls.com",
      projectId: "proj_a",
      expiresAt: future(),
    });
    prismaMocks.userFindUnique.mockResolvedValueOnce({ id: "u_admin", globalRole: GlobalRole.ULS_ADMIN });

    prismaMocks.projectMemberUpsert.mockResolvedValueOnce({});
    prismaMocks.inviteUpdate.mockResolvedValueOnce({});

    prismaMocks.$transaction.mockImplementationOnce(async (fn: (tx: never) => Promise<void>) => {
      await fn({
        projectMember: { upsert: prismaMocks.projectMemberUpsert },
        directorInvite: { update: prismaMocks.inviteUpdate },
      });
    });

    await expect(acceptInviteExistingDirector(fdExisting())).rejects.toThrow(
      `redirect:/login?joined=1&callbackUrl=${encodeURIComponent("/portal")}&prefill=${encodeURIComponent("staff@uls.com")}`,
    );

    expect(prismaMocks.projectMemberUpsert).toHaveBeenCalled();
  });
});

describe("acceptInviteNewDirectorAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when invite token is invalid", async () => {
    const { acceptInviteNewDirectorAccount } = await import("./actions");
    const f = new FormData();
    f.set("token", "bad");
    f.set("password", "correcthorse1234");
    f.set("confirm", "correcthorse1234");

    const out = await acceptInviteNewDirectorAccount(f);
    expect(out).toEqual({ ok: false, message: "This invite link is no longer valid." });
    expect(prismaMocks.directorInviteFindFirst).not.toHaveBeenCalled();
  });

  it("returns error when well-formed token has no unconsumed invite row", async () => {
    const { acceptInviteNewDirectorAccount } = await import("./actions");
    prismaMocks.directorInviteFindFirst.mockResolvedValueOnce(null);

    const out = await acceptInviteNewDirectorAccount(fdNewAccount());
    expect(out).toEqual({ ok: false, message: "This invite link is no longer valid." });
  });

  it("returns error when invite expired", async () => {
    const { acceptInviteNewDirectorAccount } = await import("./actions");
    prismaMocks.directorInviteFindFirst.mockResolvedValueOnce({
      id: "inv1",
      email: "new@example.com",
      projectId: "proj1",
      expiresAt: past(),
    });

    const out = await acceptInviteNewDirectorAccount(fdNewAccount());
    expect(out).toEqual({ ok: false, message: "This invite has expired." });
  });

  it("returns error when email already has director account", async () => {
    const { acceptInviteNewDirectorAccount } = await import("./actions");
    prismaMocks.directorInviteFindFirst.mockResolvedValueOnce({
      id: "inv1",
      email: "existing@example.com",
      projectId: "proj1",
      expiresAt: future(),
    });
    prismaMocks.userFindUnique.mockResolvedValueOnce({ id: "x", globalRole: GlobalRole.DIRECTOR });

    const out = await acceptInviteNewDirectorAccount(fdNewAccount());
    expect(out.ok).toBe(false);
    expect(out.ok === false && out.message).toContain("already has an account");
  });

  it("returns error when email belongs to a non-director internal account", async () => {
    const { acceptInviteNewDirectorAccount } = await import("./actions");
    prismaMocks.directorInviteFindFirst.mockResolvedValueOnce({
      id: "inv1",
      email: "prod@example.com",
      projectId: "proj1",
      expiresAt: future(),
    });
    prismaMocks.userFindUnique.mockResolvedValueOnce({ id: "x", globalRole: GlobalRole.PRODUCER });

    const out = await acceptInviteNewDirectorAccount(fdNewAccount());
    expect(out.ok).toBe(false);
    expect(out.ok === false && out.message).toContain("internal/production account");
  });

  it("returns error when password is too short", async () => {
    const { acceptInviteNewDirectorAccount } = await import("./actions");
    prismaMocks.directorInviteFindFirst.mockResolvedValueOnce({
      id: "inv1",
      email: "new@example.com",
      projectId: "proj1",
      expiresAt: future(),
    });
    prismaMocks.userFindUnique.mockResolvedValueOnce(null);

    const out = await acceptInviteNewDirectorAccount(fdNewAccount({ password: "short", confirm: "short" }));
    expect(out).toEqual({ ok: false, message: "Password must be at least 10 characters." });
  });

  it("returns error when passwords do not match", async () => {
    const { acceptInviteNewDirectorAccount } = await import("./actions");
    prismaMocks.directorInviteFindFirst.mockResolvedValueOnce({
      id: "inv1",
      email: "new@example.com",
      projectId: "proj1",
      expiresAt: future(),
    });
    prismaMocks.userFindUnique.mockResolvedValueOnce(null);

    const out = await acceptInviteNewDirectorAccount(
      fdNewAccount({ password: "correcthorse1234", confirm: "otherpassword99" }),
    );
    expect(out).toEqual({ ok: false, message: "Passwords do not match." });
  });

  it("creates user, membership, consumes invite, revalidates, returns success", async () => {
    const { acceptInviteNewDirectorAccount } = await import("./actions");
    prismaMocks.directorInviteFindFirst.mockResolvedValueOnce({
      id: "inv1",
      email: "fresh@example.com",
      projectId: "proj1",
      expiresAt: future(),
    });
    prismaMocks.userFindUnique.mockResolvedValueOnce(null);

    prismaMocks.userCreate.mockResolvedValueOnce({ id: "new_user" });
    prismaMocks.projectMemberCreate.mockResolvedValueOnce({});
    prismaMocks.inviteUpdate.mockResolvedValueOnce({});

    prismaMocks.$transaction.mockImplementationOnce(async (fn: (tx: never) => Promise<void>) => {
      await fn({
        user: { create: prismaMocks.userCreate },
        projectMember: { create: prismaMocks.projectMemberCreate },
        directorInvite: { update: prismaMocks.inviteUpdate },
      });
    });

    const out = await acceptInviteNewDirectorAccount(fdNewAccount({ name: "New Director" }));

    expect(out).toEqual({ ok: true, emailForSignIn: "fresh@example.com" });
    expect(prismaMocks.userCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "fresh@example.com",
          name: "New Director",
          globalRole: GlobalRole.DIRECTOR,
        }),
      }),
    );
    expect(prismaMocks.projectMemberCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { projectId: "proj1", userId: "new_user", role: ProjectRole.DIRECTOR },
      }),
    );
    expect(revalidateProducerOverview).toHaveBeenCalled();
    expect(revalidateProjectMirrorCache).toHaveBeenCalledWith("proj1");
  });

  it("returns generic failure when transactional create path throws", async () => {
    const { acceptInviteNewDirectorAccount } = await import("./actions");
    prismaMocks.directorInviteFindFirst.mockResolvedValueOnce({
      id: "inv1",
      email: "fail@example.com",
      projectId: "proj1",
      expiresAt: future(),
    });
    prismaMocks.userFindUnique.mockResolvedValueOnce(null);

    prismaMocks.$transaction.mockRejectedValueOnce(new Error("unique(email)"));

    const out = await acceptInviteNewDirectorAccount(fdNewAccount());
    expect(out).toEqual({ ok: false, message: "Something went wrong. Try again or ask for a new invite." });
    expect(revalidateProducerOverview).not.toHaveBeenCalled();
  });

  it("stores undefined name when field is whitespace-only after trim", async () => {
    const { acceptInviteNewDirectorAccount } = await import("./actions");
    prismaMocks.directorInviteFindFirst.mockResolvedValueOnce({
      id: "inv_nm",
      email: "noname@example.com",
      projectId: "proj_n",
      expiresAt: future(),
    });
    prismaMocks.userFindUnique.mockResolvedValueOnce(null);

    prismaMocks.userCreate.mockResolvedValueOnce({ id: "u_nm" });
    prismaMocks.projectMemberCreate.mockResolvedValueOnce({});
    prismaMocks.inviteUpdate.mockResolvedValueOnce({});

    prismaMocks.$transaction.mockImplementationOnce(async (fn: (tx: never) => Promise<void>) => {
      await fn({
        user: { create: prismaMocks.userCreate },
        projectMember: { create: prismaMocks.projectMemberCreate },
        directorInvite: { update: prismaMocks.inviteUpdate },
      });
    });

    const f = fdNewAccount();
    f.set("name", "\t ");

    const out = await acceptInviteNewDirectorAccount(f);
    expect(out).toEqual({ ok: true, emailForSignIn: "noname@example.com" });

    expect(prismaMocks.userCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "noname@example.com",
        name: undefined,
        globalRole: GlobalRole.DIRECTOR,
      }),
    });
  });
});
