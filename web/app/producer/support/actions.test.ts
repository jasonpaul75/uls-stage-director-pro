import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalRole, SupportTicketStatus } from "@prisma/client";

const authMock = vi.fn();

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const ticketFindUnique = vi.fn();
const ticketUpdate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    supportTicket: {
      findUnique: ticketFindUnique,
      update: ticketUpdate,
    },
  },
}));

const revalidateProducerSupportTicketDetail = vi.fn();
const revalidateSupportQueues = vi.fn();
const revalidateProducerOverview = vi.fn();
const revalidateProjectMirrorCache = vi.fn();

vi.mock("@/lib/revalidate-project-mirror-cache", () => ({
  revalidateProducerSupportTicketDetail,
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

function producerSession(role: GlobalRole.PRODUCER | GlobalRole.ULS_ADMIN = GlobalRole.PRODUCER, id = "prod1") {
  return { user: { id, globalRole: role } };
}

function replyForm(ticketId: string, producerReply: string) {
  const fd = new FormData();
  fd.set("ticketId", ticketId);
  fd.set("producerReply", producerReply);
  return fd;
}

function resolveForm(ticketId: string) {
  const fd = new FormData();
  fd.set("ticketId", ticketId);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockReset();
  ticketFindUnique.mockReset();
  ticketUpdate.mockReset();
});

describe("saveProducerSupportReply", () => {
  it("redirects unauthenticated callers to producer support login gate", async () => {
    const { saveProducerSupportReply } = await import("./actions");
    authMock.mockResolvedValueOnce(null);

    await expect(saveProducerSupportReply(replyForm("t1", "Hi"))).rejects.toThrow(
      "redirect:/login?callbackUrl=/producer/support",
    );
    expect(ticketFindUnique).not.toHaveBeenCalled();
  });

  it("redirects director persona away from producer flow", async () => {
    const { saveProducerSupportReply } = await import("./actions");
    authMock.mockResolvedValueOnce({ user: { id: "d1", globalRole: GlobalRole.DIRECTOR } });

    await expect(saveProducerSupportReply(replyForm("t1", "Hi"))).rejects.toThrow(
      "redirect:/login?callbackUrl=/producer/support",
    );
    expect(ticketFindUnique).not.toHaveBeenCalled();
  });

  it("redirects with err=required when ticket id blank", async () => {
    const { saveProducerSupportReply } = await import("./actions");
    authMock.mockResolvedValueOnce(producerSession());

    const fd = new FormData();
    fd.set("ticketId", "  ");
    fd.set("producerReply", "  text ");

    await expect(saveProducerSupportReply(fd)).rejects.toThrow(
      "redirect:/producer/support?err=required",
    );
    expect(ticketFindUnique).not.toHaveBeenCalled();
  });

  it("redirects ticket detail err=required when reply blank while ticket present", async () => {
    const { saveProducerSupportReply } = await import("./actions");
    authMock.mockResolvedValueOnce(producerSession(GlobalRole.PRODUCER));

    await expect(saveProducerSupportReply(replyForm("t_active", "\t\r\n"))).rejects.toThrow(
      "redirect:/producer/support/t_active?err=required",
    );
    expect(ticketFindUnique).not.toHaveBeenCalled();
  });

  it("redirects inbox list when ticket row missing", async () => {
    const { saveProducerSupportReply } = await import("./actions");
    authMock.mockResolvedValueOnce(producerSession(GlobalRole.ULS_ADMIN, "adm1"));
    ticketFindUnique.mockResolvedValueOnce(null);

    await expect(saveProducerSupportReply(replyForm("t_missing", "ok"))).rejects.toThrow(
      "redirect:/producer/support",
    );
    expect(ticketFindUnique).toHaveBeenCalledWith({
      where: { id: "t_missing" },
      select: { id: true, projectId: true },
    });
    expect(ticketUpdate).not.toHaveBeenCalled();
  });

  it("persists trimmed reply capped at 8k chars, revalidates, then redirects with saved marker", async () => {
    const { saveProducerSupportReply } = await import("./actions");
    authMock.mockResolvedValueOnce(producerSession());
    ticketFindUnique.mockResolvedValueOnce({ id: "t99", projectId: "proj_m" });

    const longReply = `${"x".repeat(7995)} trimmed tail `;
    const expectedSlice = longReply.trim().slice(0, 8000);

    ticketUpdate.mockResolvedValueOnce({});
    await expect(saveProducerSupportReply(replyForm("t99", longReply))).rejects.toThrow(
      "redirect:/producer/support/t99?saved=1",
    );

    expect(expectedSlice.length).toBe(8000);

    expect(ticketUpdate).toHaveBeenCalledWith({
      where: { id: "t99" },
      data: { producerReply: expectedSlice },
    });
    expect(revalidateProducerSupportTicketDetail).toHaveBeenCalledWith("t99");
    expect(revalidateSupportQueues).toHaveBeenCalledWith("proj_m");
    expect(revalidateProducerOverview).toHaveBeenCalled();
    expect(revalidateProjectMirrorCache).toHaveBeenCalledWith("proj_m");
  });
});

describe("resolveSupportTicketProducer", () => {
  it("gates unauthenticated and non-production roles identically", async () => {
    const { resolveSupportTicketProducer } = await import("./actions");
    authMock.mockResolvedValueOnce(null);
    await expect(resolveSupportTicketProducer(resolveForm("tx"))).rejects.toThrow(
      "redirect:/login?callbackUrl=/producer/support",
    );

    authMock.mockResolvedValueOnce({ user: { id: "o1", globalRole: GlobalRole.DIRECTOR } });
    await expect(resolveSupportTicketProducer(resolveForm("tx"))).rejects.toThrow(
      "redirect:/login?callbackUrl=/producer/support",
    );
    expect(ticketFindUnique).not.toHaveBeenCalled();
  });

  it("requires ticket id token", async () => {
    const { resolveSupportTicketProducer } = await import("./actions");
    authMock.mockResolvedValueOnce(producerSession());

    const fd = new FormData();
    fd.set("ticketId", "   ");

    await expect(resolveSupportTicketProducer(fd)).rejects.toThrow(
      "redirect:/producer/support",
    );
    expect(ticketFindUnique).not.toHaveBeenCalled();
  });

  it("bounce when ticket absent", async () => {
    const { resolveSupportTicketProducer } = await import("./actions");
    authMock.mockResolvedValueOnce(producerSession(GlobalRole.PRODUCER));
    ticketFindUnique.mockResolvedValueOnce(null);

    await expect(resolveSupportTicketProducer(resolveForm("gone"))).rejects.toThrow(
      "redirect:/producer/support",
    );
    expect(ticketUpdate).not.toHaveBeenCalled();
  });

  it("sets RESOLVED and resolvedAt, mirrors cache refresh", async () => {
    const { resolveSupportTicketProducer } = await import("./actions");
    authMock.mockResolvedValueOnce(producerSession(GlobalRole.ULS_ADMIN, "adm2"));
    ticketFindUnique.mockResolvedValueOnce({ id: "t_res", projectId: "proj_r" });

    ticketUpdate.mockResolvedValueOnce({});
    await expect(resolveSupportTicketProducer(resolveForm("t_res"))).rejects.toThrow(
      "redirect:/producer/support/t_res?resolved=1",
    );

    expect(ticketUpdate).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        where: { id: "t_res" },
        data: expect.objectContaining({
          status: SupportTicketStatus.RESOLVED,
        }),
      }),
    );
    const data = ticketUpdate.mock.calls[0]?.[0]?.data as { resolvedAt: Date };
    expect(data.resolvedAt).toBeInstanceOf(Date);

    expect(revalidateProducerSupportTicketDetail).toHaveBeenCalledWith("t_res");
    expect(revalidateSupportQueues).toHaveBeenCalledWith("proj_r");
    expect(revalidateProducerOverview).toHaveBeenCalled();
    expect(revalidateProjectMirrorCache).toHaveBeenCalledWith("proj_r");
  });
});
