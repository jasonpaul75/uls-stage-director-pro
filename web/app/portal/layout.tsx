import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { PortalNavPills } from "@/components/portal/portal-nav-pills";
import { PortalUserCluster } from "@/components/portal/portal-user-cluster";
import { PortalVisualBreadcrumb } from "@/components/portal/portal-visual-breadcrumb";
import { SrOnlyWorkspaceBreadcrumbs } from "@/components/sr-only-workspace-breadcrumbs";
import { UlsBrandMark } from "@/components/uls-brand-mark";
import { auth, signOut } from "@/auth";
import { directorHasActivePortalMembership } from "@/lib/director-portal-signin-gate";
import { GlobalRole } from "@prisma/client";

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
    <div className="uls-portal-app min-h-screen bg-transparent text-uls-text">
      <a
        href="#portal-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded focus:bg-zinc-100 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-zinc-900 focus:ring-2 focus:ring-uls-focus-ring focus:ring-offset-2 focus:ring-offset-uls-canvas focus:outline-none"
      >
        Skip to main content
      </a>
      <header
        role="banner"
        aria-label="Director portal"
        className="sticky top-0 z-50 border-b border-white/[0.06] bg-uls-canvas/75 backdrop-blur-xl supports-[backdrop-filter]:bg-uls-canvas/60"
      >
        <div className="relative mx-auto max-w-[1440px] px-4 py-3.5 sm:px-6 lg:py-4 lg:pl-8 lg:pr-8">
          <SrOnlyWorkspaceBreadcrumbs variant="portal" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:gap-6">
            <div className="flex min-w-0 items-start gap-3 sm:items-center">
              <Link
                href="/portal"
                aria-label="Director portal home"
                className="flex shrink-0 items-center rounded-md outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-uls-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-uls-canvas"
              >
                <UlsBrandMark className="shrink-0 text-uls-accent" />
              </Link>
              <PortalVisualBreadcrumb className="min-w-0 pt-0.5 lg:pt-0" />
            </div>

            <div className="flex justify-center">
              <PortalNavPills />
            </div>

            <div className="flex justify-start sm:justify-end">
              <PortalUserCluster email={email} role={role} />
            </div>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
