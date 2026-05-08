"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";

import { Button, buttonClassName } from "@/components/ui";
import {
  PORTAL_ACCESS_ENDED_SIGN_IN_MESSAGE,
  isPortalAccessEndedSignInResult,
} from "@/lib/auth/credentials-sign-in-ui";
import { publicAuthFieldClass } from "@/lib/public-auth-field";

export function LoginForm() {
  const searchParams = useSearchParams();
  const cb = searchParams.get("callbackUrl");
  const callbackUrl = cb && cb.startsWith("/") ? cb : "/portal";
  const prefill = searchParams.get("prefill")?.trim() ?? "";
  const joined = searchParams.get("joined") === "1";
  const portalAccessEndedUrl = searchParams.get("error") === "portal_access_ended";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <>
      {portalAccessEndedUrl ? (
        <p role="alert" className="mt-6 rounded-xl border border-rose-500/25 bg-rose-950/20 px-3 py-2 text-sm text-rose-100">
          Director portal access for your account has ended — all of your productions passed the 90-day window after their
          recorded event conclusion. Contact ULS production if you still need materials from a past engagement, or start a
          new intake when you have another show.
        </p>
      ) : null}

      {joined ? (
        <p role="status" className="mt-6 rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-100">
          You&apos;re set for this production. Sign in below to continue in the portal.
        </p>
      ) : null}

      <form
        className="mt-8 flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          setPending(true);

          const form = event.currentTarget;
          const data = new FormData(form);

          try {
            const result = await signIn("credentials", {
              redirect: false,
              email: (data.get("email") as string)?.trim(),
              password: data.get("password") as string,
              callbackUrl,
            });

            if (result?.error) {
              if (isPortalAccessEndedSignInResult(result)) {
                setError(PORTAL_ACCESS_ENDED_SIGN_IN_MESSAGE);
                return;
              }
              setError("Invalid credentials.");
              return;
            }

            if (result?.url) {
              window.location.href = result.url;
              return;
            }

            window.location.href = callbackUrl;
          } finally {
            setPending(false);
          }
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-uls-muted">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={pending}
            defaultValue={prefill || undefined}
            className={publicAuthFieldClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-uls-muted">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={pending}
            className={publicAuthFieldClass}
          />
        </label>

        <p className="text-end text-xs">
          <Link href="/login/forgot-password" className={buttonClassName("link", "sm")}>
            Forgot password?
          </Link>
        </p>

        {error ? (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        ) : null}

        <Button type="submit" variant="primary" disabled={pending} className="w-full">
          {pending ? "Signing in…" : "Continue"}
        </Button>
      </form>
    </>
  );
}
