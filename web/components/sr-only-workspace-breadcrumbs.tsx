"use client";

import { usePathname } from "next/navigation";

import { portalBreadcrumbItems, producerBreadcrumbItems } from "@/lib/workspace-breadcrumb-trail";

export function SrOnlyWorkspaceBreadcrumbs({ variant }: { variant: "producer" | "portal" }) {
  const pathname = usePathname() ?? "";
  const items =
    variant === "producer" ? producerBreadcrumbItems(pathname) : portalBreadcrumbItems(pathname);

  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="sr-only">
      <ol className="m-0 border-0 p-0">
        {items.map((item, idx) => (
          <li key={`${idx}-${item.label}`}>
            {item.href == null ? (
              <span aria-current="page">{item.label}</span>
            ) : (
              <a href={item.href}>{item.label}</a>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
