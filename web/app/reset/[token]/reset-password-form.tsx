"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui";
import {
  PORTAL_ACCESS_ENDED_SIGN_IN_MESSAGE,
  isPortalAccessEndedSignInResult,
} from "@/lib/auth/credentials-sign-in-ui";
import { publicAuthFieldClass } from "@/lib/public-auth-field";

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
        <span className="text-uls-muted">New password</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          disabled={pending}
          className={publicAuthFieldClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-uls-muted">Confirm new password</span>
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          disabled={pending}
          className={publicAuthFieldClass}
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="primary" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}
