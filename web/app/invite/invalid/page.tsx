import Link from "next/link";

export default function InviteInvalidPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center bg-black px-4 py-10 sm:px-6 lg:px-8 text-neutral-50">
      <div className="mx-auto w-full max-w-md">
      <p className="text-sm uppercase tracking-widest text-amber-500">Invite link</p>
      <h1 className="mt-2 text-2xl font-semibold">Link invalid or expired</h1>
      <p className="mt-3 text-sm text-neutral-400">
        Ask your ULS producer for a fresh invite email, then open the link from that message again.
      </p>
      <Link
        href="/login"
        className="mt-8 rounded border border-neutral-700 px-4 py-2 text-center text-sm text-amber-500 hover:bg-neutral-950"
      >
        Go to sign in
      </Link>
      </div>
    </main>
  );
}
