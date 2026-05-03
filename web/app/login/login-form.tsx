"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";

export function LoginForm() {
  const searchParams = useSearchParams();
  const cb = searchParams.get("callbackUrl");
  const callbackUrl = cb && cb.startsWith("/") ? cb : "/portal";
  const prefill = searchParams.get("prefill")?.trim() ?? "";
  const joined = searchParams.get("joined") === "1";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <>
      {joined ? (
        <p className="mt-6 rounded border border-emerald-900/60 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-100">
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
          <span className="text-neutral-400">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={pending}
            defaultValue={prefill || undefined}
            className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none ring-amber-500/40 focus:border-amber-700 focus:ring-2 disabled:opacity-60"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-400">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={pending}
            className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none ring-amber-500/40 focus:border-amber-700 focus:ring-2 disabled:opacity-60"
          />
        </label>

        <p className="text-end text-xs">
          <Link href="/login/forgot-password" className="text-amber-500 hover:text-amber-400">
            Forgot password?
          </Link>
        </p>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-black transition hover:bg-amber-500 disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Continue"}
        </button>
      </form>
    </>
  );
}
