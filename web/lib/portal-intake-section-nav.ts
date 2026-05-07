import type { PortalProjectLoaded } from "@/components/portal-show-workspace";
import type { PortalShowNavItem } from "@/lib/portal-show-section-nav";

/** Section anchors for portal intake detail — only includes blocks that render for this viewer/load. */
export function portalIntakeSectionNavItems(
  project: PortalProjectLoaded,
  isAdmin: boolean,
): PortalShowNavItem[] {
  const showProposal = project.proposalDirectorVisible || isAdmin;
  const showContracts = project.contractsDirectorVisible || isAdmin;
  const showStripe = project.stripeBillingDirectorVisible || isAdmin;

  const hasIntakeSummary =
    Boolean(project.categoryNotes?.trim()) ||
    Boolean(project.livestreamNotes?.trim()) ||
    Boolean(project.budgetNotes?.trim()) ||
    Boolean(project.additionalNotes?.trim());

  const items: PortalShowNavItem[] = [{ id: "portal-intake-overview", label: "Overview" }];

  if (hasIntakeSummary) {
    items.push({ id: "portal-intake-summary", label: "Your intake summary" });
  }
  if (showProposal) {
    items.push({ id: "portal-intake-proposal", label: "Proposal" });
  }
  if (showContracts && project.docuSignEnvelopes.length > 0) {
    items.push({ id: "portal-intake-contracts", label: "Contracts" });
  }
  if (showStripe && project.stripeInvoices.length > 0) {
    items.push({ id: "portal-intake-invoices", label: "Invoices & payments" });
  }

  return items;
}
