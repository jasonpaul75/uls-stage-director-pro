import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalRole } from "@prisma/client";

const authMock = vi.fn();

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const userFindFirst = vi.fn();
const projectFindFirst = vi.fn();
const projectUpdate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: userFindFirst },
    project: { findFirst: projectFindFirst, update: projectUpdate },
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

function producerSession(role: GlobalRole.PRODUCER | GlobalRole.ULS_ADMIN = GlobalRole.PRODUCER) {
  return { user: { id: "prod1", globalRole: role } };
}

function form(
  overrides: Partial<{
    projectId: string;
    internalNotes: string;
    eventConclusionAt: string;
    assignedToUserId: string;
    retentionLegalHold: string;
    retentionLegalHoldNote: string;
  }> = {},
) {
  const fd = new FormData();
  fd.set("projectId", overrides.projectId ?? "p1");
  fd.set("internalNotes", overrides.internalNotes ?? "");
  fd.set("eventConclusionAt", overrides.eventConclusionAt ?? "");
  if (overrides.assignedToUserId !== undefined) fd.set("assignedToUserId", overrides.assignedToUserId);
  if (overrides.retentionLegalHold !== undefined) fd.set("retentionLegalHold", overrides.retentionLegalHold);
  if (overrides.retentionLegalHoldNote !== undefined) fd.set("retentionLegalHoldNote", overrides.retentionLegalHoldNote);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockReset();
  userFindFirst.mockReset();
  projectFindFirst.mockReset();
  projectUpdate.mockReset();
  revalidateProducerOverview.mockReset();
  revalidateProjectMirrorCache.mockReset();
  projectFindFirst.mockImplementation(async ({ where }: { where: { id: string } }) => ({ id: where.id }));
});

