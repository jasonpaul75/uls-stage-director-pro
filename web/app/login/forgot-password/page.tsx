import Link from "next/link";

import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { PublicAuthChrome } from "@/components/public-auth-chrome";
import { publicHeaderTrailingClassName } from "@/components/public-minimal-header";

import { ForgotPasswordForm } from "./forgot-password-form";

type Props = { searchParams?: Promise<{ sent?: string; err?: string }> };

export default async function ForgotPasswordPage(props: Props) {
  const sp = (await props.searchParams) ?? {};

  const errCopy: Record<string, string> = {
    mail: "We could not send email right now. Check SES_FROM_EMAIL and try again later.",
    server: "Something went wrong. Try again in a minute.",
  };

  return (
    <PublicAuthChrome headerTrailing={<Link href="/" className={publicHeaderTrailingClassName}>Home</Link>}>
      <ProducerGlassCard as="div" className="mx-auto w-full max-w-md">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-uls-accent">ULS Stage Director PRO</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-uls-text">Forgot password</h1>

        <p className="mt-2 text-sm text-uls-muted">
          Enter the email you use to sign in. If it matches an account, we will send a one-hour reset link.
        </p>

        {sp.sent === "1" ? (
          <p role="status" className="mt-6 rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-100">
            Check your inbox for a reset message. Links expire in about an hour — if nothing arrives after a minute,
            look in spam or verify your SES recipient is verified in sandbox.
          </p>
        ) : null}

        {typeof sp.err === "string" && errCopy[sp.err] ? (
          <p role="alert" className="mt-4 rounded-xl border border-rose-500/25 bg-rose-950/20 px-3 py-2 text-sm text-rose-100">
            {errCopy[sp.err]}
          </p>
        ) : null}

        {sp.sent === "1" ? (
          <p className="mt-8">
            <Link href="/login" className="text-sm text-uls-accent hover:text-uls-accent-strong">
              Back to sign in
            </Link>
          </p>
        ) : (
          <>
            <ForgotPasswordForm />
            <p className="mt-8 text-center text-sm text-uls-muted">
              <Link href="/login" className="text-uls-accent hover:text-uls-accent-strong">
                Cancel
              </Link>
            </p>
          </>
        )}
      </ProducerGlassCard>
    </PublicAuthChrome>
  );
}
