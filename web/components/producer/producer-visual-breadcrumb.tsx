"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import { producerBreadcrumbItems } from "@/lib/workspace-breadcrumb-trail";

const CRUMB =
  "truncate text-[11px] font-medium text-uls-subtle transition-colors hover:text-uls-muted sm:text-xs";
const CRUMB_CURRENT = "truncate text-[11px] font-medium text-uls-text sm:text-xs";

function visualCrumbs(pathname: string): { label: string; href?: string }[] {
  const norm = pathname.trim().replace(/\/+$/, "") || "/producer";
  if (!norm.startsWith("/producer")) {
    return [{ label: "Production", href: "/producer" }, { label: "Command center" }];
  }
  if (norm === "/producer") {
    return [
      { label: "Production", href: "/producer" },
      { label: "Command center", href: undefined },
    ];
  }
  return producerBreadcrumbItems(pathname);
}

export function ProducerVisualBreadcrumb({ className }: { className?: string }) {
  const pathname = usePathname() ?? "/producer";
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
