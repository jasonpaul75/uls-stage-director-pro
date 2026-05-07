import { describe, expect, it } from "vitest";

import type { PortalProjectLoaded } from "@/components/portal-show-workspace";

import { portalShowSectionNavItems } from "./portal-show-section-nav";

function stub(overrides: Partial<PortalProjectLoaded>): PortalProjectLoaded {
  const base = {
    contractsDirectorVisible: false,
    stripeBillingDirectorVisible: false,
    postEventVaultDirectorVisible: false,
    showDayFlagsDirectorVisible: false,
    runOfShowDirectorVisible: false,
    docuSignEnvelopes: [],
    stripeInvoices: [],
  };
  return { ...base, ...overrides } as PortalProjectLoaded;
}

describe("portalShowSectionNavItems", () => {
  it("omits Contracts when envelopes are empty even if visibility is on", () => {
    const items = portalShowSectionNavItems(
      stub({ contractsDirectorVisible: true }),
      false,
    );
    expect(items.map((i) => i.id)).not.toContain("portal-contracts");
  });

  it("includes Contracts when visible and envelopes exist", () => {
    const items = portalShowSectionNavItems(
      stub({
        contractsDirectorVisible: true,
        docuSignEnvelopes: [{ id: "e1" } as PortalProjectLoaded["docuSignEnvelopes"][number]],
      }),
      false,
    );
    expect(items.some((i) => i.id === "portal-contracts")).toBe(true);
  });

  it("allows admin-only visibility for Stripe without director flags", () => {
    const items = portalShowSectionNavItems(
      stub({
        stripeBillingDirectorVisible: false,
        stripeInvoices: [{ id: "i1" } as PortalProjectLoaded["stripeInvoices"][number]],
      }),
      true,
    );
    expect(items.some((i) => i.id === "portal-invoices")).toBe(true);
  });

  it("does not list Invoices for director when Stripe not visible", () => {
    const items = portalShowSectionNavItems(
      stub({
        stripeBillingDirectorVisible: false,
        stripeInvoices: [{ id: "i1" } as PortalProjectLoaded["stripeInvoices"][number]],
      }),
      false,
    );
    expect(items.map((i) => i.id)).not.toContain("portal-invoices");
  });
});
