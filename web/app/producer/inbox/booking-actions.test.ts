import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalRole, ProjectStatus } from "@prisma/client";

const authMock = vi.fn();

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const projectFindFirst = vi.fn();
const projectUpdate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findFirst: projectFindFirst,
      update: projectUpdate,
    },
  },
}));

const revalidateProjectMirrorCache = vi.fn();

vi.mock("@/lib/revalidate-project-mirror-cache", () => ({
  revalidateProjectMirrorCache,
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

function producerSession(role: GlobalRole.PRODUCER | GlobalRole.ULS_ADMIN = GlobalRole.PRODUCER) {
  return { user: { id: "producer1", globalRole: role } };
}

function bookingForm(projectId: string) {
  const fd = new FormData();
  fd.set("projectId", projectId);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockReset();
  projectFindFirst.mockReset();
  projectUpdate.mockReset();
});

describe("confirmBookingSecured", () => {
  it("requires producer-class session", async () => {
    const { confirmBookingSecured } = await import("./booking-actions");

    authMock.mockResolvedValueOnce(null);
    await expect(confirmBookingSecured(bookingForm("p1"))).rejects.toThrow(
      "redirect:/login?callbackUrl=/producer/inbox",
    );

    authMock.mockResolvedValueOnce({
      user: { id: "d1", globalRole: GlobalRole.DIRECTOR },
    });
    await expect(confirmBookingSecured(bookingForm("p1"))).rejects.toThrow(
      "redirect:/login?callbackUrl=/producer/inbox",
    );

    expect(projectFindFirst).not.toHaveBeenCalled();
  });

  it("rejects blank project id without querying", async () => {
    const { confirmBookingSecured } = await import("./booking-actions");
    authMock.mockResolvedValueOnce(producerSession(GlobalRole.PRODUCER));

    const fd = new FormData();
    fd.set("projectId", "  ");

    await expect(confirmBookingSecured(fd)).rejects.toThrow("redirect:/producer/inbox");
    expect(projectFindFirst).not.toHaveBeenCalled();
  });

  it("bounce when queued intake row not found by id + INTAKE_SUBMITTED", async () => {
    const { confirmBookingSecured } = await import("./booking-actions");
    authMock.mockResolvedValueOnce(producerSession(GlobalRole.ULS_ADMIN));
    projectFindFirst.mockResolvedValueOnce(null);

    await expect(confirmBookingSecured(bookingForm("missing"))).rejects.toThrow("redirect:/producer/inbox");
    expect(projectFindFirst).toHaveBeenCalledWith({
      where: { id: "missing", status: ProjectStatus.INTAKE_SUBMITTED },
      select: { id: true, bookingSecuredAt: true },
    });
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it("writes booking secured timestamp when unset and redirects with marker", async () => {
    const { confirmBookingSecured } = await import("./booking-actions");
    authMock.mockResolvedValueOnce(producerSession());
    projectFindFirst.mockResolvedValueOnce({ id: "p_new", bookingSecuredAt: null });
    projectUpdate.mockResolvedValueOnce({});

    const frozen = new Date("2028-06-01T12:00:00.000Z");
    vi.setSystemTime(frozen);

    try {
      await expect(confirmBookingSecured(bookingForm("p_new"))).rejects.toThrow(
        "redirect:/producer/inbox/p_new?booking_confirmed=1",
      );
      expect(projectUpdate).toHaveBeenCalledWith({
        where: { id: "p_new" },
        data: { bookingSecuredAt: frozen },
      });
      expect(revalidateProjectMirrorCache).toHaveBeenCalledWith("p_new");
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves existing bookingSecuredAt when already stamped", async () => {
    const { confirmBookingSecured } = await import("./booking-actions");
    authMock.mockResolvedValueOnce(producerSession());
    const prior = new Date("2027-03-03T03:03:03.003Z");
    projectFindFirst.mockResolvedValueOnce({ id: "p_old", bookingSecuredAt: prior });
    projectUpdate.mockResolvedValueOnce({});

    await expect(confirmBookingSecured(bookingForm("p_old"))).rejects.toThrow(
      "redirect:/producer/inbox/p_old?booking_confirmed=1",
    );

    expect(projectUpdate).toHaveBeenCalledWith({
      where: { id: "p_old" },
      data: { bookingSecuredAt: prior },
    });
  });
});
