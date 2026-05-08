import { cn } from "@/lib/cn";

export type SkeletonProps = {
  className?: string;
};

/** Inert pulse block for route `loading.tsx` and deferred UI. */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-uls-md bg-uls-surface-raised/55", className)}
      aria-hidden
    />
  );
}
