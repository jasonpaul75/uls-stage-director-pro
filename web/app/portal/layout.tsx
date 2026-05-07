import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { UlsBrandMark } from "@/components/uls-brand-mark";
import { auth, signOut } from "@/auth";
import { directorHasActivePortalMembership } from "@/lib/director-portal-signin-gate";
import { GlobalRole } from "@prisma/client";

import { portalSignOutAction } from "./sign-out-action";

function portalLoginCallbackPath(pathname: string | null): string {
  const p = pathname?.trim() || "/portal";
  return p.startsWith("/portal") ? p : "/portal";
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    const pathname = (await headers()).get("x-pathname");
    const cb = portalLoginCallbackPath(pathname);
    redirect(`/login?callbackUrl=${encodeURIComponent(cb)}`);
  }
  const role = session.user.globalRole;
  if (role !== GlobalRole.DIRECTOR && role !== GlobalRole.ULS_ADMIN) {
    redirect("/producer");
  }
  if (role === GlobalRole.DIRECTOR) {
    const allowed = await directorHasActivePortalMembership(session.user.id);
    if (!allowed) {
      await signOut({ redirectTo: "/login?error=portal_access_ended&callbackUrl=%2Fportal" });
    }
  }
  const email = session.user.email?.trim() ?? "";
  return (
    <div className="min-h-screen bg-black text-neutral-50">
      <a
        href="#portal-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded focus:bg-neutral-100 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-neutral-900 focus:ring-2 focus:ring-amber-600 focus:ring-offset-2 focus:ring-offset-black focus:outline-none"
      >
        Skip to main content
      </a>
      <header
        role="banner"
        aria-label="Director portal"
        className="border-b border-neutral-900/85 bg-neutral-950/90 backdrop-blur-sm"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/portal" className="flex items-center gap-2 text-sm font-medium text-amber-500/95 hover:text-amber-400">
              <UlsBrandMark className="shrink-0 text-amber-500" />
              <span>Director portal</span>
            </Link>
            <nav
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l border-neutral-800 pl-5 text-xs"
              aria-label="Director portal navigation"
            >
              <Link href="/portal/intake/new" className="text-neutral-400 hover:text-amber-400">
                New intake
              </Link>
            </nav>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            {email ? (
              <span className="hidden truncate text-xs text-neutral-500 sm:inline sm:max-w-[16rem]" title={email}>
                {email}
              </span>
            ) : null}
            {role === GlobalRole.ULS_ADMIN ? (
              <Link
                href="/producer"
                className="shrink-0 text-xs text-neutral-400 underline-offset-4 hover:text-amber-400 hover:underline"
              >
                Production
              </Link>
            ) : null}
            <form action={portalSignOutAction}>
              <button
                type="submit"
                aria-label="Sign out of Director portal"
                className="rounded border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-900"
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
