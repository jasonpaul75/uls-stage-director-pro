"use client";

import { WorkspaceSectionToc, type WorkspaceTocGroup } from "@/components/ui";

/** Anchor targets must match `<section id="…">` on `/producer/inbox/[projectId]` (intake only — no show-day sections). */
export const PRODUCER_INTAKE_NAV_GROUPS: readonly WorkspaceTocGroup[] = [
  {
    heading: "Setup",
    items: [
      { id: "booking", label: "Booking & workspace" },
      { id: "intake-summary", label: "Intake summary" },
      { id: "director-invite", label: "Director invite" },
      { id: "proposal", label: "Proposal draft" },
    ],
  },
  {
    heading: "Contracts & billing",
    items: [
      { id: "contracts", label: "Contracts (DocuSign)" },
      { id: "uls-confidential-files", label: "Confidential files" },
      { id: "director-shares-production", label: "Director production files" },
      { id: "stripe", label: "Stripe" },
    ],
  },
  {
    heading: "ULS only",
    items: [{ id: "internal", label: "Internal (ULS)" }],
  },
];

export function ProducerIntakeSectionNav() {
  return (
    <WorkspaceSectionToc
      groups={PRODUCER_INTAKE_NAV_GROUPS}
      getHref={(id) => `#${id}`}
      desktopAriaLabel="Intake detail sections"
      mobileTitle="Jump to section"
      mobileTriggerLabel="Jump to section"
    />
  );
}
