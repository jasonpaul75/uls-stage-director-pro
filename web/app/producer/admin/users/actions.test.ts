import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalRole } from "@prisma/client";

const authMock = vi.fn();

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const userFindUnique = vi.fn();
const userUpdate = vi.fn();
const projectFindMany = vi.fn();
const projectUpdateMany = vi.fn();
const staffEventQuestionnaireDeleteMany = vi.fn();
const projectStaffAssignmentFindMany = vi.fn();
const projectStaffAssignmentDeleteMany = vi.fn();
const staffAvailabilityDayDeleteMany = vi.fn();
const $transaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: userFindUnique, update: userUpdate, create: vi.fn() },
    project: { findMany: projectFindMany, updateMany: projectUpdateMany },
    staffEventQuestionnaire: { deleteMany: staffEventQuestionnaireDeleteMany },
    projectStaffAssignment: {
      findMany: projectStaffAssignmentFindMany,
      deleteMany: projectStaffAssignmentDeleteMany,
    },
    staffAvailabilityDay: { deleteMany: staffAvailabilityDayDeleteMany },
    $transaction,
  },
}));

const revalidatePath = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

const revalidateProducerOverview = vi.fn();
const revalidateProjectMirrorCache = vi.fn();

vi.mock("@/lib/revalidate-project-mirror-cache", () => ({
  revalidateProducerOverview,
  revalidateProjectMirrorCache,
}));

describe("setStaffUserDisabled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockReset();
    userFindUnique.mockReset();
    userUpdate.mockReset();
    projectFindMany.mockReset();
    projectUpdateMany.mockReset();
    staffEventQuestionnaireDeleteMany.mockReset();
    projectStaffAssignmentFindMany.mockReset();
    projectStaffAssignmentDeleteMany.mockReset();
    staffAvailabilityDayDeleteMany.mockReset();
    $transaction.mockReset();
    $transaction.mockImplementation(async (batch: unknown[]) =>
      Promise.all(batch as Promise<unknown>[]),
    );
    revalidateProducerOverview.mockReset();
    revalidateProjectMirrorCache.mockReset();
    revalidatePath.mockReset();
    staffEventQuestionnaireDeleteMany.mockResolvedValue({ count: 0 });
    projectStaffAssignmentDeleteMany.mockResolvedValue({ count: 0 });
    staffAvailabilityDayDeleteMany.mockResolvedValue({ count: 0 });
  });

  function fd(userId: string, disabled: "0" | "1") {
    const formData = new FormData();
    formData.set("userId", userId);
    formData.set("disabled", disabled);
    return formData;
  }

  it("redirects non-admin to /producer", async () => {
    const { setStaffUserDisabled } = await import("./actions");
    authMock.mockResolvedValueOnce({ user: { id: "p1", globalRole: GlobalRole.PRODUCER } });
    await expect(setStaffUserDisabled(fd("other", "1"))).rejects.toThrow("redirect:/producer");
    expect(projectFindMany).not.toHaveBeenCalled();
  });

  it("disables account, clears crew rows + assigned intakes, and revalidates cache", async () => {
    const { setStaffUserDisabled } = await import("./actions");
    authMock.mockResolvedValueOnce({ user: { id: "admin1", globalRole: GlobalRole.ULS_ADMIN } });
    userFindUnique.mockResolvedValueOnce({ id: "u2" });
    projectFindMany.mockResolvedValueOnce([{ id: "proj_alpha" }, { id: "proj_beta" }]);
    projectStaffAssignmentFindMany.mockResolvedValueOnce([{ projectId: "crew_proj" }]);
    projectUpdateMany.mockResolvedValueOnce({ count: 2 });
    userUpdate.mockResolvedValueOnce({});

    await expect(setStaffUserDisabled(fd("u2", "1"))).rejects.toThrow("redirect:/producer/admin/users?saved=1");

    expect(projectFindMany).toHaveBeenCalledWith({
      where: { assignedToUserId: "u2" },
      select: { id: true },
    });
    expect(projectStaffAssignmentFindMany).toHaveBeenCalledWith({
      where: { staffUserId: "u2" },
      select: { projectId: true },
    });
    expect(staffEventQuestionnaireDeleteMany).toHaveBeenCalledWith({ where: { staffUserId: "u2" } });
    expect(projectStaffAssignmentDeleteMany).toHaveBeenCalledWith({ where: { staffUserId: "u2" } });
    expect(staffAvailabilityDayDeleteMany).toHaveBeenCalledWith({ where: { userId: "u2" } });
    expect(projectUpdateMany).toHaveBeenCalledWith({
      where: { assignedToUserId: "u2" },
      data: { assignedToUserId: null },
    });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "u2" },
      data: { disabledAt: expect.any(Date) },
    });
    expect($transaction).toHaveBeenCalledTimes(1);
    expect(($transaction.mock.calls[0][0] as unknown[]).length).toBe(5);
    expect(revalidateProducerOverview).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/staff");
    expect(revalidatePath).toHaveBeenCalledWith("/producer/inbox/crew_proj/crew");
    expect(revalidateProjectMirrorCache).toHaveBeenCalledWith("proj_alpha");
    expect(revalidateProjectMirrorCache).toHaveBeenCalledWith("proj_beta");
    expect(revalidateProjectMirrorCache).toHaveBeenCalledWith("crew_proj");
  });

  it("re-enables without touching project assignments", async () => {
    const { setStaffUserDisabled } = await import("./actions");
    authMock.mockResolvedValueOnce({ user: { id: "admin1", globalRole: GlobalRole.ULS_ADMIN } });
    userFindUnique.mockResolvedValueOnce({ id: "u3" });
    userUpdate.mockResolvedValueOnce({});

    await expect(setStaffUserDisabled(fd("u3", "0"))).rejects.toThrow("redirect:/producer/admin/users?saved=1");

    expect(projectFindMany).not.toHaveBeenCalled();
    expect($transaction).not.toHaveBeenCalled();
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "u3" },
      data: { disabledAt: null },
    });
    expect(revalidateProducerOverview).not.toHaveBeenCalled();
  });

  it("blocks disabling self", async () => {
    const { setStaffUserDisabled } = await import("./actions");
    authMock.mockResolvedValueOnce({ user: { id: "admin1", globalRole: GlobalRole.ULS_ADMIN } });

    await expect(setStaffUserDisabled(fd("admin1", "1"))).rejects.toThrow("redirect:/producer/admin/users?err=self");
    expect($transaction).not.toHaveBeenCalled();
  });
});
