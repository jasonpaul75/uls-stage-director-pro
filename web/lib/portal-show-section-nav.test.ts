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
    showMediaDirectorVisible: false,
    stageDesignDirectorVisible: false,
    stageDesign: null,
    showMediaItems: [],
    directorShares: [],
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

  it("includes Stage footprint when visible and a diagram row exists", () => {
    const items = portalShowSectionNavItems(
      stub({
        stageDesignDirectorVisible: true,
        stageDesign: {
          title: "Main",
          unit: "FEET",
          canvasJson: { version: 1, footprint: { width: 40, depth: 24 } },
        } as PortalProjectLoaded["stageDesign"],
      }),
      false,
    );
    expect(items.some((i) => i.id === "portal-stage-design")).toBe(true);
  });

  it("omits Stage footprint when no diagram row exists", () => {
    const items = portalShowSectionNavItems(
      stub({ stageDesignDirectorVisible: true, stageDesign: null }),
      false,
    );
    expect(items.map((i) => i.id)).not.toContain("portal-stage-design");
  });

  it("always includes director production files section in nav", () => {
    const items = portalShowSectionNavItems(
      stub({ runOfShowDirectorVisible: false, showMediaDirectorVisible: false }),
      false,
    );
    expect(items.find((i) => i.id === "portal-director-shares")).toEqual({
      id: "portal-director-shares",
      label: "Production files",
    });
  });
});
