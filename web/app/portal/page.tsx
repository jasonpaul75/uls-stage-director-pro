import Link from "next/link";
import type { ReactNode } from "react";

import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { AppShell, buttonClassName } from "@/components/ui";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripeSecretKeyAppearsSandbox } from "@/lib/stripe-admin";
import { directorDocuSignLikelyNeedsAction } from "@/lib/portal-director-helpers";
import { stripeInvoiceBucketsByProject } from "@/lib/stripe-invoice-counts-portal";
import { isDirectorPortalAccessRevoked } from "@/lib/director-portal-access-window";
import { GlobalRole, Prisma, ProjectRole } from "@prisma/client";

type Props = { searchParams?: Promise<{ submitted?: string; access_ended?: string }> };

function Banner(props: {
  children: ReactNode;
  className: string;
  /** Optional landmark for assistive tech (banner flashes after redirects). */
  role?: "alert" | "status";
}) {
  const { children, className, role } = props;
  return (
    <div role={role} className={`uls-feedback-banner-in rounded-2xl border px-4 py-3 text-sm backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

export default async function PortalHome(props: Props) {
  const session = await auth();
  const sp = (await props.searchParams) ?? {};

  const role = session?.user?.globalRole;
  const uid = session?.user?.id;

  const portalProjectSelect = {
    id: true,
    name: true,
    status: true,
    venue: true,
    cityState: true,
    bookingSecuredAt: true,
    proposalDirectorVisible: true,
    contractsDirectorVisible: true,
    stripeBillingDirectorVisible: true,
    eventConclusionAt: true,
    _count: { select: { docuSignEnvelopes: true } },
  } as const;

  type PortalHomeProject = Prisma.ProjectGetPayload<{ select: typeof portalProjectSelect }>;
  let portalRows: Array<{ project: PortalHomeProject }> = [];
  let directorMembershipCount = 0;

  if (uid && role === GlobalRole.ULS_ADMIN) {
    const projects = await prisma.project.findMany({
      select: portalProjectSelect,
      orderBy: [{ submittedAt: "desc" }, { updatedAt: "desc" }],
      take: 400,
    });
    portalRows = projects.map((project) => ({ project }));
  } else if (uid) {
    const rows = await prisma.projectMember.findMany({
      where: { userId: uid, role: ProjectRole.DIRECTOR },
      include: {
        project: {
          select: portalProjectSelect,
        },
      },
      orderBy: { createdAt: "desc" },
    });
    directorMembershipCount = rows.length;
    portalRows =
      role === GlobalRole.DIRECTOR
        ? rows.filter((r) => !isDirectorPortalAccessRevoked(r.project.eventConclusionAt))
        : rows;
  } else {
    portalRows = [];
  }

  const ids = [...new Set(portalRows.map((r) => r.project.id))];
  const stripeBuckets = await stripeInvoiceBucketsByProject(ids);

  /** Settled statuses never drive “needs action” cues on portal home — skip loading those rows. */
  const docuSignPortalHomeSettled = ["completed", "voided", "declined", "deleted"] as const;

  const envelopeRows =
    ids.length > 0
      ? await prisma.projectDocuSignEnvelope.findMany({
          where: {
            projectId: { in: ids },
            NOT: {
              status: {
                in: [...docuSignPortalHomeSettled],
                mode: "insensitive",
              },
            },
          },
          select: { projectId: true, status: true },
        })
      : [];

  function envelopeNeedsAttention(projectId: string): boolean {
    return envelopeRows.some(
      (r) => r.projectId === projectId && directorDocuSignLikelyNeedsAction(r.status),
    );
  }

  const stripeSandbox = stripeSecretKeyAppearsSandbox();

  const emptyDirectorListAllExpired =
    portalRows.length === 0 && directorMembershipCount > 0 && role === GlobalRole.DIRECTOR;

  const isStaffAdminView = role === GlobalRole.ULS_ADMIN;

  const hint = isStaffAdminView
    ? "Staff overview — every production in the database (newest first)."
    : role === GlobalRole.DIRECTOR
      ? "Within the 90-day access window after event conclusion."
      : "All director memberships";

  return (
    <AppShell id="portal-main-content" outerMaxWidth="wide" contentMaxWidth="full" className="pt-10">
      <div className="space-y-8">
        <header className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-uls-subtle">
            {isStaffAdminView ? "Staff portal overview" : "Director portal"}
          </p>
          <h1 className="text-pretty text-3xl font-semibold tracking-tight text-uls-text md:text-[2rem]">
            ULS Stage Director PRO
          </h1>
          <p className="max-w-prose text-sm leading-relaxed text-uls-muted">
            Signed in as <span className="text-uls-text">{session?.user?.email ?? "unknown"}</span>
          </p>
        </header>

        {sp.submitted === "1" ? (
          <Banner role="status" className="border-amber-500/35 bg-amber-500/[0.08] text-amber-50">
            Intake submitted. ULS production will reach out — you can watch your project below as it progresses.
          </Banner>
        ) : null}

        {sp.access_ended === "1" ? (
          <Banner role="alert" className="border-rose-500/35 bg-rose-500/[0.08] text-rose-50">
            Director access for that production has ended (90 days after the recorded event conclusion). Contact ULS production
            if you still need materials from that engagement.
          </Banner>
        ) : null}

        {stripeSandbox ? (
          <Banner role="status" className="border-sky-500/30 bg-sky-500/[0.07] text-[11px] leading-relaxed text-sky-100">
            <span className="font-semibold">Stripe test mode:</span> Invoice links and receipts are rehearsal-quality only — use test
            cards until ULS activates live billing.
          </Banner>
        ) : (
          <Banner role="status" className="border-emerald-500/28 bg-emerald-500/[0.07] text-[11px] leading-relaxed text-emerald-100">
            <span className="font-semibold">Live billing:</span> Hosted invoice links move real funds. Keep PDFs from the Stripe page for
            your accounting records.
          </Banner>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,260px)_1fr] sm:items-stretch md:gap-4">
          <ProducerGlassCard padding="compact" className="relative overflow-hidden">
            <span
              aria-hidden
              className="pointer-events-none absolute -right-4 -top-6 h-20 w-20 rounded-full bg-violet-500/18 blur-2xl"
            />
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-uls-muted">
              {isStaffAdminView ? "All productions" : "Productions"}
            </p>
            <p className="mt-1.5 tabular-nums text-2xl font-semibold tracking-tight text-uls-text">{portalRows.length}</p>
            <p className="mt-2 text-[11px] leading-snug text-uls-subtle">{hint}</p>
          </ProducerGlassCard>

          <ProducerGlassCard padding="compact" className="flex items-center justify-center sm:justify-end md:justify-center lg:justify-end">
            <Link
              href="/portal/intake/new"
              className={buttonClassName("primary", "md", "w-full justify-center sm:w-auto")}
            >
              Start intake request
            </Link>
          </ProducerGlassCard>
        </div>

        <ProducerGlassCard>
          <h2 className="text-sm font-semibold text-uls-text">
            {isStaffAdminView ? "All productions (staff)" : "Your productions"}
          </h2>
          <p className="mt-1 text-xs text-uls-muted">
            {isStaffAdminView ? (
              <>
                Cross-show overview as ULS admin — open any project for director-visible milestones and secured-booking workspace.
              </>
            ) : (
              <>
                Intake summarizes commercial milestones; once ULS secures booking, jump to{" "}
                <span className="text-uls-subtle">show workspace</span> for run of show, published show media,{" "}
                <span className="text-uls-subtle">Production files</span> (reference audio/video handoffs), show-day, and post-event.
              </>
            )}
          </p>
          {portalRows.length === 0 ? (
            <p role="status" className="mt-4 text-sm leading-relaxed text-uls-muted">
              {emptyDirectorListAllExpired
                ? "Your listed productions are outside the director access window (90 days after event conclusion). Start an intake above for a new event, or contact ULS if you need something from a closed show."
                : isStaffAdminView
                  ? "No projects in the database yet."
                  : "No projects yet — start an intake above."}
            </p>
          ) : (
            <ul className="mt-5 space-y-3">
              {portalRows.map(({ project }) => {
                const b = stripeBuckets.get(project.id);
                const inflight = (b?.draft ?? 0) + (b?.open ?? 0);
                const total = b?.total ?? 0;
                const paid = b?.paid ?? 0;
                const uncollectible = b?.uncollectible ?? 0;

                let stripeNotice: ReactNode = null;

                const contractsPublished = project.contractsDirectorVisible;
                const stripePublished = project.stripeBillingDirectorVisible;
                const envelopeCount = project._count.docuSignEnvelopes;

                let contractNotice: ReactNode = null;
                if (contractsPublished && envelopeCount > 0) {
                  contractNotice = (
                    <p role="status" className="text-xs text-uls-subtle">
                      Mirrored DocuSign contract envelope{envelopeCount === 1 ? "" : "s"} ({envelopeCount}) — open detail for status.
                    </p>
                  );
                }

                const needSignature = contractsPublished && envelopeNeedsAttention(project.id);
                const needPayment = stripePublished && inflight > 0;

                let actionBanner: ReactNode = null;
                if (needSignature || needPayment) {
                  const parts = [
                    ...(needPayment ? ["open invoice balance due"] : []),
                    ...(needSignature ? ["DocuSign agreement still in progress"] : []),
                  ];
                  actionBanner = (
                    <p role="status" className="text-xs font-medium text-rose-300/95">
                      <span className="text-uls-muted">Attention:</span> {parts.join(" · ")}.
                    </p>
                  );
                }

                if (stripePublished) {
                  if (inflight > 0) {
                    stripeNotice = (
                      <p role="status" className="text-xs text-uls-accent-strong/95">
                        {inflight} Stripe invoice{inflight === 1 ? "" : "s"} (draft or open, awaiting payment) — open this production for
                        pay links.
                      </p>
                    );
                  } else if (total > 0 && uncollectible > 0 && paid === 0) {
                    stripeNotice = (
                      <p role="status" className="text-xs text-rose-300/95">
                        Stripe shows a balance flagged uncollectible on this production — coordinate with your ULS producer if
                        that doesn&apos;t line up with your records.
                      </p>
                    );
                  } else if (paid > 0) {
                    stripeNotice = (
                      <p role="status" className="text-xs text-emerald-400/90">
                        Latest invoices look settled — open this production for hosted receipts when you need them.
                      </p>
                    );
                  } else if (total > 0) {
                    stripeNotice = (
                      <p role="status" className="text-xs text-uls-subtle">
                        Stripe invoices are archived or cleared (voided / superseded). Open this production if you still need a paper
                        trail.
                      </p>
                    );
                  }
                }

                const projectHref = project.bookingSecuredAt
                  ? `/portal/shows/${project.id}`
                  : `/portal/projects/${project.id}`;

                return (
                  <li key={project.id}>
                    <ProducerGlassCard padding="compact" className="transition-[border-color,box-shadow] hover:border-white/[0.12]">
                      <p className="font-medium leading-snug text-uls-text">
                        <Link href={projectHref} className="text-uls-accent-strong hover:text-uls-accent-strong/90 hover:underline">
                          {project.name}
                        </Link>
                        {project.bookingSecuredAt ? (
                          <span className="ml-2 inline-block align-middle text-[10px] font-semibold uppercase tracking-wide text-emerald-400/90">
                            Show workspace
                          </span>
                        ) : (
                          <span className="ml-2 inline-block align-middle text-[10px] font-semibold uppercase tracking-wide text-uls-muted">
                            Intake
                          </span>
                        )}
                      </p>
                      <p className="mt-1.5 text-xs text-uls-muted">
                        Status:{" "}
                        <span className="text-uls-text">{project.status === "INTAKE_SUBMITTED" ? "Queued for ULS" : project.status}</span>
                      </p>
                      {actionBanner ? <div className="mt-2">{actionBanner}</div> : null}
                      {stripeNotice ? <div className="mt-1.5">{stripeNotice}</div> : null}
                      {contractNotice ? <div className="mt-1.5">{contractNotice}</div> : null}
                      {project.venue ? (
                        <p className="mt-1.5 text-xs text-uls-muted">
                          Venue:{" "}
                          <span className="text-uls-text">
                            {project.venue}
                            {project.cityState ? ` · ${project.cityState}` : ""}
                          </span>
                        </p>
                      ) : null}
                    </ProducerGlassCard>
                  </li>
                );
              })}
            </ul>
          )}
        </ProducerGlassCard>

        <p className="text-xs leading-relaxed text-uls-subtle">
          Proposal, contracts, and billing visibility follow each toggle in the producer inbox. Support stays on your project&apos;s{" "}
          <span className="text-uls-muted">support</span> route before and after booking.
        </p>
      </div>
    </AppShell>
  );
}
