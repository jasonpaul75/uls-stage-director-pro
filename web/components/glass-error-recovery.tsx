"use client";

import Link from "next/link";
import { useEffect } from "react";

import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { Button, buttonClassName } from "@/components/ui";

type GlassErrorRecoveryProps = {
  /** Console prefix, e.g. `"[producer]"`. */
  logPrefix: string;
  error: Error & { digest?: string };
  reset: () => void;
  eyebrow: string;
  title: string;
  description: string;
  secondaryHref: string;
  secondaryLabel: string;
  maxWidth?: "md" | "lg";
};

const cardShell = "border-rose-500/20 bg-rose-950/[0.12] text-center";

export function GlassErrorRecovery({
  logPrefix,
  error,
  reset,
  eyebrow,
  title,
  description,
  secondaryHref,
  secondaryLabel,
  maxWidth = "lg",
}: GlassErrorRecoveryProps) {
  useEffect(() => {
    console.error(logPrefix, error.digest ?? "", error.message);
  }, [error, logPrefix]);

  const w = maxWidth === "md" ? "max-w-md" : "max-w-lg";

  return (
    <div role="alert" className={`mx-auto w-full ${w}`}>
      <ProducerGlassCard as="div" className={cardShell}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-200/85">{eyebrow}</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-uls-text">{title}</h1>
        <p className="mt-3 text-sm text-uls-muted">{description}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center sm:gap-4">
          <Button type="button" variant="primary" size="sm" onClick={() => reset()} className="sm:min-w-[8rem]">
            Try again
          </Button>
          <Link href={secondaryHref} className={buttonClassName("secondary", "sm", "justify-center sm:min-w-[8rem]")}>
            {secondaryLabel}
          </Link>
        </div>
      </ProducerGlassCard>
    </div>
  );
}
