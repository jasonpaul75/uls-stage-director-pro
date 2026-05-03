"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

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
        <p className="text-sm text-neutral-400">
          You&apos;ll be added to this production and redirected to sign in with your usual password.
        </p>

        <form action={acceptInviteExistingDirector} className="flex flex-col gap-4">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-black hover:bg-amber-500"
          >
            Join production &amp; sign in
          </button>
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
        <span className="text-neutral-400">How you&apos;ll appear (optional)</span>
        <input
          name="name"
          type="text"
          autoComplete="name"
          disabled={pendingNew}
          className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 outline-none ring-amber-500/40 focus:border-amber-700 focus:ring-2 disabled:opacity-60"
          placeholder="Name"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-neutral-400">Choose a password</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          disabled={pendingNew}
          className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 outline-none ring-amber-500/40 focus:border-amber-700 focus:ring-2 disabled:opacity-60"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-neutral-400">Confirm password</span>
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          disabled={pendingNew}
          className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 outline-none ring-amber-500/40 focus:border-amber-700 focus:ring-2 disabled:opacity-60"
        />
      </label>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <button
        type="submit"
        disabled={pendingNew}
        className="mt-2 rounded bg-amber-600 px-4 py-2 text-sm font-medium text-black hover:bg-amber-500 disabled:opacity-60"
      >
        {pendingNew ? "Saving…" : "Create director account"}
      </button>
    </form>
  );
}