describe("updateIntakeInternals", () => {
  it("redirects unauthenticated or non-producer users", async () => {
    const { updateIntakeInternals } = await import("./actions");
    authMock.mockResolvedValueOnce(null);
    await expect(updateIntakeInternals(form())).rejects.toThrow("redirect:/login?callbackUrl=/producer/inbox");

    authMock.mockResolvedValueOnce({ user: { id: "u1", globalRole: GlobalRole.DIRECTOR } });
    await expect(updateIntakeInternals(form())).rejects.toThrow("redirect:/login?callbackUrl=/producer/inbox");
  });

  it("redirects when project id is blank", async () => {
    const { updateIntakeInternals } = await import("./actions");
    authMock.mockResolvedValueOnce(producerSession());
    projectFindFirst.mockReset();

    await expect(updateIntakeInternals(form({ projectId: "  " }))).rejects.toThrow("redirect:/producer/inbox");
  });

  it("redirects bad_assignee when id is set but user is not production-class", async () => {
    const { updateIntakeInternals } = await import("./actions");
    authMock.mockResolvedValueOnce(producerSession());
    userFindFirst.mockResolvedValueOnce(null);

    await expect(updateIntakeInternals(form({ projectId: "p_bad", assignedToUserId: "unknown" }))).rejects.toThrow(
      "redirect:/producer/inbox/p_bad?error=bad_assignee",
    );
    expect(userFindFirst).toHaveBeenCalledWith({
      where: {
        id: "unknown",
        globalRole: { in: [GlobalRole.PRODUCER, GlobalRole.ULS_ADMIN] },
        disabledAt: null,
      },
    });
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it("does not lookup assignee when field empty", async () => {
    const { updateIntakeInternals } = await import("./actions");
    authMock.mockResolvedValueOnce(producerSession());
    projectUpdate.mockResolvedValueOnce({});

    const fd = form({ projectId: "p_clear" });
    await expect(updateIntakeInternals(fd)).rejects.toThrow("redirect:/producer/inbox/p_clear?saved=1");
    expect(userFindFirst).not.toHaveBeenCalled();
    expect(projectUpdate).toHaveBeenCalledWith({
      where: { id: "p_clear" },
      data: expect.objectContaining({ assignedToUserId: null, retentionLegalHold: false }),
    });
  });

  it("redirects not_found when project is unknown or wrong status", async () => {
    const { updateIntakeInternals } = await import("./actions");
    authMock.mockResolvedValueOnce(producerSession());
    projectFindFirst.mockResolvedValueOnce(null);

    await expect(updateIntakeInternals(form({ projectId: "missing" }))).rejects.toThrow(
      "redirect:/producer/inbox?error=not_found",
    );
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it("redirects not_found when project update fails", async () => {
    const { updateIntakeInternals } = await import("./actions");
    authMock.mockResolvedValueOnce(producerSession());
    projectFindFirst.mockResolvedValueOnce({ id: "missing" });
    projectUpdate.mockRejectedValueOnce(new Error("missing row"));

    await expect(updateIntakeInternals(form({ projectId: "missing" }))).rejects.toThrow(
      "redirect:/producer/inbox?error=not_found",
    );
  });

  it("parses YYYY-MM-DD conclusion to UTC noon and saves internal fields", async () => {
    const { updateIntakeInternals } = await import("./actions");
    authMock.mockResolvedValueOnce(producerSession(GlobalRole.ULS_ADMIN));
    projectFindFirst.mockResolvedValueOnce({ id: "p_full" });
    projectUpdate.mockResolvedValueOnce({});
    userFindFirst.mockResolvedValueOnce({ id: "assignee1" });

    const fd = form({
      projectId: "p_full",
      internalNotes: "VIP client",
      eventConclusionAt: "2026-04-15",
    });
    fd.set("assignedToUserId", "assignee1");

    await expect(updateIntakeInternals(fd)).rejects.toThrow("redirect:/producer/inbox/p_full?saved=1");

    expect(projectUpdate).toHaveBeenCalledWith({
      where: { id: "p_full" },
      data: {
        internalNotes: "VIP client",
        assignedToUserId: "assignee1",
        eventConclusionAt: new Date(Date.UTC(2026, 3, 15, 12, 0, 0)),
        retentionLegalHold: false,
        retentionLegalHoldNote: null,
      },
    });
    expect(revalidateProducerOverview).toHaveBeenCalled();
    expect(revalidateProjectMirrorCache).toHaveBeenCalledWith("p_full");
  });

  it("stores null conclusion for malformed or empty date", async () => {
    const { updateIntakeInternals } = await import("./actions");
    authMock.mockResolvedValueOnce(producerSession());
    projectUpdate.mockResolvedValueOnce({});

    const fd = form({ eventConclusionAt: "April 2026" });
    await expect(updateIntakeInternals(fd)).rejects.toThrow("saved=1");
    expect((projectUpdate.mock.calls[0][0] as { data: { eventConclusionAt: unknown } }).data.eventConclusionAt).toBe(
      null,
    );
  });

  it("clears conclusion when ISO-looking token fails numeric window checks", async () => {
    const { updateIntakeInternals } = await import("./actions");
    const datesLeavingConclusionNull = ["1969-12-31", "2028-13-05", "2028-06-00", "not-even-near"];

    for (const eventConclusionAt of datesLeavingConclusionNull) {
      authMock.mockResolvedValueOnce(producerSession(GlobalRole.PRODUCER));
      projectUpdate.mockReset();
      projectUpdate.mockResolvedValueOnce({});

      await expect(
        updateIntakeInternals(form({ projectId: `p_${eventConclusionAt.slice(0, 4)}`, eventConclusionAt })),
      ).rejects.toThrow("saved=1");

      expect(
        (projectUpdate.mock.calls[0][0] as { data: { eventConclusionAt: unknown } }).data.eventConclusionAt,
      ).toBeNull();
    }
  });

  it("persists retention legal hold and trimmed note when checkbox on", async () => {
    const { updateIntakeInternals } = await import("./actions");
    authMock.mockResolvedValueOnce(producerSession());
    projectUpdate.mockResolvedValueOnce({});

    const fd = form({
      projectId: "p_hold",
      retentionLegalHold: "on",
      retentionLegalHoldNote: "  Litigation  ",
    });

    await expect(updateIntakeInternals(fd)).rejects.toThrow("redirect:/producer/inbox/p_hold?saved=1");

    expect(projectUpdate).toHaveBeenCalledWith({
      where: { id: "p_hold" },
      data: expect.objectContaining({
        retentionLegalHold: true,
        retentionLegalHoldNote: "Litigation",
      }),
    });
  });
});
