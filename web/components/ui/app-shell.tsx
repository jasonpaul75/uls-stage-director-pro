import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

const contentMaxClass = {
  full: "",
  narrow: "mx-auto max-w-2xl",
  readable: "mx-auto max-w-3xl",
} as const;

export type AppShellContentMaxWidth = keyof typeof contentMaxClass;

const outerMaxClass = {
  standard: "max-w-6xl",
  wide: "max-w-[1440px]",
} as const;

export type AppShellOuterMaxWidth = keyof typeof outerMaxClass;

export type AppShellProps = {
  children: ReactNode;
  /** Landmark id — when set, receives `tabIndex={-1}` for skip-link targets. */
  id?: string;
  className?: string;
  /** Outer shell max-width (command center spans wider than inbox detail). */
  outerMaxWidth?: AppShellOuterMaxWidth;
  /** Inner rail width (producer home uses narrow command column). */
  contentMaxWidth?: AppShellContentMaxWidth;
  contentClassName?: string;
};

export function AppShell({
  children,
  id,
  className,
  outerMaxWidth = "standard",
  contentMaxWidth = "full",
  contentClassName,
}: AppShellProps) {
  const needsInnerRail = contentMaxWidth !== "full" || Boolean(contentClassName?.trim());
  const body = needsInnerRail ? (
    <div className={cn(contentMaxWidth !== "full" ? contentMaxClass[contentMaxWidth] : null, contentClassName)}>
      {children}
    </div>
  ) : (
    children
  );

  return (
    <main
      id={id}
      {...(id ? { tabIndex: -1 as const } : {})}
      className={cn("mx-auto w-full px-4 pb-12 pt-8 sm:px-6 lg:px-8", outerMaxClass[outerMaxWidth], className)}
    >
      {body}
    </main>
  );
}
