import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type PanelCardTone = "default" | "inset";

const toneClass: Record<PanelCardTone, string> = {
  default: "border-uls-border bg-uls-surface/55 shadow-uls-card",
  inset: "border-uls-border-strong/80 bg-uls-surface-inset/95 shadow-inner",
};

export type PanelCardProps = {
  children: ReactNode;
  className?: string;
  tone?: PanelCardTone;
  padding?: "default" | "compact" | "none";
};

const paddingClass = {
  default: "p-4",
  compact: "p-3",
  none: "p-0",
} as const;

export function PanelCard({ children, className, tone = "default", padding = "default" }: PanelCardProps) {
  return (
    <section
      className={cn(
        "rounded-uls-card border text-uls-text transition-[box-shadow,border-color,background-color] duration-200 ease-out",
        toneClass[tone],
        paddingClass[padding],
        className,
      )}
    >
      {children}
    </section>
  );
}
