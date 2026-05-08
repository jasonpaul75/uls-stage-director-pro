"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui";
import {
  PORTAL_ACCESS_ENDED_SIGN_IN_MESSAGE,
  isPortalAccessEndedSignInResult,
} from "@/lib/auth/credentials-sign-in-ui";
import { publicAuthFieldClass } from "@/lib/public-auth-field";

import type { InviteAcceptResult } from "../actions";
import { acceptInviteExistingDirector, acceptInviteNewDirectorAccount } from "../actions";

type Props = {
  token: string;
  existingDirectorFlow: boolean;
};

export function InviteAcceptForms(props: Props) {
  const { token, existingDirectorFlow } = props;
  const [error, setError] = useState<string | null>(null);
  const [pendingNew, setPendingNew] = useState(false);

  if (existingDirectorFlow) {
    return (
      <div className="mt-10 space-y-6">
        <p className="text-sm text-uls-muted">
          You&apos;ll be added to this production and redirected to sign in with your usual password.
        </p>

        <form action={acceptInviteExistingDirector} className="flex flex-col gap-4">
          <input type="hidden" name="token" value={token} />
          <Button type="submit" variant="primary" className="w-full">
            Join production & sign in
          </Button>
        </form>
      </div>
    );
  }

  return (
    <form
      className="mt-10 flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        setPendingNew(true);

        try {
          const form = event.currentTarget;
          const fd = new FormData(form);
          fd.set("token", token);

          const result = (await acceptInviteNewDirectorAccount(fd)) satisfies InviteAcceptResult;

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
                `Your account was created, but automatic sign-in was blocked — ${PORTAL_ACCESS_ENDED_SIGN_IN_MESSAGE}`,
              );
              return;
            }
            setError("Account was created but sign-in failed. Try signing in manually.");
            return;
          }

          window.location.href = signResult?.url ?? "/portal";
        } finally {
          setPendingNew(false);
        }
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-uls-muted">How you&apos;ll appear (optional)</span>
        <input
          name="name"
          type="text"
          autoComplete="name"
          disabled={pendingNew}
          className={publicAuthFieldClass}
          placeholder="Name"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-uls-muted">Choose a password</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          disabled={pendingNew}
          className={publicAuthFieldClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-uls-muted">Confirm password</span>
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          disabled={pendingNew}
          className={publicAuthFieldClass}
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="primary" disabled={pendingNew} className="mt-2 w-full">
        {pendingNew ? "Saving…" : "Create director account"}
      </Button>
    </form>
  );
}
