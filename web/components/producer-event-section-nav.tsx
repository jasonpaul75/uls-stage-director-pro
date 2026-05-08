"use client";

import { WorkspaceSectionToc, type WorkspaceTocGroup } from "@/components/ui";

/** Anchor targets must match `<section id="…">` on the Event workspace page. */
export const PRODUCER_EVENT_NAV_GROUPS: readonly WorkspaceTocGroup[] = [
  {
    heading: "Production",
    items: [
      { id: "run-of-show", label: "Run of show" },
      { id: "show-media", label: "Show media" },
      { id: "director-shares-production", label: "Director production files" },
      { id: "show-day", label: "Show day (Flag-it)" },
      { id: "post-event", label: "Post-event delivery" },
    ],
  },
];

export function ProducerEventSectionNav(props: { projectId: string }) {
  const { projectId } = props;
  const base = `/producer/inbox/${projectId}/event`;

  return (
    <WorkspaceSectionToc
      groups={PRODUCER_EVENT_NAV_GROUPS}
      getHref={(id) => `${base}#${id}`}
      desktopAriaLabel="Event workspace sections"
      mobileTitle="Jump to section"
      mobileTriggerLabel="Jump to section"
    />
  );
}
