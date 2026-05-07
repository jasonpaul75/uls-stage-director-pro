import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { UlsBrandMark } from "@/components/uls-brand-mark";
import { auth } from "@/auth";
import { GlobalRole } from "@prisma/client";

import { producerSignOutAction } from "./sign-out-action";

function producerLoginCallbackPath(pathname: string | null): string {
  const p = pathname?.trim() || "/producer";
  return p.startsWith("/producer") ? p : "/producer";
}

export default async function ProducerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    const pathname = (await headers()).get("x-pathname");
    const cb = producerLoginCallbackPath(pathname);
    redirect(`/login?callbackUrl=${encodeURIComponent(cb)}`);
  }
  const role = session.user.globalRole;
  if (role !== GlobalRole.PRODUCER && role !== GlobalRole.ULS_ADMIN) {
    redirect("/portal");
  }

  const email = session.user.email?.trim() ?? "";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <a
        href="#producer-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded focus:bg-zinc-100 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-zinc-900 focus:ring-2 focus:ring-amber-600 focus:ring-offset-2 focus:ring-offset-zinc-950 focus:outline-none"
      >
        Skip to main content
      </a>
      <header
        role="banner"
        aria-label="Production workspace"
        className="border-b border-zinc-800/95 bg-zinc-950/90 backdrop-blur-sm"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/producer" className="flex items-center gap-2 text-sm font-medium text-amber-500/95 hover:text-amber-400">
              <UlsBrandMark className="shrink-0" />
              <span>Production</span>
            </Link>
            <nav
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l border-zinc-800 pl-5 text-xs"
              aria-label="Production navigation"
            >
              <Link href="/producer/inbox" className="text-zinc-400 hover:text-amber-400">
                Intake inbox
              </Link>
              <Link href="/producer/media-library" className="text-zinc-400 hover:text-amber-400">
                Media library
              </Link>
              <Link href="/producer/support" className="text-zinc-400 hover:text-amber-400">
                Support queue
              </Link>
              <a href="/producer/inbox/export" className="text-zinc-400 hover:text-amber-400">
                Inbox CSV
              </a>
            </nav>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            {email ? (
              <span className="hidden truncate text-xs text-zinc-500 sm:inline sm:max-w-[16rem]" title={email}>
                {email}
              </span>
            ) : null}
            {role === GlobalRole.ULS_ADMIN ? (
              <>
                <Link
                  href="/producer/admin/users"
                  className="shrink-0 text-xs text-zinc-400 underline-offset-4 hover:text-amber-400 hover:underline"
                >
                  Staff accounts
                </Link>
                <Link
                  href="/portal"
                  className="shrink-0 text-xs text-zinc-400 underline-offset-4 hover:text-amber-400 hover:underline"
                >
                  Director portal
                </Link>
              </>
            ) : null}
            <form action={producerSignOutAction}>
              <button
                type="submit"
                aria-label="Sign out of Production workspace"
                className="rounded border border-zinc-600 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800/80"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
