import { describe, expect, it } from "vitest";

import type { PortalProjectLoaded } from "@/components/portal-show-workspace";

import { portalIntakeSectionNavItems } from "./portal-intake-section-nav";

function stub(overrides: Partial<PortalProjectLoaded>): PortalProjectLoaded {
  const base = {
    proposalDirectorVisible: false,
    contractsDirectorVisible: false,
    stripeBillingDirectorVisible: false,
    categoryNotes: null,
    livestreamNotes: null,
    budgetNotes: null,
    additionalNotes: null,
    docuSignEnvelopes: [],
    stripeInvoices: [],
  };
  return { ...base, ...overrides } as PortalProjectLoaded;
}

describe("portalIntakeSectionNavItems", () => {
  it("always includes Overview", () => {
    const items = portalIntakeSectionNavItems(stub({}), false);
    expect(items[0]).toEqual({ id: "portal-intake-overview", label: "Overview" });
  });

  it("includes Production files after Overview", () => {
    const items = portalIntakeSectionNavItems(stub({}), false);
    expect(items[1]).toEqual({ id: "portal-director-shares", label: "Production files" });
  });

  it("includes intake summary anchor only when at least one summary field is present", () => {
    const empty = portalIntakeSectionNavItems(stub({}), false);
    expect(empty.some((i) => i.id === "portal-intake-summary")).toBe(false);

    const filled = portalIntakeSectionNavItems(stub({ categoryNotes: "x" }), false);
    expect(filled.some((i) => i.id === "portal-intake-summary")).toBe(true);
  });

  it("omits Contracts without envelopes even when visibility is on", () => {
    const items = portalIntakeSectionNavItems(stub({ contractsDirectorVisible: true }), false);
    expect(items.map((i) => i.id)).not.toContain("portal-intake-contracts");
  });
});
