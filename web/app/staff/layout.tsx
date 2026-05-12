import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { StaffNavPills } from "@/components/staff/staff-nav-pills";
import { StaffUserCluster } from "@/components/staff/staff-user-cluster";
import { UlsBrandMark } from "@/components/uls-brand-mark";
import { auth } from "@/auth";
import { GlobalRole } from "@prisma/client";

function staffLoginCallbackPath(pathname: string | null): string {
  const p = pathname?.trim() || "/staff";
  return p.startsWith("/staff") ? p : "/staff";
}

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    const pathname = (await headers()).get("x-pathname");
    const cb = staffLoginCallbackPath(pathname);
    redirect(`/login?callbackUrl=${encodeURIComponent(cb)}`);
  }

  const role = session.user.globalRole;
  if (role === GlobalRole.STAFF) {
    /* ok */
  } else if (role === GlobalRole.PRODUCER || role === GlobalRole.ULS_ADMIN) {
    redirect("/producer");
  } else {
    redirect("/portal");
  }

  const email = session.user.email?.trim() ?? "";

  return (
    <div className="uls-producer-app min-h-screen bg-transparent text-uls-text">
      <a
        href="#staff-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded focus:bg-zinc-100 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-zinc-900 focus:ring-2 focus:ring-uls-focus-ring focus:ring-offset-2 focus:ring-offset-uls-canvas focus:outline-none"
      >
        Skip to main content
      </a>
      <header
        role="banner"
        aria-label="Crew workspace"
        className="sticky top-0 z-50 border-b border-white/[0.06] bg-uls-canvas/75 backdrop-blur-xl supports-[backdrop-filter]:bg-uls-canvas/60"
      >
        <div className="relative mx-auto max-w-[1440px] px-4 py-3.5 sm:px-6 lg:py-4 lg:pl-8 lg:pr-8">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:gap-6">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/staff"
                aria-label="Crew home"
                className="flex shrink-0 items-center rounded-md outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-uls-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-uls-canvas"
              >
                <UlsBrandMark className="shrink-0 text-uls-accent" />
              </Link>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-uls-subtle">Internal crew</p>
            </div>

            <div className="flex justify-center lg:justify-center">
              <StaffNavPills />
            </div>

            <div className="flex justify-start sm:justify-end">
              <StaffUserCluster email={email} />
            </div>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
