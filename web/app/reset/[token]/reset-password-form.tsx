"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

import {
  PORTAL_ACCESS_ENDED_SIGN_IN_MESSAGE,
  isPortalAccessEndedSignInResult,
} from "@/lib/auth/credentials-sign-in-ui";

import type { ResetPasswordResult } from "../actions";
import { submitPasswordReset } from "../actions";

type Props = { token: string };

export function ResetPasswordForm(props: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="mt-10 flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        setPending(true);

        try {
          const fd = new FormData(event.currentTarget);
          fd.set("token", props.token);
          const result = (await submitPasswordReset(fd)) satisfies ResetPasswordResult;

          if (!result.ok) {
            setError(result.message);
            return;
          }

          const passwordRaw = fd.get("password");
          const password = typeof passwordRaw === "string" ? passwordRaw : "";

          const signResult = await signIn("credentials", {
            redirect: false,
            email: result.emailForSignIn,
            password,
            callbackUrl: "/portal",
          });

          if (signResult?.error) {
            if (isPortalAccessEndedSignInResult(signResult)) {
              setError(
                `Password was saved, but portal sign-in isn’t available — ${PORTAL_ACCESS_ENDED_SIGN_IN_MESSAGE}`,
              );
              return;
            }
            setError("Password was updated — sign in with your new password on the login screen.");
            return;
          }

          window.location.href = signResult?.url ?? "/portal";
        } finally {
          setPending(false);
        }
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-neutral-400">New password</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          disabled={pending}
          className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 outline-none ring-amber-500/40 focus:border-amber-700 focus:ring-2 disabled:opacity-60"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-neutral-400">Confirm new password</span>
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          disabled={pending}
          className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 outline-none ring-amber-500/40 focus:border-amber-700 focus:ring-2 disabled:opacity-60"
        />
      </label>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-black hover:bg-amber-500 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
