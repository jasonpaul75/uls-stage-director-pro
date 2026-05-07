import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalRole, ProjectStatus } from "@prisma/client";

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const db = vi.hoisted(() => ({
  projectFindFirst: vi.fn(),
  projectUpdate: vi.fn(),
  flagFindFirst: vi.fn(),
  flagCreate: vi.fn(),
  flagFindUnique: vi.fn(),
  flagDelete: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findFirst: db.projectFindFirst,
      update: db.projectUpdate,
    },
    projectShowFlag: {
      findFirst: db.flagFindFirst,
      create: db.flagCreate,
      findUnique: db.flagFindUnique,
      delete: db.flagDelete,
    },
  },
}));

const revalidateProjectMirrorCache = vi.fn();
vi.mock("@/lib/revalidate-project-mirror-cache", () => ({
  revalidateProjectMirrorCache,
}));

vi.mock("@/lib/producer-event-workspace-server", () => ({
  requireProducerEventWorkspaceUnlocked: vi.fn(() => Promise.resolve()),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

function producerSession(role: GlobalRole.PRODUCER | GlobalRole.ULS_ADMIN = GlobalRole.PRODUCER) {
  return { user: { id: "prod1", globalRole: role } };
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockReset();
  db.projectFindFirst.mockReset();
  db.projectUpdate.mockReset();
  db.flagFindFirst.mockReset();
  db.flagCreate.mockReset();
  db.flagFindUnique.mockReset();
  db.flagDelete.mockReset();
  revalidateProjectMirrorCache.mockReset();
});

describe("saveProposalDraft", () => {
  it("redirects unauthenticated users", async () => {
    const { saveProposalDraft } = await import("./proposal-actions");
    authMock.mockResolvedValueOnce(null);

    const fd = new FormData();
    fd.set("projectId", "p1");
    await expect(saveProposalDraft(fd)).rejects.toThrow("redirect:/login?callbackUrl=/producer/inbox");
  });

  it("redirects directors", async () => {
    const { saveProposalDraft } = await import("./proposal-actions");
    authMock.mockResolvedValueOnce({ user: { id: "d1", globalRole: GlobalRole.DIRECTOR } });

    const fd = new FormData();
    fd.set("projectId", "p1");
    await expect(saveProposalDraft(fd)).rejects.toThrow("redirect:/login?callbackUrl=/producer/inbox");
  });

  it("redirects when projectId is missing", async () => {
    const { saveProposalDraft } = await import("./proposal-actions");
    authMock.mockResolvedValueOnce(producerSession());

    await expect(saveProposalDraft(new FormData())).rejects.toThrow("redirect:/producer/inbox");
  });

  it("redirects when project is not an open intake queue row", async () => {
    const { saveProposalDraft } = await import("./proposal-actions");
    authMock.mockResolvedValueOnce(producerSession());
    db.projectFindFirst.mockResolvedValueOnce(null);

    const fd = new FormData();
    fd.set("projectId", "gone");
    await expect(saveProposalDraft(fd)).rejects.toThrow("redirect:/producer/inbox");
    expect(db.projectFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "gone", status: ProjectStatus.INTAKE_SUBMITTED },
      }),
    );
  });

  it("persists proposal toggles and mirrors revalidate", async () => {
    const { saveProposalDraft } = await import("./proposal-actions");
    authMock.mockResolvedValueOnce(producerSession());
    db.projectFindFirst.mockResolvedValueOnce({ id: "p_open" });

    const fd = new FormData();
    fd.set("projectId", "p_open");
    fd.set("proposalPricingNotes", " Price ");
    fd.set("proposalTechRiderNotes", "");
    fd.set("proposalCrewNotes", "Crew");
    fd.set("proposalDirectorVisible", "on");
    fd.set("contractsDirectorVisible", "on");
    fd.set("stripeBillingDirectorVisible", "on");

    await expect(saveProposalDraft(fd)).rejects.toThrow("redirect:/producer/inbox/p_open?proposal_saved=1");

    expect(db.projectUpdate).toHaveBeenCalledWith({
      where: { id: "p_open" },
      data: {
        proposalPricingNotes: " Price ",
        proposalTechRiderNotes: null,
        proposalCrewNotes: "Crew",
        proposalDirectorVisible: true,
        contractsDirectorVisible: true,
        stripeBillingDirectorVisible: true,
      },
    });
    expect(revalidateProjectMirrorCache).toHaveBeenCalledWith("p_open");
  });
});

describe("saveRunOfShow", () => {
  it("updates run of show and freeze flag for queued intake", async () => {
    const { saveRunOfShow } = await import("./run-of-show-actions");
    authMock.mockResolvedValueOnce(producerSession(GlobalRole.ULS_ADMIN));
    db.projectFindFirst.mockResolvedValueOnce({ id: "p_ros" });

    const fd = new FormData();
    fd.set("projectId", "p_ros");
    fd.set("runOfShowBody", "  Act I  ");
    fd.set("runOfShowDirectorVisible", "on");
    fd.set("runOfShowFrozen", "on");

    await expect(saveRunOfShow(fd)).rejects.toThrow("redirect:/producer/inbox/p_ros/event?ros_saved=1");

    expect(db.projectUpdate).toHaveBeenCalledWith({
      where: { id: "p_ros" },
      data: {
        runOfShowBody: "  Act I  ",
        runOfShowDirectorVisible: true,
        runOfShowFrozen: true,
      },
    });
    expect(revalidateProjectMirrorCache).toHaveBeenCalledWith("p_ros");
  });
});

