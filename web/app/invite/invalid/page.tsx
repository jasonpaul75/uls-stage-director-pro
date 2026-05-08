import Link from "next/link";

import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { PublicAuthChrome } from "@/components/public-auth-chrome";
import { publicHeaderTrailingClassName } from "@/components/public-minimal-header";
import { buttonClassName } from "@/components/ui";

export default function InviteInvalidPage() {
  return (
    <PublicAuthChrome
      headerTrailing={
        <>
          <Link href="/" className={publicHeaderTrailingClassName}>
            Home
          </Link>
          <Link href="/login" className={publicHeaderTrailingClassName}>
            Sign in
          </Link>
        </>
      }
    >
      <ProducerGlassCard as="div" className="mx-auto w-full max-w-md">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-uls-accent">Invite link</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-uls-text">Link invalid or expired</h1>
        <p className="mt-3 text-sm text-uls-muted">
          Ask your ULS producer for a fresh invite email, then open the link from that message again.
        </p>
        <Link href="/login" className={buttonClassName("secondary", "sm", "mt-8 inline-flex w-full justify-center sm:w-auto")}>
          Go to sign in
        </Link>
      </ProducerGlassCard>
    </PublicAuthChrome>
  );
}
