"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import { portalBreadcrumbItems } from "@/lib/workspace-breadcrumb-trail";

const CRUMB =
  "truncate text-[11px] font-medium text-uls-subtle transition-colors hover:text-uls-muted sm:text-xs";
const CRUMB_CURRENT = "truncate text-[11px] font-medium text-uls-text sm:text-xs";

function visualCrumbs(pathname: string): { label: string; href?: string }[] {
  const norm = pathname.trim().replace(/\/+$/, "") || "/portal";
  if (!norm.startsWith("/portal")) {
    return [{ label: "Director portal", href: "/portal" }, { label: "Dashboard" }];
  }
  if (norm === "/portal") {
    return [
      { label: "Director portal", href: "/portal" },
      { label: "Dashboard", href: undefined },
    ];
  }
  return portalBreadcrumbItems(pathname);
}

export function PortalVisualBreadcrumb({ className }: { className?: string }) {
  const pathname = usePathname() ?? "/portal";
  const items = visualCrumbs(pathname);

  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, idx) => (
          <li key={`${idx}-${item.label}`} className="flex min-w-0 items-center gap-2">
            {idx > 0 ? (
              <span className="shrink-0 text-uls-subtle/70" aria-hidden>
                /
              </span>
            ) : null}
            {item.href != null ? (
              <Link href={item.href} className={CRUMB}>
                {item.label}
              </Link>
            ) : (
              <span className={CRUMB_CURRENT}>{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