describe("confirmBookingSecured", () => {
  it("sets bookingSecuredAt once, then preserves existing timestamp on repeat", async () => {
    const { confirmBookingSecured } = await import("./booking-actions");
    authMock.mockResolvedValue(producerSession());

    const firstAt = new Date("2026-02-01T12:00:00.000Z");
    db.projectFindFirst
      .mockResolvedValueOnce({ id: "p_b", bookingSecuredAt: null })
      .mockResolvedValueOnce({ id: "p_b", bookingSecuredAt: firstAt });

    const fd = new FormData();
    fd.set("projectId", "p_b");

    await expect(confirmBookingSecured(fd)).rejects.toThrow("redirect:/producer/inbox/p_b?booking_confirmed=1");
    expect(db.projectUpdate).toHaveBeenLastCalledWith({
      where: { id: "p_b" },
      data: { bookingSecuredAt: expect.any(Date) },
    });
    const firstCallBooking = (db.projectUpdate.mock.calls[0][0] as { data: { bookingSecuredAt: Date } }).data
      .bookingSecuredAt;
    expect(firstCallBooking).toBeInstanceOf(Date);

    await expect(confirmBookingSecured(fd)).rejects.toThrow("redirect:/producer/inbox/p_b?booking_confirmed=1");
    expect(db.projectUpdate).toHaveBeenLastCalledWith({
      where: { id: "p_b" },
      data: { bookingSecuredAt: firstAt },
    });
  });
});

describe("addShowDayFlag", () => {
  it("redirects when body is missing but projectId present", async () => {
    const { addShowDayFlag } = await import("./show-day-flag-actions");
    authMock.mockResolvedValueOnce(producerSession());

    const fd = new FormData();
    fd.set("projectId", "p_f");
    fd.set("body", "   ");
    await expect(addShowDayFlag(fd)).rejects.toThrow("redirect:/producer/inbox/p_f/event?flag_err=required");
  });

  it("creates flag with next sort order", async () => {
    const { addShowDayFlag } = await import("./show-day-flag-actions");
    authMock.mockResolvedValueOnce(producerSession());
    db.projectFindFirst.mockResolvedValueOnce({ id: "p_f" });
    db.flagFindFirst.mockResolvedValueOnce({ sortOrder: 2 });

    const fd = new FormData();
    fd.set("projectId", "p_f");
    fd.set("body", "Load-in");

    await expect(addShowDayFlag(fd)).rejects.toThrow("redirect:/producer/inbox/p_f/event?flag_added=1");

    expect(db.flagCreate).toHaveBeenCalledWith({
      data: { projectId: "p_f", body: "Load-in", sortOrder: 3 },
    });
    expect(revalidateProjectMirrorCache).toHaveBeenCalledWith("p_f");
  });
});

describe("deleteShowDayFlag", () => {
  it("redirects when flag is not on a queued intake", async () => {
    const { deleteShowDayFlag } = await import("./show-day-flag-actions");
    authMock.mockResolvedValueOnce(producerSession());
    db.flagFindUnique.mockResolvedValue({ projectId: "p_x" });
    db.projectFindFirst.mockResolvedValue(null);

    const fd = new FormData();
    fd.set("flagId", "flg1");
    await expect(deleteShowDayFlag(fd)).rejects.toThrow("redirect:/producer/inbox");
    expect(db.flagDelete).not.toHaveBeenCalled();
  });

  it("deletes flag and revalidates", async () => {
    const { deleteShowDayFlag } = await import("./show-day-flag-actions");
    authMock.mockResolvedValueOnce(producerSession());
    db.flagFindUnique.mockResolvedValue({ projectId: "p_ok" });
    db.projectFindFirst.mockResolvedValue({ id: "p_ok" });

    const fd = new FormData();
    fd.set("flagId", "flg9");

    await expect(deleteShowDayFlag(fd)).rejects.toThrow("redirect:/producer/inbox/p_ok/event?flag_removed=1");

    expect(db.flagDelete).toHaveBeenCalledWith({ where: { id: "flg9" } });
    expect(revalidateProjectMirrorCache).toHaveBeenCalledWith("p_ok");
  });
});

describe("saveShowDayFlagsVisibility", () => {
  it("updates visibility toggle", async () => {
    const { saveShowDayFlagsVisibility } = await import("./show-day-flag-actions");
    authMock.mockResolvedValueOnce(producerSession());
    db.projectFindFirst.mockResolvedValueOnce({ id: "p_vis" });

    const fd = new FormData();
    fd.set("projectId", "p_vis");
    fd.set("showDayFlagsDirectorVisible", "on");

    await expect(saveShowDayFlagsVisibility(fd)).rejects.toThrow(
      "redirect:/producer/inbox/p_vis/event?flags_visibility_saved=1",
    );

    expect(db.projectUpdate).toHaveBeenCalledWith({
      where: { id: "p_vis" },
      data: { showDayFlagsDirectorVisible: true },
    });
  });
});
