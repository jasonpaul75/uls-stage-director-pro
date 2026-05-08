"use client";

import { WorkspaceSectionToc } from "@/components/ui";
import type { PortalShowNavItem } from "@/lib/portal-show-section-nav";

type Props = {
  items: PortalShowNavItem[];
  /** Passed to sticky desktop TOC + mobile sheet `nav`. */
  desktopAriaLabel?: string;
  mobileTitle?: string;
  mobileTriggerLabel?: string;
};

/** Director portal TOC — skips render when items empty. */
export function PortalShowSectionNav(props: Props) {
  const {
    items,
    desktopAriaLabel = "Page sections",
    mobileTitle = "Jump to section",
    mobileTriggerLabel = "Jump to section",
  } = props;

  return (
    <WorkspaceSectionToc
      groups={[{ items }]}
      getHref={(id) => `#${id}`}
      desktopAriaLabel={desktopAriaLabel}
      mobileTitle={mobileTitle}
      mobileTriggerLabel={mobileTriggerLabel}
    />
  );
}
