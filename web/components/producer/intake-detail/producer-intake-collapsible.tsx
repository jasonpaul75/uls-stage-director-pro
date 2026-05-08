"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Native disclosure — keeps long producer copy out of the default scan path. Supports Tailwind `group-open:` on `<details>`. */
export function ProducerIntakeCollapsible({
  title,
  children,
  defaultOpen = false,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details
      open={defaultOpen}
      className={cn(
        "group rounded-uls-card border border-uls-border bg-uls-surface/40 shadow-uls-card",
        className,
      )}
    >
      <summary className="flex min-h-11 touch-manipulation cursor-pointer list-none items-center gap-2 px-3 py-3 text-sm font-medium text-uls-text outline-none focus-visible:relative focus-visible:z-10 focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-uls-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-uls-canvas [&::-webkit-details-marker]:hidden sm:min-h-0 sm:py-2.5">
        <span
          aria-hidden
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-uls-border text-[10px] text-uls-subtle transition-transform duration-150 group-open:rotate-90"
        >
          ▸
        </span>
        {title}
      </summary>
      <div className="border-t border-uls-border px-3 py-3 text-sm text-uls-muted">{children}</div>
    </details>
  );
}
