import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalRole } from "@prisma/client";

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const findFirstMember = vi.fn();
const findUniqueProject = vi.fn();
const createTicket = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectMember: { findFirst: findFirstMember },
    project: { findUnique: findUniqueProject },
    supportTicket: { create: createTicket },
  },
}));

const revalidateSupportQueues = vi.fn();
const revalidateProducerOverview = vi.fn();
const revalidateProjectMirrorCache = vi.fn();

vi.mock("@/lib/revalidate-project-mirror-cache", () => ({
  revalidateSupportQueues,
  revalidateProducerOverview,
  revalidateProjectMirrorCache,
}));

const redirectMock = vi.fn((url: string) => {
  throw new Error(`redirect:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

function formData(projectId = "proj_1", subject = "Subject", body = "Body text") {
  const fd = new FormData();
  fd.set("projectId", projectId);
  fd.set("subject", subject);
  fd.set("body", body);
  return fd;
}

describe("createSupportTicketForProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to login when there is no session", async () => {
    const { createSupportTicketForProject } = await import("./support-ticket-actions");
    authMock.mockResolvedValueOnce(null);

    await expect(createSupportTicketForProject(formData())).rejects.toThrow("redirect:/login?callbackUrl=/portal");
  });

  it("redirects non-director non-admin users to portal home", async () => {
    const { createSupportTicketForProject } = await import("./support-ticket-actions");
    authMock.mockResolvedValueOnce({
      user: { id: "u1", globalRole: GlobalRole.PRODUCER },
    });

    await expect(createSupportTicketForProject(formData())).rejects.toThrow("redirect:/portal");
    expect(findFirstMember).not.toHaveBeenCalled();
    expect(createTicket).not.toHaveBeenCalled();
  });

  it("redirects directors without membership (fail closed)", async () => {
    const { createSupportTicketForProject } = await import("./support-ticket-actions");
    authMock.mockResolvedValueOnce({
      user: { id: "dir1", globalRole: GlobalRole.DIRECTOR },
    });
    findFirstMember.mockResolvedValueOnce(null);

    await expect(createSupportTicketForProject(formData())).rejects.toThrow("redirect:/portal?access_ended=1");
    expect(createTicket).not.toHaveBeenCalled();
  });

  it("redirects directors when portal access is past the conclusion window", async () => {
    const { createSupportTicketForProject } = await import("./support-ticket-actions");
    authMock.mockResolvedValueOnce({
      user: { id: "dir1", globalRole: GlobalRole.DIRECTOR },
    });
    const oldConclusion = new Date("2020-01-01T12:00:00Z");
    findFirstMember.mockResolvedValueOnce({
      project: { eventConclusionAt: oldConclusion },
    });

    await expect(createSupportTicketForProject(formData())).rejects.toThrow("redirect:/portal?access_ended=1");
    expect(createTicket).not.toHaveBeenCalled();
  });

  it("creates a ticket and revalidates when director membership and access are valid", async () => {
    const { createSupportTicketForProject } = await import("./support-ticket-actions");
    authMock.mockResolvedValueOnce({
      user: { id: "dir1", globalRole: GlobalRole.DIRECTOR },
    });
    findFirstMember.mockResolvedValueOnce({
      project: { eventConclusionAt: null },
    });
    createTicket.mockResolvedValueOnce({ id: "t1" });

    await expect(createSupportTicketForProject(formData("proj_ok", "S", "B"))).rejects.toThrow(
      "redirect:/portal/projects/proj_ok/support?created=1",
    );

    expect(createTicket).toHaveBeenCalledWith({
      data: {
        projectId: "proj_ok",
        createdByUserId: "dir1",
        subject: "S",
        body: "B",
      },
    });
    expect(revalidateSupportQueues).toHaveBeenCalledWith("proj_ok");
    expect(revalidateProducerOverview).toHaveBeenCalled();
    expect(revalidateProjectMirrorCache).toHaveBeenCalledWith("proj_ok");
  });

  it("redirects ULS_ADMIN when project id does not exist", async () => {
    const { createSupportTicketForProject } = await import("./support-ticket-actions");
    authMock.mockResolvedValueOnce({
      user: { id: "adm", globalRole: GlobalRole.ULS_ADMIN },
    });
    findUniqueProject.mockResolvedValueOnce(null);

    await expect(createSupportTicketForProject(formData("missing"))).rejects.toThrow("redirect:/portal");
    expect(findFirstMember).not.toHaveBeenCalled();
    expect(createTicket).not.toHaveBeenCalled();
  });

  it("creates a ticket for ULS_ADMIN when project exists", async () => {
    const { createSupportTicketForProject } = await import("./support-ticket-actions");
    authMock.mockResolvedValueOnce({
      user: { id: "adm", globalRole: GlobalRole.ULS_ADMIN },
    });
    findUniqueProject.mockResolvedValueOnce({ id: "proj_a" });
    createTicket.mockResolvedValueOnce({ id: "t2" });

    await expect(createSupportTicketForProject(formData("proj_a"))).rejects.toThrow(
      "redirect:/portal/projects/proj_a/support?created=1",
    );

    expect(findFirstMember).not.toHaveBeenCalled();
    expect(createTicket).toHaveBeenCalled();
  });

  it("treats missing globalRole as unauthenticated posture", async () => {
    const { createSupportTicketForProject } = await import("./support-ticket-actions");

    authMock.mockResolvedValueOnce({
      user: { id: "legacy_user" },
    });

    await expect(createSupportTicketForProject(formData("p1"))).rejects.toThrow(
      "redirect:/login?callbackUrl=/portal",
    );
    expect(createTicket).not.toHaveBeenCalled();
  });

  it("requires project id plus non-empty trimmed subject/body fields", async () => {
    const { createSupportTicketForProject } = await import("./support-ticket-actions");
    authMock.mockResolvedValueOnce({
      user: { id: "dir1", globalRole: GlobalRole.DIRECTOR },
    });

    await expect(createSupportTicketForProject(customForm("", "Subject", "Body"))).rejects.toThrow(
      "redirect:/portal/projects//support?err=required",
    );

    authMock.mockResolvedValueOnce({
      user: { id: "dir1", globalRole: GlobalRole.DIRECTOR },
    });
    await expect(createSupportTicketForProject(customForm("p1", "   ", "Body"))).rejects.toThrow(
      "redirect:/portal/projects/p1/support?err=required",
    );

    authMock.mockResolvedValueOnce({
      user: { id: "dir1", globalRole: GlobalRole.DIRECTOR },
    });
    await expect(createSupportTicketForProject(customForm("p1", "Ok", "\t\r\n"))).rejects.toThrow(
      "redirect:/portal/projects/p1/support?err=required",
    );

    expect(findFirstMember).not.toHaveBeenCalled();
    expect(createTicket).not.toHaveBeenCalled();
  });

  it("clips subject to 200 and body to 10000 glyphs before persistence", async () => {
    const { createSupportTicketForProject } = await import("./support-ticket-actions");
    authMock.mockResolvedValueOnce({
      user: { id: "adm", globalRole: GlobalRole.ULS_ADMIN },
    });

    findUniqueProject.mockResolvedValueOnce({ id: "clip_proj" });

    const longSubject = `  ${"S".repeat(220)}`;
    const trimmedSubject = longSubject.trim();
    expect(trimmedSubject.length).toBeGreaterThan(200);

    const longBody = `${"Paragraph.\n".repeat(1500)}x`;
    expect(longBody.trim().length).toBeGreaterThan(10_000);

    createTicket.mockResolvedValueOnce({ id: "t_clip" });

    await expect(
      createSupportTicketForProject(customForm("clip_proj", longSubject, longBody)),
    ).rejects.toThrow("redirect:/portal/projects/clip_proj/support?created=1");

    expect(createTicket).toHaveBeenCalledExactlyOnceWith({
      data: expect.objectContaining({
        projectId: "clip_proj",
        createdByUserId: "adm",
        subject: trimmedSubject.slice(0, 200),
        body: longBody.trim().slice(0, 10_000),
      }),
    });
  });
});

function customForm(projectId: string, subject: string, body: string) {
  const fd = new FormData();
  fd.set("projectId", projectId);
  fd.set("subject", subject);
  fd.set("body", body);
  return fd;
}
