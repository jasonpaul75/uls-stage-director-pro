import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { PortalShowWorkspaceSections } from "@/components/portal-show-workspace";
import { PortalShowSectionNav } from "@/components/portal-show-section-nav";
import { loadProjectForPortalViewer } from "@/lib/project-access-portal";
import { portalShowSectionNavItems } from "@/lib/portal-show-section-nav";
import { GlobalRole } from "@prisma/client";

type Props = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{ media_reordered?: string; media_err?: string }>;
};

export default async function PortalShowPage(props: Props) {
  const { projectId } = await props.params;
  const search = (await props.searchParams) ?? {};
  const session = await auth();
  const uid = session?.user?.id;
  const role = session?.user?.globalRole;
  if (!uid || role === undefined) {
    redirect("/login?callbackUrl=/portal");
  }

  const project = await loadProjectForPortalViewer(projectId, { userId: uid, globalRole: role });
  if (!project) notFound();

  const isAdmin = role === GlobalRole.ULS_ADMIN;

  const viewerMayReorderShowMedia =
    role === GlobalRole.DIRECTOR &&
    Boolean(project.bookingSecuredAt) &&
    project.showMediaDirectorVisible;

  if (role === GlobalRole.DIRECTOR && !project.bookingSecuredAt) {
    redirect(`/portal/projects/${projectId}?booking=pending`);
  }

  const directorSeesOperational =
    project.postEventVaultDirectorVisible ||
    project.showDayFlagsDirectorVisible ||
    project.runOfShowDirectorVisible ||
    project.showMediaDirectorVisible ||
    project.contractsDirectorVisible ||
    project.stripeBillingDirectorVisible;

  const hasAnyOperationalVisibility = isAdmin || directorSeesOperational;

  const showNavItems = portalShowSectionNavItems(project, isAdmin);

  return (
    <main id="portal-main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-6 lg:px-8">
      <nav className="text-sm text-neutral-600">
        <Link href={`/portal/projects/${projectId}`} className="text-amber-500 hover:text-amber-400">
          Intake &amp; proposal
        </Link>
        {" · "}
        <Link href={`/portal/projects/${projectId}/support`} className="text-amber-500/90 hover:text-amber-400">
          Support
        </Link>
      </nav>
      <p className="mt-6 text-xs uppercase tracking-widest text-amber-500">Show workspace</p>
      <h1 className="mt-1 text-2xl font-semibold text-neutral-100">{project.name}</h1>
      <p className="mt-2 text-xs text-neutral-500">
        Run of show, billing, show-day updates, and post-event links — for confirmed productions.
      </p>

      {search.media_reordered === "1" ? (
        <p className="mt-4 rounded border border-emerald-900/55 bg-emerald-950/35 px-3 py-2 text-sm text-emerald-100">
          Playlist order updated for this production.
        </p>
      ) : null}
      {search.media_err === "not_found" ? (
        <p className="mt-4 text-sm text-red-400">That cue is no longer available — refresh the page.</p>
      ) : null}
      {search.media_err === "bad_order" ? (
        <p className="mt-4 text-sm text-red-400">
          Couldn&apos;t change order — try again or ask your producer if the playlist changed.
        </p>
      ) : null}

      {!hasAnyOperationalVisibility ? (
        <p className="mt-8 text-sm text-neutral-400">
          ULS hasn&apos;t opened operational sections yet. Your producer can enable run of show, show media, contracts mirror,
          Stripe, show-day flags, and post-event delivery in the inbox.
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:justify-center lg:gap-10 xl:gap-14">
        <PortalShowSectionNav items={showNavItems} />
        <div className="min-w-0 flex-1 lg:max-w-lg">
          <PortalShowWorkspaceSections
            project={project}
            isAdmin={isAdmin}
            viewerMayReorderShowMedia={viewerMayReorderShowMedia}
          />

          <p className="mt-10 text-xs text-neutral-600">
            Commercial terms, proposal notes, and your submitted intake summary stay under Intake &amp; proposal — this page
            is for show operations.
          </p>
        </div>
      </div>
    </main>
  );
}
