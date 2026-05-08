import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type PageHeaderProps = {
  /** Small uppercase runway label (e.g. “Production”). */
  eyebrow?: ReactNode;
  /** Overrides default `text-uls-accent` for the eyebrow (e.g. Event workspace violet). */
  eyebrowClassName?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({
  eyebrow,
  eyebrowClassName,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0 flex-1 space-y-2">
        {eyebrow != null && eyebrow !== false ? (
          <p
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.2em] sm:text-xs sm:tracking-widest",
              eyebrowClassName ?? "text-uls-accent",
            )}
          >
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-balance text-2xl font-semibold tracking-tight text-uls-text">{title}</h1>
        {description != null ? <div className="max-w-prose text-sm text-uls-muted">{description}</div> : null}
      </div>
      {actions != null ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
