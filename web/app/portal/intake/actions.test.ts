import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalRole, ProjectRole, ProjectStatus } from "@prisma/client";

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const notifyIntakeSubmitted = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email/send-intake-notification", () => ({
  notifyIntakeSubmitted: (...args: unknown[]) => notifyIntakeSubmitted(...args),
}));

const revalidateProducerOverview = vi.fn();
const revalidateProjectMirrorCache = vi.fn();
vi.mock("@/lib/revalidate-project-mirror-cache", () => ({
  revalidateProducerOverview,
  revalidateProjectMirrorCache,
}));

const redirectMock = vi.fn((url: string) => {
  throw new Error(`redirect:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

const $transaction = vi.fn();
const findUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction,
    project: { findUnique },
  },
}));

vi.mock("crypto", () => ({
  randomBytes: (size: number) => {
    const b = Buffer.alloc(size);
    for (let i = 0; i < size; i++) b[i] = i + 1;
    return b;
  },
}));

function formData(overrides: Partial<Record<string, string>> = {}) {
  const fd = new FormData();
  const defaults: Record<string, string> = {
    name: "Spring Gala",
    venue: "Arena",
    cityState: "Columbus, OH",
    categoryNotes: "Pageant",
    livestreamNotes: "",
    budgetNotes: "",
    additionalNotes: "",
    requestedEventStart: "",
    requestedEventEnd: "",
    contestantApprox: "50",
    ...overrides,
  };
  for (const [k, v] of Object.entries(defaults)) {
    fd.set(k, v);
  }
  return fd;
}

describe("submitIntakeRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockReset();
  });

  it("redirects to login when unauthenticated", async () => {
    const { submitIntakeRequest } = await import("./actions");
    authMock.mockResolvedValueOnce(null);

    await expect(submitIntakeRequest(formData())).rejects.toThrow(
      "redirect:/login?callbackUrl=/portal/intake/new",
    );
    expect($transaction).not.toHaveBeenCalled();
  });

  it("redirects producers (intake is director or admin only)", async () => {
    const { submitIntakeRequest } = await import("./actions");
    authMock.mockResolvedValueOnce({
      user: { id: "p1", globalRole: GlobalRole.PRODUCER },
    });

    await expect(submitIntakeRequest(formData())).rejects.toThrow(
      "redirect:/login?callbackUrl=/portal/intake/new",
    );
    expect($transaction).not.toHaveBeenCalled();
  });

  it("redirects when session omits globalRole (cannot classify submitter)", async () => {
    const { submitIntakeRequest } = await import("./actions");
    authMock.mockResolvedValueOnce({
      user: { id: "orphan_token" },
    });

    await expect(submitIntakeRequest(formData())).rejects.toThrow(
      "redirect:/login?callbackUrl=/portal/intake/new",
    );
    expect($transaction).not.toHaveBeenCalled();
  });

  it("redirects when production name is missing", async () => {
    const { submitIntakeRequest } = await import("./actions");
    authMock.mockResolvedValueOnce({
      user: { id: "d1", globalRole: GlobalRole.DIRECTOR },
    });

    await expect(submitIntakeRequest(formData({ name: "   " }))).rejects.toThrow(
      "redirect:/portal/intake/new?error=missing_name",
    );
    expect($transaction).not.toHaveBeenCalled();
  });

  it("creates submitted project, notifies, revalidates, and redirects (director)", async () => {
    const { submitIntakeRequest } = await import("./actions");
    authMock.mockResolvedValueOnce({
      user: { id: "dir1", globalRole: GlobalRole.DIRECTOR },
    });

    let capturedProjectCreate: { data: Record<string, unknown> } | undefined;
    $transaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        project: {
          create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
            capturedProjectCreate = { data };
            return { id: "new_proj" };
          }),
        },
        projectMember: { create: vi.fn().mockResolvedValue({}) },
      };
      await fn(tx);
    });

    const submittedAt = new Date();
    findUnique.mockResolvedValueOnce({
      id: "new_proj",
      name: "Spring Gala",
      slug: "intake-abcd",
      venue: "Arena",
      cityState: "Columbus, OH",
      contestantApprox: 50,
      additionalNotes: "Note",
      submittedAt,
      memberships: [{ user: { email: "dir@example.com" } }],
    });

    await expect(submitIntakeRequest(formData())).rejects.toThrow("redirect:/portal?submitted=1");

    expect(capturedProjectCreate?.data).toMatchObject({
      name: "Spring Gala",
      status: ProjectStatus.INTAKE_SUBMITTED,
      venue: "Arena",
      cityState: "Columbus, OH",
      categoryNotes: "Pageant",
      contestantApprox: 50,
    });
    expect(capturedProjectCreate?.data.slug).toMatch(/^intake-[0-9a-f]{16}$/);

    expect(notifyIntakeSubmitted).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "new_proj",
        projectName: "Spring Gala",
        directorEmails: ["dir@example.com"],
      }),
    );
    expect(revalidateProducerOverview).toHaveBeenCalled();
    expect(revalidateProjectMirrorCache).toHaveBeenCalledWith("new_proj");
  });

  it("allows ULS_ADMIN to submit intake on behalf of the queue", async () => {
    const { submitIntakeRequest } = await import("./actions");
    authMock.mockResolvedValueOnce({
      user: { id: "adm1", globalRole: GlobalRole.ULS_ADMIN },
    });

    $transaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        project: {
          create: vi.fn().mockResolvedValue({ id: "admin_proj" }),
        },
        projectMember: {
          create: vi.fn().mockImplementation(async ({ data }: { data: { userId: string; role: string } }) => {
            expect(data.userId).toBe("adm1");
            expect(data.role).toBe(ProjectRole.DIRECTOR);
            return {};
          }),
        },
      };
      await fn(tx);
    });

    findUnique.mockResolvedValueOnce({
      id: "admin_proj",
      name: "Admin Intake",
      slug: "intake-admin",
      venue: null,
      cityState: null,
      contestantApprox: null,
      additionalNotes: null,
      submittedAt: new Date(),
      memberships: [{ user: { email: "adm@uls.test" } }],
    });

    await expect(submitIntakeRequest(formData({ name: "Admin Intake" }))).rejects.toThrow(
      "redirect:/portal?submitted=1",
    );
    expect(revalidateProjectMirrorCache).toHaveBeenCalledWith("admin_proj");
  });

  it("treats non-finite contestantApprox and malformed dates as undefined in create payload", async () => {
    const { submitIntakeRequest } = await import("./actions");
    authMock.mockResolvedValueOnce({
      user: { id: "d2", globalRole: GlobalRole.DIRECTOR },
    });

    let capturedProjectCreate: { data: Record<string, unknown> } | undefined;

    $transaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        project: {
          create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
            capturedProjectCreate = { data };
            return { id: "proj_parse" };
          }),
        },
        projectMember: { create: vi.fn().mockResolvedValue({}) },
      };
      await fn(tx);
    });

    findUnique.mockResolvedValueOnce(null);

    await expect(
      submitIntakeRequest(
        formData({
          name: "Parse Check",
          contestantApprox: "not-a-number",
          requestedEventStart: "bogus-date",
          requestedEventEnd: "2026-12-31T08:30:00.000Z",
        }),
      ),
    ).rejects.toThrow("redirect:/portal?submitted=1");

    expect(capturedProjectCreate?.data).toMatchObject({
      name: "Parse Check",
      contestantApprox: undefined,
      requestedEventStart: undefined,
      requestedEventEnd: new Date("2026-12-31T08:30:00.000Z"),
    });
    expect(notifyIntakeSubmitted).not.toHaveBeenCalled();
    expect(revalidateProjectMirrorCache).toHaveBeenCalledWith("proj_parse");
  });

  it("floors finite contestant decimals toward zero", async () => {
    const { submitIntakeRequest } = await import("./actions");
    authMock.mockResolvedValueOnce({
      user: { id: "d3", globalRole: GlobalRole.DIRECTOR },
    });

    let capturedProjectCreate: { data: Record<string, unknown> } | undefined;

    $transaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        project: {
          create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
            capturedProjectCreate = { data };
            return { id: "proj_floor" };
          }),
        },
        projectMember: { create: vi.fn().mockResolvedValue({}) },
      };
      await fn(tx);
    });

    findUnique.mockResolvedValueOnce(null);

    await expect(
      submitIntakeRequest(
        formData({
          name: "Floor contestants",
          contestantApprox: "12.94",
        }),
      ),
    ).rejects.toThrow("redirect:/portal?submitted=1");

    expect(capturedProjectCreate?.data.contestantApprox).toBe(12);
  });
});
