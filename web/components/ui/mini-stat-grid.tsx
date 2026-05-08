import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type MiniStatGridProps = {
  children: ReactNode;
  className?: string;
  /** Staggered mount animation for KPI tiles (command home only — respects `prefers-reduced-motion`). */
  mountStagger?: boolean;
};

/** Responsive grid tuned for KPI / mini-stat rows on command surfaces. */
export function MiniStatGrid({ children, className, mountStagger = false }: MiniStatGridProps) {
  return (
    <div
      role="presentation"
      className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-3", mountStagger && "uls-kpi-stagger", className)}
    >
      {children}
    </div>
  );
}
