"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import { handleHorizontalNavAnchors } from "@/lib/nav-keyboard";

const LINKS = [
  { href: "/portal", label: "Dashboard" },
  { href: "/portal/intake/new", label: "New intake" },
] as const;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uls-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";

function normalizePath(pathname: string | null): string {
  if (!pathname) return "";
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function linkActive(href: string, pathname: string | null): boolean {
  const norm = normalizePath(pathname);
  if (!norm) return false;
  if (href === "/portal") return norm === "/portal";
  return norm === href || norm.startsWith(`${href}/`);
}

export function PortalNavPills({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(className)}
      aria-label="Director portal navigation"
      onKeyDown={handleHorizontalNavAnchors}
    >
      <div className="inline-flex max-w-[100vw] flex-wrap items-center justify-center gap-0.5 rounded-full border border-white/[0.1] bg-uls-surface/25 px-1 py-1 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.06)] backdrop-blur-md supports-[backdrop-filter]:bg-uls-surface/20">
        {LINKS.map(({ href, label }) => {
          const active = linkActive(href, pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-full px-3.5 pb-2 pt-2 text-[11px] font-semibold tracking-wide transition-colors sm:min-h-9 sm:min-w-0 sm:px-4 sm:text-xs",
                focusRing,
                active
                  ? "bg-white/[0.12] text-uls-text shadow-[0_0_0_1px_rgb(255_255_255/0.08)]"
                  : "text-uls-muted hover:bg-white/[0.06] hover:text-uls-text",
              )}
            >
              {label}
              {active ? (
                <span
                  className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-uls-accent shadow-[0_0_8px_rgb(251_191_36/0.65)]"
                  aria-hidden
                />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
