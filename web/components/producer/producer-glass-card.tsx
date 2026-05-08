import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Command-center style panel: soft glass, subtle lift, inset highlight. */
export function ProducerGlassCard({
  children,
  className,
  padding = "default",
  id,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  padding?: "default" | "compact" | "none";
  id?: string;
  /** Use `div` when nesting inside `ul > li` so markup stays valid. */
  as?: "section" | "div";
}) {
  const pad = padding === "none" ? "" : padding === "compact" ? "p-3" : "p-4 sm:p-5";
  return (
    <Tag
      {...(id ? { id } : {})}
      className={cn(
        "rounded-2xl border border-white/[0.08] bg-uls-surface/30 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.06),0_12px_40px_rgb(0_0_0/0.35)] backdrop-blur-xl transition-[box-shadow,border-color,background-color] duration-200 ease-out",
        pad,
        className,
      )}
    >
      {children}
    </Tag>
  );
}
