"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import { handleHorizontalNavAnchors } from "@/lib/nav-keyboard";

const LINKS = [
  { href: "/staff", label: "Schedule" },
  { href: "/staff/availability", label: "Availability" },
  { href: "/staff/tax", label: "Tax forms" },
] as const;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uls-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";

function active(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  const norm = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  if (href === "/staff") return norm === "/staff";
  return norm === href || norm.startsWith(`${href}/`);
}

export function StaffNavPills({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav className={cn(className)} aria-label="Crew navigation" onKeyDown={handleHorizontalNavAnchors}>
      <div className="inline-flex max-w-[100vw] flex-wrap items-center justify-center gap-0.5 rounded-full border border-white/[0.1] bg-uls-surface/25 px-1 py-1 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.06)] backdrop-blur-md supports-[backdrop-filter]:bg-uls-surface/20">
        {LINKS.map(({ href, label }) => {
          const on = active(href, pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "relative inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-full px-3.5 pb-2 pt-2 text-[11px] font-semibold tracking-wide transition-colors sm:min-h-9 sm:min-w-0 sm:px-4 sm:text-xs",
                focusRing,
                on
                  ? "bg-white/[0.12] text-uls-text shadow-[0_0_0_1px_rgb(255_255_255/0.08)]"
                  : "text-uls-muted hover:bg-white/[0.06] hover:text-uls-text",
              )}
            >
              {label}
              {on ? (
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
