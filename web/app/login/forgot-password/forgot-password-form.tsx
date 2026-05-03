import { requestPasswordReset } from "./actions";

export function ForgotPasswordForm() {
  return (
    <form action={requestPasswordReset} className="mt-8 flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-neutral-400">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none ring-amber-500/40 focus:border-amber-700 focus:ring-2"
        />
      </label>

      <p className="text-xs text-neutral-600">
        For privacy we always ask you to check email, even when no account exists. If you&apos;re unsure which
        address your producer invited, ask them before trying again.
      </p>

      <button
        type="submit"
        className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-black hover:bg-amber-500"
      >
        Send reset link
      </button>
    </form>
  );
}
