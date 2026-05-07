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
  return { user: { id: "p1", globalRole: role } };
}

function proposalForm(
  projectId: string,
  parts: Partial<{
    proposalPricingNotes: string;
    proposalTechRiderNotes: string;
    proposalCrewNotes: string;
    proposalDirectorVisible: boolean;
    contractsDirectorVisible: boolean;
    stripeBillingDirectorVisible: boolean;
  }> = {},
) {
  const fd = new FormData();
  fd.set("projectId", projectId);
  fd.set("proposalPricingNotes", parts.proposalPricingNotes ?? "");
  fd.set("proposalTechRiderNotes", parts.proposalTechRiderNotes ?? "");
  fd.set("proposalCrewNotes", parts.proposalCrewNotes ?? "");
  if (parts.proposalDirectorVisible) fd.set("proposalDirectorVisible", "on");
  if (parts.contractsDirectorVisible) fd.set("contractsDirectorVisible", "on");
  if (parts.stripeBillingDirectorVisible) fd.set("stripeBillingDirectorVisible", "on");
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockReset();
  projectFindFirst.mockReset();
  projectUpdate.mockReset();
});

describe("saveProposalDraft", () => {
  it("requires producer-class authentication", async () => {
    const { saveProposalDraft } = await import("./proposal-actions");

    authMock.mockResolvedValueOnce(null);
    await expect(saveProposalDraft(proposalForm("x"))).rejects.toThrow(
      "redirect:/login?callbackUrl=/producer/inbox",
    );

    authMock.mockResolvedValueOnce({ user: { id: "u1", globalRole: GlobalRole.DIRECTOR } });
    await expect(saveProposalDraft(proposalForm("x"))).rejects.toThrow(
      "redirect:/login?callbackUrl=/producer/inbox",
    );
    expect(projectFindFirst).not.toHaveBeenCalled();
  });

  it("rejects blank project id", async () => {
    const { saveProposalDraft } = await import("./proposal-actions");
    authMock.mockResolvedValueOnce(producerSession());

    const fd = new FormData();
    fd.set("projectId", "  ");

    await expect(saveProposalDraft(fd)).rejects.toThrow("redirect:/producer/inbox");
    expect(projectFindFirst).not.toHaveBeenCalled();
  });

  it("rejects when queued intake row not found", async () => {
    const { saveProposalDraft } = await import("./proposal-actions");
    authMock.mockResolvedValueOnce(producerSession(GlobalRole.PRODUCER));
    projectFindFirst.mockResolvedValueOnce(null);

    await expect(saveProposalDraft(proposalForm("gone"))).rejects.toThrow("redirect:/producer/inbox");
    expect(projectFindFirst).toHaveBeenCalledWith({
      where: { id: "gone", status: ProjectStatus.INTAKE_SUBMITTED },
      select: { id: true },
    });
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it("nulls whitespace-only note fields, honors checkboxes, redirects with marker", async () => {
    const { saveProposalDraft } = await import("./proposal-actions");
    authMock.mockResolvedValueOnce(producerSession(GlobalRole.ULS_ADMIN));
    projectFindFirst.mockResolvedValueOnce({ id: "p_save" });
    projectUpdate.mockResolvedValueOnce({});

    await expect(
      saveProposalDraft(
        proposalForm("p_save", {
          proposalPricingNotes: " \n\t ",
          proposalTechRiderNotes: "  tiers  ",
          proposalCrewNotes: "",
          proposalDirectorVisible: true,
          contractsDirectorVisible: false,
          stripeBillingDirectorVisible: true,
        }),
      ),
    ).rejects.toThrow("redirect:/producer/inbox/p_save?proposal_saved=1");

    expect(projectUpdate).toHaveBeenCalledExactlyOnceWith({
      where: { id: "p_save" },
      data: {
        proposalPricingNotes: null,
        proposalTechRiderNotes: "  tiers  ",
        proposalCrewNotes: null,
        proposalDirectorVisible: true,
        contractsDirectorVisible: false,
        stripeBillingDirectorVisible: true,
      },
    });
    expect(revalidateProjectMirrorCache).toHaveBeenCalledWith("p_save");
  });
});
