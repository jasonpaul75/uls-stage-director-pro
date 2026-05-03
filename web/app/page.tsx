import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-black px-6 py-24 text-neutral-50">
      <main className="w-full max-w-xl text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-500">Universal Light &amp; Sound</p>
        <h1 className="mt-3 text-3xl font-semibold">ULS Stage Director PRO</h1>
        <p className="mt-4 text-neutral-400">
          Internal desk and director portal scaffolding. Configure <code className="text-neutral-300">DATABASE_URL</code>{" "}
          and{" "}
          <code className="text-neutral-300">AUTH_SECRET</code>, then run migrations.
        </p>
        <nav className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Link
            className="rounded bg-amber-600 px-5 py-2.5 text-sm font-medium text-black hover:bg-amber-500"
            href="/login"
          >
            Sign in
          </Link>
          <Link
            className="rounded border border-neutral-700 px-5 py-2.5 text-sm text-neutral-200 hover:border-neutral-500"
            href="/portal"
          >
            Director portal (auth)
          </Link>
          <Link
            className="rounded border border-neutral-700 px-5 py-2.5 text-sm text-neutral-200 hover:border-neutral-500"
            href="/producer"
          >
            Production
          </Link>
        </nav>
      </main>
    </div>
  );
}
