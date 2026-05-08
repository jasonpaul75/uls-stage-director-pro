import Link from "next/link";
import { Suspense } from "react";

import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { PublicAuthChrome } from "@/components/public-auth-chrome";
import { publicHeaderTrailingClassName } from "@/components/public-minimal-header";

import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <PublicAuthChrome headerTrailing={<Link href="/" className={publicHeaderTrailingClassName}>Home</Link>}>
      <ProducerGlassCard as="div" className="mx-auto w-full max-w-md">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-uls-accent">ULS Stage Director PRO</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-uls-text">Sign in</h1>
        <p className="mt-2 text-sm text-uls-muted">
          Directors onboard through producer-invite emails. Forgot your portal password? Use the reset link below the
          form.
        </p>

        <Suspense fallback={<p className="mt-8 text-sm text-uls-muted">Loading…</p>}>
          <LoginForm />
        </Suspense>
      </ProducerGlassCard>
    </PublicAuthChrome>
  );
}
