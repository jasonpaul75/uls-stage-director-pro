import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";
export type ButtonSize = "sm" | "md";

const baseFocus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uls-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-uls-canvas";

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "border border-transparent bg-uls-accent text-zinc-950 shadow-sm transition-[background-color,box-shadow,transform,opacity] duration-150 ease-out hover:bg-uls-accent-strong active:translate-y-[0.5px] " +
    baseFocus,
  secondary:
    "border border-uls-border-strong bg-transparent text-uls-text transition-[background-color,border-color,transform,opacity] duration-150 ease-out hover:bg-uls-surface-raised active:translate-y-[0.5px] " +
    baseFocus,
  ghost:
    "border border-transparent bg-transparent text-uls-muted transition-[background-color,color,opacity] duration-150 ease-out hover:bg-uls-surface/60 hover:text-uls-text " +
    baseFocus,
  danger:
    "border border-rose-500/55 bg-rose-600/95 text-white transition-[background-color,box-shadow,transform,opacity] duration-150 ease-out hover:bg-rose-500 shadow-sm active:translate-y-[0.5px] " +
    baseFocus,
  link:
    "border-b border-transparent bg-transparent p-0 text-uls-accent underline underline-offset-4 transition-[color,border-color,opacity] duration-150 ease-out hover:border-uls-accent-strong hover:text-uls-accent-strong " +
    "rounded-none shadow-none active:translate-y-0 " +
    baseFocus,
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-uls-md px-4 py-2 text-xs font-medium sm:min-h-9 sm:px-3 sm:py-1.5",
  md: "inline-flex min-h-11 items-center justify-center gap-2 rounded-uls-md px-5 py-2.5 text-sm font-medium sm:min-h-10 sm:px-4 sm:py-2",
};

const linkSizeClass: Record<ButtonSize, string> = {
  sm: "inline text-xs font-medium leading-normal",
  md: "inline text-sm font-medium leading-normal",
};

/** Class string for `<Link>` or other elements that should match `Button` styling. */
export function buttonClassName(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "sm",
  className?: string,
): string {
  const sizing = variant === "link" ? linkSizeClass[size] : sizeClass[size];
  return cn(sizing, variantClass[variant], "touch-manipulation disabled:pointer-events-none disabled:opacity-45", className);
}

export type ButtonProps = Omit<ComponentProps<"button">, "className"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

export function Button({ variant = "primary", size = "sm", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClassName(variant, size, className)} {...props} />;
}
