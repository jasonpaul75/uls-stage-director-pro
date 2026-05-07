import { Suspense } from "react";

import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center bg-black px-4 py-10 sm:px-6 lg:px-8 text-neutral-50">
      <div className="mx-auto w-full max-w-md">
      <p className="text-sm uppercase tracking-widest text-amber-500">ULS Stage Director PRO</p>
      <h1 className="mt-2 text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Directors onboard through producer-invite emails. Forgot your portal password? Use the reset link below the
        form.
      </p>

      <Suspense fallback={<p className="mt-8 text-sm text-neutral-500">Loading…</p>}>
        <LoginForm />
      </Suspense>
      </div>
    </main>
  );
}
