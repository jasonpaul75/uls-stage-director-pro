import { Button } from "@/components/ui";
import { publicAuthFieldClass, publicAuthHintClass } from "@/lib/public-auth-field";

import { requestPasswordReset } from "./actions";

export function ForgotPasswordForm() {
  return (
    <form action={requestPasswordReset} className="mt-8 flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-uls-muted">Email</span>
        <input name="email" type="email" autoComplete="email" required className={publicAuthFieldClass} />
      </label>

      <p className={publicAuthHintClass}>
        For privacy we always ask you to check email, even when no account exists. If you&apos;re unsure which
        address your producer invited, ask them before trying again.
      </p>

      <Button type="submit" variant="primary" className="w-full">
        Send reset link
      </Button>
    </form>
  );
}
