import Link from "next/link";

import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { PublicAuthChrome } from "@/components/public-auth-chrome";
import { publicHeaderTrailingClassName } from "@/components/public-minimal-header";
import { buttonClassName } from "@/components/ui";

export default function ResetInvalidPage() {
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-uls-accent">Password reset</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-uls-text">Link invalid or expired</h1>
        <p className="mt-3 text-sm text-uls-muted">
          Request another reset email from sign-in — each link expires in around an hour after it is sent.
        </p>
        <Link
          href="/login/forgot-password"
          className={buttonClassName("secondary", "sm", "mt-8 inline-flex w-full justify-center sm:w-auto")}
        >
          Request reset again
        </Link>
        <Link href="/login" className={buttonClassName("link", "sm", "mt-6 block text-center")}>
          Back to sign in
        </Link>
      </ProducerGlassCard>
    </PublicAuthChrome>
  );
}
