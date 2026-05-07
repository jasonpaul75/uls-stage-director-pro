import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalRole, ProjectStatus } from "@prisma/client";

const authMock = vi.fn();

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const projectFindFirst = vi.fn();
const projectUpdate = vi.fn();

const flagFindFirst = vi.fn();
const flagFindUnique = vi.fn();
const flagCreate = vi.fn();
const flagDelete = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findFirst: projectFindFirst,
      update: projectUpdate,
    },
    projectShowFlag: {
      findFirst: flagFindFirst,
      findUnique: flagFindUnique,
      create: flagCreate,
      delete: flagDelete,
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

function producerSession(role: GlobalRole.PRODUCER | GlobalRole.ULS_ADMIN = GlobalRole.PRODUCER, id = "prod_ui") {
  return { user: { id, globalRole: role } };
}

function intakeProjectQueued() {
  projectFindFirst.mockResolvedValueOnce({ id: "p_ok" });
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockReset();
  projectFindFirst.mockReset();
  projectUpdate.mockReset();
  flagFindFirst.mockReset();
  flagFindUnique.mockReset();
  flagCreate.mockReset();
  flagDelete.mockReset();
});

describe("addShowDayFlag", () => {
  it("enforces inbox login gate + rejects director callers", async () => {
    const { addShowDayFlag } = await import("./show-day-flag-actions");
    authMock.mockResolvedValueOnce(null);
    await expect(
      addShowDayFlag(flagForm({ projectId: "p", body: "b" })),
    ).rejects.toThrow("redirect:/login?callbackUrl=/producer/inbox");

    authMock.mockResolvedValueOnce({ user: { id: "dx", globalRole: GlobalRole.DIRECTOR } });
    await expect(
      addShowDayFlag(flagForm({ projectId: "p", body: "b" })),
    ).rejects.toThrow("redirect:/login?callbackUrl=/producer/inbox");

    expect(projectFindFirst).not.toHaveBeenCalled();
  });

  it("requires project id when body absent", async () => {
    const { addShowDayFlag } = await import("./show-day-flag-actions");
    authMock.mockResolvedValueOnce(producerSession());
    await expect(addShowDayFlag(flagForm({ body: "" }))).rejects.toThrow("redirect:/producer/inbox");
    expect(projectFindFirst).not.toHaveBeenCalled();
  });

  it("reports required when project id exists but flag body trimmed empty", async () => {
    const { addShowDayFlag } = await import("./show-day-flag-actions");
    authMock.mockResolvedValueOnce(producerSession(GlobalRole.PRODUCER));

    await expect(addShowDayFlag(flagForm({ projectId: "p_miss", body: "   \t\r" }))).rejects.toThrow(
      "redirect:/producer/inbox/p_miss/event?flag_err=required",
    );
    expect(projectFindFirst).not.toHaveBeenCalled();
  });

  it("drops add when intake project no longer qualifies", async () => {
    const { addShowDayFlag } = await import("./show-day-flag-actions");
    authMock.mockResolvedValueOnce(producerSession(GlobalRole.ULS_ADMIN));
    projectFindFirst.mockResolvedValueOnce(null);

    await expect(addShowDayFlag(flagForm({ projectId: "gone", body: "x" }))).rejects.toThrow(
      "redirect:/producer/inbox",
    );
    expect(projectFindFirst).toHaveBeenCalledWith({
      where: { id: "gone", status: ProjectStatus.INTAKE_SUBMITTED },
      select: { id: true },
    });
    expect(flagCreate).not.toHaveBeenCalled();
  });

  it("starts sortOrder at zero with no predecessor rows", async () => {
    const { addShowDayFlag } = await import("./show-day-flag-actions");
    authMock.mockResolvedValueOnce(producerSession());
    intakeProjectQueued();
    flagFindFirst.mockResolvedValueOnce(null);
    flagCreate.mockResolvedValueOnce({});

    await expect(addShowDayFlag(flagForm({ projectId: "p_ok", body: "  First cue  " }))).rejects.toThrow(
      "redirect:/producer/inbox/p_ok/event?flag_added=1",
    );

    expect(flagCreate).toHaveBeenCalledExactlyOnceWith({
      data: { projectId: "p_ok", body: "First cue", sortOrder: 0 },
    });
    expect(revalidateProjectMirrorCache).toHaveBeenCalledWith("p_ok");
  });

  it("increments max sortOrder for append ordering", async () => {
    const { addShowDayFlag } = await import("./show-day-flag-actions");
    authMock.mockResolvedValueOnce(producerSession(GlobalRole.PRODUCER));

    intakeProjectQueued();

    flagFindFirst.mockResolvedValueOnce({ sortOrder: 42 });
    flagCreate.mockResolvedValueOnce({});

    await expect(
      addShowDayFlag(flagForm({ projectId: "p_ok", body: `${"long".repeat(600)}xxx` })),
    ).rejects.toThrow("redirect:/producer/inbox/p_ok/event?flag_added=1");

    expect(flagCreate.mock.calls[0]?.[0].data.body?.length).toBe(2000);
    expect(flagCreate.mock.calls[0]?.[0].data.sortOrder).toBe(43);
  });
});

