import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type KpiAccent = "neutral" | "amber" | "violet" | "danger";

const valueTone: Record<KpiAccent, string> = {
  neutral: "text-uls-text",
  amber: "text-uls-accent",
  violet: "text-uls-violet",
  danger: "text-rose-400/95",
};

export type KpiTileProps = {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  accent?: KpiAccent;
  className?: string;
};

export function KpiTile({ label, value, hint, accent = "neutral", className }: KpiTileProps) {
  return (
    <article
      className={cn(
        "rounded-uls-card border border-uls-border bg-uls-surface/40 p-4 shadow-uls-card transition-[box-shadow,border-color] duration-200 ease-out",
        className,
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-uls-subtle transition-colors duration-200 sm:text-xs">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 text-2xl font-semibold tabular-nums tracking-tight transition-[color,opacity] duration-200 ease-out",
          valueTone[accent],
        )}
      >
        {value}
      </p>
      {hint != null ? <p className="mt-1 text-xs leading-snug text-uls-muted">{hint}</p> : null}
    </article>
  );
}
