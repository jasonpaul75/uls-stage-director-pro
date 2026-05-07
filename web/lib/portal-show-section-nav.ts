import type { PortalProjectLoaded } from "@/components/portal-show-workspace";

export type PortalShowNavItem = { id: string; label: string };

/** Section anchors for show workspace — only includes blocks that render for this viewer/load. */
export function portalShowSectionNavItems(project: PortalProjectLoaded, isAdmin: boolean): PortalShowNavItem[] {
  const showContracts = project.contractsDirectorVisible || isAdmin;
  const showStripe = project.stripeBillingDirectorVisible || isAdmin;
  const showVault = project.postEventVaultDirectorVisible || isAdmin;
  const showShowDay = project.showDayFlagsDirectorVisible || isAdmin;
  const showRunOfShow = project.runOfShowDirectorVisible || isAdmin;
  const mediaRows = project.showMediaItems ?? [];
  const showMediaBlock =
    (project.showMediaDirectorVisible || isAdmin) && mediaRows.length > 0;

  const musicItems = mediaRows.filter((i) => i.lane === "MUSIC");
  const videoItems = mediaRows.filter((i) => i.lane === "VIDEO");

  const items: PortalShowNavItem[] = [];

  if (showRunOfShow) items.push({ id: "portal-run-of-show", label: "Run of show" });
  if (showMediaBlock) items.push({ id: "portal-show-media", label: "Show media" });

  // Matches PortalShowWorkspaceSections: contracts block only when rows exist.
  if (showContracts && project.docuSignEnvelopes.length > 0) {
    items.push({ id: "portal-contracts", label: "Contracts" });
  }
  if (showStripe && project.stripeInvoices.length > 0) {
    items.push({ id: "portal-invoices", label: "Invoices & payments" });
  }
  if (showShowDay) items.push({ id: "portal-show-day", label: "Show day" });
  if (showVault) items.push({ id: "portal-post-event", label: "Post-event" });

  return items;
}
