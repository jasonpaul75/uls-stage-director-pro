import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalRole, ProjectRole, ProjectStatus } from "@prisma/client";

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const getStripeMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/stripe-admin", () => ({
  getStripe: () => getStripeMock(),
}));

const db = vi.hoisted(() => ({
  projectFindFirst: vi.fn(),
  projectUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findFirst: db.projectFindFirst,
      update: db.projectUpdate,
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

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockReset();
  getStripeMock.mockReset();
  db.projectFindFirst.mockReset();
  db.projectUpdate.mockReset();
  revalidateProjectMirrorCache.mockReset();
});

function producerSession() {
  return { user: { id: "prod1", globalRole: GlobalRole.PRODUCER as const } };
}

function customerForm(projectId: string) {
  const fd = new FormData();
  fd.set("projectId", projectId);
  return fd;
}

describe("ensureStripeCustomerForProject", () => {
  it("requires login with inbox callback", async () => {
    const { ensureStripeCustomerForProject } = await import("./stripe-actions");
    authMock.mockResolvedValueOnce(null);

    await expect(ensureStripeCustomerForProject(customerForm("p_need_auth"))).rejects.toThrow(
      "redirect:/login?callbackUrl=/producer/inbox/p_need_auth",
    );
  });

  it("redirects when Stripe secret key is not configured", async () => {
    const { ensureStripeCustomerForProject } = await import("./stripe-actions");
    authMock.mockResolvedValueOnce(producerSession());
    getStripeMock.mockReturnValueOnce(null);

    await expect(ensureStripeCustomerForProject(customerForm("p_no_sk"))).rejects.toThrow(
      "redirect:/producer/inbox/p_no_sk?stripe_err=no_key",
    );
    expect(db.projectFindFirst).not.toHaveBeenCalled();
  });

  it("redirects when project is not on the intake queue", async () => {
    const { ensureStripeCustomerForProject } = await import("./stripe-actions");
    authMock.mockResolvedValueOnce(producerSession());
    getStripeMock.mockReturnValueOnce({ customers: { create: vi.fn() } });
    db.projectFindFirst.mockResolvedValueOnce(null);

    await expect(ensureStripeCustomerForProject(customerForm("gone"))).rejects.toThrow(
      "redirect:/producer/inbox?stripe_err=invalid_project",
    );
  });

  it("redirects when customer is already linked", async () => {
    const { ensureStripeCustomerForProject } = await import("./stripe-actions");
    authMock.mockResolvedValueOnce(producerSession());
    getStripeMock.mockReturnValueOnce({ customers: { create: vi.fn() } });
    db.projectFindFirst.mockResolvedValueOnce({
      id: "p_linked",
      name: "Show",
      stripeCustomerId: "cus_existing",
      memberships: [{ user: { email: "d@example.com" } }],
    });

    await expect(ensureStripeCustomerForProject(customerForm("p_linked"))).rejects.toThrow(
      "redirect:/producer/inbox/p_linked?stripe_err=already_linked",
    );
  });

  it("redirects when there is no director email for billing", async () => {
    const { ensureStripeCustomerForProject } = await import("./stripe-actions");
    authMock.mockResolvedValueOnce(producerSession());
    getStripeMock.mockReturnValueOnce({ customers: { create: vi.fn() } });
    db.projectFindFirst.mockResolvedValueOnce({
      id: "p_empty",
      name: "Lonely",
      stripeCustomerId: null,
      memberships: [],
    });

    await expect(ensureStripeCustomerForProject(customerForm("p_empty"))).rejects.toThrow(
      "redirect:/producer/inbox/p_empty?stripe_err=no_directors",
    );
  });

  it("creates Stripe customer, stores id, revalidates", async () => {
    const customersCreate = vi.fn().mockResolvedValue({ id: "cus_created" });
    getStripeMock.mockReturnValueOnce({ customers: { create: customersCreate } });

    const { ensureStripeCustomerForProject } = await import("./stripe-actions");
    authMock.mockResolvedValueOnce(producerSession());
    db.projectFindFirst.mockResolvedValueOnce({
      id: "p_new",
      name: "Regional",
      stripeCustomerId: null,
      memberships: [{ user: { email: "dir@example.com" }, role: ProjectRole.DIRECTOR }],
    });

    await expect(ensureStripeCustomerForProject(customerForm("p_new"))).rejects.toThrow(
      "redirect:/producer/inbox/p_new?stripe_customer=1",
    );

    expect(customersCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "dir@example.com",
        name: "Regional",
        metadata: { projectId: "p_new", app: "uls-stage-director-pro" },
      }),
    );
    expect(db.projectUpdate).toHaveBeenCalledWith({
      where: { id: "p_new" },
      data: { stripeCustomerId: "cus_created" },
    });
    expect(revalidateProjectMirrorCache).toHaveBeenCalledWith("p_new");
    expect(db.projectFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "p_new", status: ProjectStatus.INTAKE_SUBMITTED } }),
    );
  });
});

describe("createDepositDraftInvoice", () => {
  it("redirects on invalid dollar amount without calling Stripe invoicing APIs", async () => {
    const invoicesCreate = vi.fn();
    getStripeMock.mockReturnValueOnce({
      customers: { create: vi.fn() },
      invoices: { create: invoicesCreate },
    });

    const { createDepositDraftInvoice } = await import("./stripe-actions");
    authMock.mockResolvedValueOnce(producerSession());
    db.projectFindFirst.mockResolvedValueOnce({
      id: "p_bad",
      name: "X",
      stripeCustomerId: "cus_1",
    });

    const fd = new FormData();
    fd.set("projectId", "p_bad");
    fd.set("depositUsd", "0");

    await expect(createDepositDraftInvoice(fd)).rejects.toThrow(
      "redirect:/producer/inbox/p_bad?stripe_err=bad_amount",
    );
    expect(invoicesCreate).not.toHaveBeenCalled();
  });
});
