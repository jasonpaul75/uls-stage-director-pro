import Link from "next/link";
import type { ReactNode } from "react";

import { UlsBrandMark } from "@/components/uls-brand-mark";

/** Shared typography for trailing controls in {@link PublicMinimalHeader}. */
export const publicHeaderTrailingClassName =
  "text-xs font-semibold uppercase tracking-wide text-uls-muted transition-colors hover:text-uls-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uls-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-uls-canvas";

export type PublicMinimalHeaderProps = {
  trailing?: ReactNode;
};

/** Thin branded bar aligned with authenticated shells — use on `/`, `/login`, invite & reset flows. */
export function PublicMinimalHeader({ trailing }: PublicMinimalHeaderProps) {
  return (
    <header
      role="banner"
      aria-label="ULS Stage Director PRO"
      className="shrink-0 border-b border-uls-border/90 bg-uls-canvas/80 backdrop-blur-md supports-[backdrop-filter]:bg-uls-canvas/70"
    >
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2 text-sm font-semibold text-uls-accent transition hover:text-uls-accent-strong"
        >
          <UlsBrandMark className="shrink-0 text-uls-accent" />
          <span className="truncate">ULS Stage Director PRO</span>
        </Link>
        {trailing != null ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">{trailing}</div> : null}
      </div>
    </header>
  );
}