describe("deleteShowDayFlag", () => {
  it("rejects absent flag token", async () => {
    authMock.mockResolvedValueOnce(producerSession(GlobalRole.PRODUCER));
    await expect(deleteShapeForm("   ")).rejects.toThrow("redirect:/producer/inbox");
    expect(flagFindUnique).not.toHaveBeenCalled();
  });

  it("ignores orphaned or non-intake project rows", async () => {
    authMock.mockResolvedValueOnce(producerSession(GlobalRole.ULS_ADMIN));

    flagFindUnique.mockResolvedValueOnce(null);
    await expect(deleteShapeForm("fid")).rejects.toThrow("redirect:/producer/inbox");
    expect(projectFindFirst).not.toHaveBeenCalled();

    authMock.mockResolvedValueOnce(producerSession(GlobalRole.ULS_ADMIN));
    flagFindUnique.mockResolvedValueOnce({ projectId: "lost" });
    projectFindFirst.mockResolvedValueOnce(null);
    await expect(deleteShapeForm("fid2")).rejects.toThrow("redirect:/producer/inbox");

    expect(flagDelete).not.toHaveBeenCalled();
  });

  it("hard-deletes queued flag and revalidates mirror", async () => {
    authMock.mockResolvedValueOnce(producerSession(GlobalRole.PRODUCER));

    flagFindUnique.mockResolvedValueOnce({ projectId: "proj_flags" });
    projectFindFirst.mockResolvedValueOnce({ id: "proj_flags" });

    flagDelete.mockResolvedValueOnce({});

    await expect(deleteShapeForm("flag_row")).rejects.toThrow(
      "redirect:/producer/inbox/proj_flags/event?flag_removed=1",
    );

    expect(flagDelete).toHaveBeenCalledWith({ where: { id: "flag_row" } });
    expect(revalidateProjectMirrorCache).toHaveBeenCalledWith("proj_flags");
  });
});

describe("saveShowDayFlagsVisibility", () => {
  it("gates same as mutations", async () => {
    const { saveShowDayFlagsVisibility } = await import("./show-day-flag-actions");
    authMock.mockResolvedValueOnce(null);
    await expect(saveShowDayFlagsVisibility(visForm("p1", false))).rejects.toThrow(
      "redirect:/login?callbackUrl=/producer/inbox",
    );
    expect(projectFindFirst).not.toHaveBeenCalled();
  });

  it("persist checkbox on → true toggle", async () => {
    const { saveShowDayFlagsVisibility } = await import("./show-day-flag-actions");
    authMock.mockResolvedValueOnce(producerSession(GlobalRole.ULS_ADMIN));
    intakeProjectQueued();

    await expect(saveShowDayFlagsVisibility(visForm("p_ok", true))).rejects.toThrow(
      "redirect:/producer/inbox/p_ok/event?flags_visibility_saved=1",
    );

    expect(projectUpdate).toHaveBeenCalledExactlyOnceWith({
      where: { id: "p_ok" },
      data: { showDayFlagsDirectorVisible: true },
    });
    expect(revalidateProjectMirrorCache).toHaveBeenCalledWith("p_ok");
  });

  it("treat absent checkbox flag as off", async () => {
    const { saveShowDayFlagsVisibility } = await import("./show-day-flag-actions");
    authMock.mockResolvedValueOnce(producerSession());
    intakeProjectQueued();

    const fd = new FormData();
    fd.set("projectId", "p_ok");

    await expect(saveShowDayFlagsVisibility(fd)).rejects.toThrow(
      "redirect:/producer/inbox/p_ok/event?flags_visibility_saved=1",
    );

    expect(projectUpdate.mock.calls[0]?.[0].data).toEqual({ showDayFlagsDirectorVisible: false });
  });
});

function flagForm(parts: { projectId?: string; body: string }) {
  const fd = new FormData();
  if (parts.projectId !== undefined) fd.set("projectId", parts.projectId);
  fd.set("body", parts.body);
  return fd;
}

async function deleteShapeForm(flagId: string) {
  const { deleteShowDayFlag } = await import("./show-day-flag-actions");
  const fd = new FormData();
  fd.set("flagId", flagId);
  return deleteShowDayFlag(fd);
}

function visForm(projectId: string, on: boolean) {
  const fd = new FormData();
  fd.set("projectId", projectId);
  if (on) fd.set("showDayFlagsDirectorVisible", "on");
  return fd;
}
