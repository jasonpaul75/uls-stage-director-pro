import Link from "next/link";

export default function ResetInvalidPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-black px-6 text-neutral-50">
      <p className="text-sm uppercase tracking-widest text-amber-500">Password reset</p>
      <h1 className="mt-2 text-2xl font-semibold">Link invalid or expired</h1>
      <p className="mt-3 text-sm text-neutral-400">
        Request another reset email from sign-in — each link expires in around an hour after it is sent.
      </p>
      <Link
        href="/login/forgot-password"
        className="mt-8 rounded border border-neutral-700 px-4 py-2 text-center text-sm text-amber-500 hover:bg-neutral-950"
      >
        Request reset again
      </Link>
      <Link href="/login" className="mt-4 text-center text-xs text-neutral-500 hover:text-amber-400">
        Back to sign in
      </Link>
    </main>
  );
}
