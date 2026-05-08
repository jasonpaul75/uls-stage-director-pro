import type { ReactNode } from "react";

import { PublicMinimalHeader } from "@/components/public-minimal-header";
import { cn } from "@/lib/cn";

export type PublicAuthMainPadding = "default" | "spacious";

const mainBase =
  "mx-auto flex w-full max-w-[1440px] flex-1 flex-col justify-center px-4 text-uls-text sm:px-6 lg:px-8";

/** Class string for the public `<main>` rail (matches {@link PublicAuthChrome}). */
export function publicAuthMainClassName(
  mainPadding: PublicAuthMainPadding = "default",
  mainExtraClassName?: string,
): string {
  const pad = mainPadding === "spacious" ? "py-16" : "py-10";
  return cn(mainBase, pad, mainExtraClassName);
}

/** Shared wrapper for public routes: ambient wash header + constrained main landmark. */
export function PublicAuthChrome({
  headerTrailing,
  children,
  mainPadding = "default",
  mainExtraClassName,
}: {
  headerTrailing: ReactNode;
  children: ReactNode;
  mainPadding?: PublicAuthMainPadding;
  /** Tailwind atoms merged after base + padding (e.g. `items-center py-24` for the marketing home hero). */
  mainExtraClassName?: string;
}) {
  return (
    <div className="uls-public-app flex min-h-screen flex-col">
      <PublicMinimalHeader trailing={headerTrailing} />
      <main className={publicAuthMainClassName(mainPadding, mainExtraClassName)}>{children}</main>
    </div>
  );
}
