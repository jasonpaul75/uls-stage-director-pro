import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalRole } from "@prisma/client";

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const db = vi.hoisted(() => ({
  projectFindFirst: vi.fn(),
  envelopeCreate: vi.fn(),
  envelopeDeleteMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findFirst: db.projectFindFirst,
    },
    projectDocuSignEnvelope: {
      create: db.envelopeCreate,
      deleteMany: db.envelopeDeleteMany,
    },
  },
}));

const refreshLinkedEnvelopeFromLatestInbound = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/docusign-webhook-persist", () => ({
  refreshLinkedEnvelopeFromLatestInbound: (...a: unknown[]) => refreshLinkedEnvelopeFromLatestInbound(...a),
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

const VALID_ENVELOPE = "12345678-abcd-4ef0-8123-456789abcdef";
const SAMPLE_RFC_PLACEHOLDER = "550e8400-e29b-41d4-a716-446655440000";

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockReset();
  db.projectFindFirst.mockReset();
  db.envelopeCreate.mockReset();
  db.envelopeDeleteMany.mockReset();
  refreshLinkedEnvelopeFromLatestInbound.mockReset();
  revalidateProjectMirrorCache.mockReset();
});

function producerSession() {
  return { user: { id: "prod1", globalRole: GlobalRole.PRODUCER as const } };
}

function linkForm(
  projectId: string,
  envelopeId: string,
  extras: Partial<{ subject: string; producerNote: string }> = {},
) {
  const fd = new FormData();
  fd.set("projectId", projectId);
  fd.set("envelopeId", envelopeId);
  if (extras.subject != null) fd.set("subject", extras.subject);
  if (extras.producerNote != null) fd.set("producerNote", extras.producerNote);
  return fd;
}

describe("linkDocuSignEnvelopeToProject", () => {
  it("redirects to login with project-scoped callback when not a producer session", async () => {
    const { linkDocuSignEnvelopeToProject } = await import("./docusign-actions");
    authMock.mockResolvedValueOnce(null);

    await expect(linkDocuSignEnvelopeToProject(linkForm("p_z", VALID_ENVELOPE))).rejects.toThrow(
      "redirect:/login?callbackUrl=/producer/inbox/p_z",
    );
  });

  it("blocks the RFC documentation sample envelope id", async () => {
    const { linkDocuSignEnvelopeToProject } = await import("./docusign-actions");
    authMock.mockResolvedValueOnce(producerSession());

    await expect(
      linkDocuSignEnvelopeToProject(linkForm("p_doc", SAMPLE_RFC_PLACEHOLDER)),
    ).rejects.toThrow("redirect:/producer/inbox/p_doc?docusign_err=placeholder_envelope");
    expect(db.projectFindFirst).not.toHaveBeenCalled();
  });

  it("redirects on malformed envelope GUID", async () => {
    const { linkDocuSignEnvelopeToProject } = await import("./docusign-actions");
    authMock.mockResolvedValueOnce(producerSession());

    await expect(linkDocuSignEnvelopeToProject(linkForm("p1", "not-a-guid"))).rejects.toThrow(
      "redirect:/producer/inbox/p1?docusign_err=bad_envelope",
    );
  });

  it("redirects when project is not on the intake queue", async () => {
    const { linkDocuSignEnvelopeToProject } = await import("./docusign-actions");
    authMock.mockResolvedValueOnce(producerSession());
    db.projectFindFirst.mockResolvedValueOnce(null);

    await expect(linkDocuSignEnvelopeToProject(linkForm("gone", VALID_ENVELOPE))).rejects.toThrow(
      "redirect:/producer/inbox?docusign_err=invalid_project",
    );
    expect(db.envelopeCreate).not.toHaveBeenCalled();
  });

  it("creates envelope row, refreshes from inbound backlog, revalidates, redirects", async () => {
    const { linkDocuSignEnvelopeToProject } = await import("./docusign-actions");
    authMock.mockResolvedValueOnce(producerSession());
    db.projectFindFirst.mockResolvedValueOnce({ id: "p_ok" });
    db.envelopeCreate.mockResolvedValueOnce({ id: "row1" });

    const fd = linkForm("p_ok", VALID_ENVELOPE.toUpperCase(), {
      subject: "Service agreement",
      producerNote: "Note",
    });

    await expect(linkDocuSignEnvelopeToProject(fd)).rejects.toThrow(
      "redirect:/producer/inbox/p_ok?docusign_linked=1",
    );

    expect(db.envelopeCreate).toHaveBeenCalledWith({
      data: {
        projectId: "p_ok",
        envelopeId: VALID_ENVELOPE,
        subject: "Service agreement",
        producerNote: "Note",
        status: "unknown",
      },
    });
    expect(refreshLinkedEnvelopeFromLatestInbound).toHaveBeenCalledWith(VALID_ENVELOPE);
    expect(revalidateProjectMirrorCache).toHaveBeenCalledWith("p_ok");
  });

  it("maps duplicate envelope unique constraint to a friendly redirect", async () => {
    const { linkDocuSignEnvelopeToProject } = await import("./docusign-actions");
    authMock.mockResolvedValueOnce(producerSession());
    db.projectFindFirst.mockResolvedValueOnce({ id: "p_dup" });
    db.envelopeCreate.mockRejectedValueOnce({ code: "P2002" });

    await expect(linkDocuSignEnvelopeToProject(linkForm("p_dup", VALID_ENVELOPE))).rejects.toThrow(
      "redirect:/producer/inbox/p_dup?docusign_err=envelope_already_linked",
    );
  });
});

describe("unlinkDocuSignEnvelopeFromProject", () => {
  it("requires producer auth before deleting", async () => {
    const { unlinkDocuSignEnvelopeFromProject } = await import("./docusign-actions");
    authMock.mockResolvedValueOnce(null);

    const fd = new FormData();
    fd.set("projectId", "p_u");
    fd.set("rowId", "r1");

    await expect(unlinkDocuSignEnvelopeFromProject(fd)).rejects.toThrow(
      "redirect:/login?callbackUrl=/producer/inbox/p_u",
    );
    expect(db.envelopeDeleteMany).not.toHaveBeenCalled();
  });

  it("scopes deleteMany to envelope row + project id", async () => {
    const { unlinkDocuSignEnvelopeFromProject } = await import("./docusign-actions");
    authMock.mockResolvedValueOnce(producerSession());

    const fd = new FormData();
    fd.set("projectId", "p_del");
    fd.set("rowId", "env_row_9");

    await expect(unlinkDocuSignEnvelopeFromProject(fd)).rejects.toThrow(
      "redirect:/producer/inbox/p_del?docusign_removed=1",
    );

    expect(db.envelopeDeleteMany).toHaveBeenCalledWith({
      where: { id: "env_row_9", projectId: "p_del" },
    });
    expect(revalidateProjectMirrorCache).toHaveBeenCalledWith("p_del");
  });
});
