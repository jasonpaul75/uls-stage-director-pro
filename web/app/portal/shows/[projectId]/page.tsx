import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { PortalShowWorkspaceSections } from "@/components/portal-show-workspace";
import { PortalShowSectionNav } from "@/components/portal-show-section-nav";
import { loadProjectForPortalViewer } from "@/lib/project-access-portal";
import { portalShowSectionNavItems } from "@/lib/portal-show-section-nav";
import { AppShell } from "@/components/ui";
import { DIRECTOR_SHARE_ERR_COPY } from "@/lib/director-share-err-copy";
import { SHOW_MEDIA_ERR_COPY } from "@/lib/show-media-err-copy";
import { GlobalRole } from "@prisma/client";

type Props = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{ media_reordered?: string; media_err?: string; ds_uploaded?: string; ds_deleted?: string; ds_err?: string }>;
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
    project.stripeBillingDirectorVisible ||
    Boolean(
      project.stageDesign &&
        project.stageDesignDirectorVisible,
    );

  const hasAnyOperationalVisibility = isAdmin || directorSeesOperational;

  const showNavItems = portalShowSectionNavItems(project, isAdmin);

  return (
    <AppShell id="portal-main-content" outerMaxWidth="wide" contentMaxWidth="full" className="pt-10">
      <nav className="uls-feedback-banner-in mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm backdrop-blur-sm">
        <Link href={`/portal/projects/${projectId}`} className="text-uls-accent-strong hover:underline">
          Intake &amp; proposal
        </Link>
        <span aria-hidden className="text-uls-subtle">
          /
        </span>
        <Link href={`/portal/projects/${projectId}/support`} className="text-uls-accent-strong hover:underline">
          Support
        </Link>
      </nav>

      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-uls-subtle">Show workspace</p>
        <h1 className="text-pretty text-3xl font-semibold tracking-tight text-uls-text md:text-[2rem]">{project.name}</h1>
        <p className="max-w-prose text-sm leading-relaxed text-uls-muted">
          Run of show, billing, show-day updates, and post-event links — for confirmed productions.
        </p>
      </header>

      {search.media_reordered === "1" ? (
        <div
          role="status"
          className="uls-feedback-banner-in mt-6 rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.1] px-4 py-3 text-sm text-emerald-50 backdrop-blur-sm"
        >
          Playlist order updated for this production.
        </div>
      ) : null}
      {typeof search.media_err === "string" && SHOW_MEDIA_ERR_COPY[search.media_err] ? (
        <p role="alert" className="mt-4 text-sm text-rose-300">
          {SHOW_MEDIA_ERR_COPY[search.media_err]}
        </p>
      ) : typeof search.media_err === "string" ? (
        <p role="alert" className="mt-4 text-sm text-rose-300">
          Couldn&apos;t update show media — try again or contact support.
        </p>
      ) : null}
      {search.ds_uploaded === "1" ? (
        <div
          role="status"
          className="uls-feedback-banner-in mt-6 rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.1] px-4 py-3 text-sm text-emerald-50 backdrop-blur-sm"
        >
          Uploaded — find it under <span className="font-medium text-emerald-100">Production files</span> below. ULS production
          staff can download it from the intake record or event workspace.
        </div>
      ) : null}
      {search.ds_deleted === "1" ? (
        <div
          role="status"
          className="uls-feedback-banner-in mt-6 rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.1] px-4 py-3 text-sm text-emerald-50 backdrop-blur-sm"
        >
          File removed from the portal.
        </div>
      ) : null}
      {typeof search.ds_err === "string" && DIRECTOR_SHARE_ERR_COPY[search.ds_err] ? (
        <p role="alert" className="mt-4 text-sm text-rose-300">
          {DIRECTOR_SHARE_ERR_COPY[search.ds_err]}
        </p>
      ) : typeof search.ds_err === "string" ? (
        <p role="alert" className="mt-4 text-sm text-rose-300">
          Couldn&apos;t complete that file action — try again or contact support.
        </p>
      ) : null}

      {!hasAnyOperationalVisibility && isAdmin ? (
        <div
          role="status"
          className="mt-8 rounded-2xl border border-white/[0.08] bg-uls-surface/30 px-4 py-4 text-sm text-uls-muted backdrop-blur-xl shadow-[inset_0_1px_0_0_rgb(255_255_255/0.06),0_12px_40px_rgb(0_0_0/0.35)]"
        >
          ULS hasn&apos;t opened operational sections yet. Your producer can enable run of show, stage diagram (v3), show media, contracts mirror, Stripe,
          show-day flags, and post-event delivery in the inbox.
        </div>
      ) : null}

      <div className="mt-10 flex flex-col gap-8 lg:flex-row lg:justify-center lg:gap-10 xl:gap-14">
        <PortalShowSectionNav
          items={showNavItems}
          desktopAriaLabel="Show workspace sections"
          mobileTitle="Jump to section"
          mobileTriggerLabel="Jump to section"
        />
        <div className="min-w-0 flex-1 lg:max-w-lg">
          <PortalShowWorkspaceSections
            project={project}
            isAdmin={isAdmin}
            viewerMayReorderShowMedia={viewerMayReorderShowMedia}
            viewerUserId={uid}
            canUploadDirectorShares={role === GlobalRole.DIRECTOR}
          />

          <p className="mt-10 text-xs leading-relaxed text-uls-subtle">
            Commercial terms, proposal notes, and your submitted intake summary stay under Intake &amp; proposal — this page is for show
            operations.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
