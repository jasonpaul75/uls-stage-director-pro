import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalRole, ProjectRole, ProjectStatus } from "@prisma/client";

const authMock = vi.fn();

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const projectFindFirst = vi.fn();
const userFindUnique = vi.fn();
const directorInviteCreate = vi.fn();
const directorInviteDelete = vi.fn().mockResolvedValue(undefined);
const directorInviteDeleteMany = vi.fn().mockResolvedValue({ count: 0 });

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findFirst: projectFindFirst },
    user: { findUnique: userFindUnique },
    directorInvite: {
      create: directorInviteCreate,
      delete: directorInviteDelete,
      deleteMany: directorInviteDeleteMany,
    },
  },
}));

const sendDirectorInviteEmailMock = vi.fn();

vi.mock("@/lib/email/send-director-invite", () => ({
  sendDirectorInviteEmail: (...args: unknown[]) => sendDirectorInviteEmailMock(...args),
}));

const inviteMocks = vi.hoisted(() => ({
  createInviteOpaqueToken: vi.fn(() => "opaque_token_stub"),
  hashInviteToken: vi.fn(() => "token_hash_stub"),
}));

vi.mock("@/lib/invite-token", () => ({
  createInviteOpaqueToken: () => inviteMocks.createInviteOpaqueToken(),
  hashInviteToken: (opaque: string) => inviteMocks.hashInviteToken(opaque),
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

const APP_BASE_ORIG = process.env.APP_BASE_URL;

function producerSession(role: GlobalRole.PRODUCER | GlobalRole.ULS_ADMIN = GlobalRole.PRODUCER, id = "prod_inv") {
  return { user: { id, globalRole: role } };
}

function inviteForm(projectId: string, directorEmail: string) {
  const fd = new FormData();
  fd.set("projectId", projectId);
  fd.set("directorEmail", directorEmail);
  return fd;
}

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  authMock.mockReset();
  projectFindFirst.mockReset();
  userFindUnique.mockReset();
  directorInviteCreate.mockReset();
  directorInviteDelete.mockClear();
  directorInviteDeleteMany.mockReset();
  inviteMocks.createInviteOpaqueToken.mockClear();
  inviteMocks.createInviteOpaqueToken.mockReturnValue("opaque_token_stub");
  inviteMocks.hashInviteToken.mockClear();
  inviteMocks.hashInviteToken.mockReturnValue("token_hash_stub");
  sendDirectorInviteEmailMock.mockReset();
  process.env.APP_BASE_URL = APP_BASE_ORIG;
});

function stubValidQueuedProject() {
  projectFindFirst.mockResolvedValueOnce({ id: "p_queued", name: "Pageant X" });
}

function stubNoExistingUserAtEmail() {
  userFindUnique.mockResolvedValueOnce(null);
}

describe("sendDirectorInvite validation", () => {
  it("rejects unauthenticated and director-only sessions", async () => {
    const { sendDirectorInvite } = await import("./invite-actions");

    authMock.mockResolvedValueOnce(null);
    await expect(sendDirectorInvite(inviteForm("p", "a@b.co"))).rejects.toThrow(
      "redirect:/login?callbackUrl=/producer/inbox",
    );

    authMock.mockResolvedValueOnce({
      user: { id: "d1", globalRole: GlobalRole.DIRECTOR },
    });
    await expect(sendDirectorInvite(inviteForm("p", "a@b.co"))).rejects.toThrow(
      "redirect:/login?callbackUrl=/producer/inbox",
    );

    expect(projectFindFirst).not.toHaveBeenCalled();
  });

  it("rejects blank project id before email checks", async () => {
    const { sendDirectorInvite } = await import("./invite-actions");
    authMock.mockResolvedValueOnce(producerSession());

    const fd = new FormData();
    fd.set("projectId", "  ");
    fd.set("directorEmail", "ok@test.com");

    await expect(sendDirectorInvite(fd)).rejects.toThrow("redirect:/producer/inbox");
    expect(projectFindFirst).not.toHaveBeenCalled();
  });

  it("flags missing email vs bad email shape post-normalize", async () => {
    const { sendDirectorInvite } = await import("./invite-actions");

    authMock.mockResolvedValueOnce(producerSession(GlobalRole.ULS_ADMIN));
    await expect(sendDirectorInvite(inviteForm("p1", "   "))).rejects.toThrow(
      "redirect:/producer/inbox/p1?invite_err=missing_email",
    );

    authMock.mockResolvedValueOnce(producerSession(GlobalRole.ULS_ADMIN));
    await expect(sendDirectorInvite(inviteForm("p1", "x@y"))).rejects.toThrow(
      "redirect:/producer/inbox/p1?invite_err=bad_email",
    );

    expect(projectFindFirst).not.toHaveBeenCalled();
  });

  it("invalid queued project short-circuits at invite_err=invalid_project", async () => {
    const { sendDirectorInvite } = await import("./invite-actions");
    authMock.mockResolvedValueOnce(producerSession());
    projectFindFirst.mockResolvedValueOnce(null);

    await expect(sendDirectorInvite(inviteForm("gone", "director@uls.com"))).rejects.toThrow(
      "redirect:/producer/inbox?invite_err=invalid_project",
    );
    expect(projectFindFirst).toHaveBeenCalledWith({
      where: { id: "gone", status: ProjectStatus.INTAKE_SUBMITTED },
      select: { id: true, name: true },
    });
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it("blocks invites when address already holds director membership", async () => {
    const { sendDirectorInvite } = await import("./invite-actions");
    authMock.mockResolvedValueOnce(producerSession());
    stubValidQueuedProject();
    userFindUnique.mockResolvedValueOnce({
      id: "u1",
      globalRole: GlobalRole.DIRECTOR,
      memberships: [{ id: "m1" }],
    });

    await expect(sendDirectorInvite(inviteForm("p_queued", "HasMember@uls.com"))).rejects.toThrow(
      "redirect:/producer/inbox/p_queued?invite_err=already_member",
    );

    expect(userFindUnique).toHaveBeenCalledWith({
      where: { email: "hasmember@uls.com" },
      select: {
        id: true,
        globalRole: true,
        memberships: {
          where: { projectId: "p_queued", role: ProjectRole.DIRECTOR },
          select: { id: true },
        },
      },
    });
    expect(directorInviteCreate).not.toHaveBeenCalled();
  });

  it("rejects when matched user is not a director-role account", async () => {
    const { sendDirectorInvite } = await import("./invite-actions");
    authMock.mockResolvedValueOnce(producerSession());
    stubValidQueuedProject();
    userFindUnique.mockResolvedValueOnce({
      id: "u_staff",
      globalRole: GlobalRole.PRODUCER,
      memberships: [],
    });

    await expect(sendDirectorInvite(inviteForm("p_queued", "staff@test.com"))).rejects.toThrow(
      "redirect:/producer/inbox/p_queued?invite_err=producer_account",
    );
    expect(directorInviteCreate).not.toHaveBeenCalled();
  });
});

describe("sendDirectorInvite finalize", () => {
  it("invite_err=server when Prisma insert throws", async () => {
    const { sendDirectorInvite } = await import("./invite-actions");
    authMock.mockResolvedValueOnce(producerSession());
    stubValidQueuedProject();
    stubNoExistingUserAtEmail();
    directorInviteCreate.mockRejectedValueOnce(new Error("db down"));

    await expect(sendDirectorInvite(inviteForm("p_queued", "new@uls.com"))).rejects.toThrow(
      "redirect:/producer/inbox/p_queued?invite_err=server",
    );
    expect(sendDirectorInviteEmailMock).not.toHaveBeenCalled();
  });

  it("deletes draft row and surfaces mail_failed when SES layer declines", async () => {
    const { sendDirectorInvite } = await import("./invite-actions");
    authMock.mockResolvedValueOnce(producerSession());
    stubValidQueuedProject();
    stubNoExistingUserAtEmail();
    directorInviteCreate.mockResolvedValueOnce({ id: "inv_row_mail" });
    sendDirectorInviteEmailMock.mockResolvedValueOnce(false);

    await expect(sendDirectorInvite(inviteForm("p_queued", "director@uls.com"))).rejects.toThrow(
      "redirect:/producer/inbox/p_queued?invite_err=mail_failed",
    );

    expect(directorInviteDelete).toHaveBeenCalledExactlyOnceWith({
      where: { id: "inv_row_mail" },
    });
    expect(revalidateProducerOverview).not.toHaveBeenCalled();
  });

  it("issues tokened row, delivers mail, revalidates caches, first-send query", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-15T10:00:00.000Z"));
    process.env.APP_BASE_URL = "https://stage.app/";

    const { sendDirectorInvite } = await import("./invite-actions");
    authMock.mockResolvedValueOnce(producerSession(GlobalRole.ULS_ADMIN, "admin_inv"));
    stubValidQueuedProject();
    stubNoExistingUserAtEmail();
    directorInviteCreate.mockResolvedValueOnce({ id: "inv_ok" });
    sendDirectorInviteEmailMock.mockResolvedValueOnce(true);

    const expectExpires = new Date("2026-02-15T10:00:00.000Z").getTime() + 7 * 86_400_000;

    await expect(sendDirectorInvite(inviteForm("p_queued", "Dir@uls.com"))).rejects.toThrow(
      "redirect:/producer/inbox/p_queued?invite_sent=1",
    );

    expect(inviteMocks.createInviteOpaqueToken).toHaveBeenCalled();
    expect(inviteMocks.hashInviteToken).toHaveBeenCalledWith("opaque_token_stub");

    expect(directorInviteCreate).toHaveBeenCalledWith({
      data: {
        email: "dir@uls.com",
        tokenHash: "token_hash_stub",
        projectId: "p_queued",
        invitedByUserId: "admin_inv",
        expiresAt: new Date(expectExpires),
      },
      select: { id: true },
    });

    expect(sendDirectorInviteEmailMock).toHaveBeenCalledWith({
      toEmail: "dir@uls.com",
      projectName: "Pageant X",
      inviteUrl: "https://stage.app/invite/opaque_token_stub",
    });
    expect(revalidateProducerOverview).toHaveBeenCalled();
    expect(revalidateProjectMirrorCache).toHaveBeenCalledWith("p_queued");
    expect(directorInviteDeleteMany).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("resendDirectorInvite", () => {
  it("clears pending rows for same email+project before re-finalizing", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00.000Z"));
    process.env.APP_BASE_URL = "http://localhost";

    const { resendDirectorInvite } = await import("./invite-actions");
    authMock.mockResolvedValueOnce(producerSession());
    stubValidQueuedProject();
    stubNoExistingUserAtEmail();
    directorInviteDeleteMany.mockResolvedValueOnce({ count: 2 });
    directorInviteCreate.mockResolvedValueOnce({ id: "inv_r2" });
    sendDirectorInviteEmailMock.mockResolvedValueOnce(true);

    await expect(resendDirectorInvite(inviteForm("p_queued", "resend@uls.com"))).rejects.toThrow(
      "redirect:/producer/inbox/p_queued?invite_sent=1&invite_resend=1",
    );

    expect(directorInviteDeleteMany).toHaveBeenCalledExactlyOnceWith({
      where: {
        projectId: "p_queued",
        email: "resend@uls.com",
        consumedAt: null,
      },
    });
    expect(directorInviteCreate).toHaveBeenCalled();
    expect(sendDirectorInviteEmailMock).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
