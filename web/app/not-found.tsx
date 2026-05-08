import Link from "next/link";

import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { PublicAuthChrome } from "@/components/public-auth-chrome";
import { publicHeaderTrailingClassName } from "@/components/public-minimal-header";
import { buttonClassName } from "@/components/ui";

export default function NotFound() {
  return (
    <PublicAuthChrome
      headerTrailing={<Link href="/login" className={publicHeaderTrailingClassName}>Sign in</Link>}
      mainPadding="spacious"
    >
      <ProducerGlassCard as="div" className="mx-auto w-full max-w-md text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-uls-subtle">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-uls-text">Page not found</h1>
        <p className="mt-3 text-sm text-uls-muted">That route isn&apos;t available in this app.</p>
        <Link href="/" className={buttonClassName("primary", "sm", "mt-8 inline-flex w-full justify-center sm:w-auto")}>
          Back to home
        </Link>
      </ProducerGlassCard>
    </PublicAuthChrome>
  );
}
