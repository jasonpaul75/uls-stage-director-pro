import Link from "next/link";

import { ForgotPasswordForm } from "./forgot-password-form";

type Props = { searchParams?: Promise<{ sent?: string; err?: string }> };

export default async function ForgotPasswordPage(props: Props) {
  const sp = (await props.searchParams) ?? {};

  const errCopy: Record<string, string> = {
    mail: "We could not send email right now. Check SES_FROM_EMAIL and try again later.",
    server: "Something went wrong. Try again in a minute.",
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center bg-black px-4 py-10 sm:px-6 lg:px-8 text-neutral-50">
      <div className="mx-auto w-full max-w-md">
      <p className="text-sm uppercase tracking-widest text-amber-500">ULS Stage Director PRO</p>
      <h1 className="mt-2 text-2xl font-semibold">Forgot password</h1>

      <p className="mt-2 text-sm text-neutral-500">
        Enter the email you use to sign in. If it matches an account, we will send a one-hour reset link.
      </p>

      {sp.sent === "1" ? (
        <p className="mt-6 rounded border border-emerald-900/60 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-100">
          Check your inbox for a reset message. Links expire in about an hour — if nothing arrives after a minute,
          look in spam or verify your SES recipient is verified in sandbox.
        </p>
      ) : null}

      {typeof sp.err === "string" && errCopy[sp.err] ? (
        <p className="mt-4 text-sm text-red-400">{errCopy[sp.err]}</p>
      ) : null}

      {sp.sent === "1" ? (
        <p className="mt-8">
          <Link href="/login" className="text-sm text-amber-500 hover:text-amber-400">
            Back to sign in
          </Link>
        </p>
      ) : (
        <>
          <ForgotPasswordForm />
          <p className="mt-8 text-center text-sm text-neutral-500">
            <Link href="/login" className="text-amber-500 hover:text-amber-400">
              Cancel
            </Link>
          </p>
        </>
      )}
      </div>
    </main>
  );
}
