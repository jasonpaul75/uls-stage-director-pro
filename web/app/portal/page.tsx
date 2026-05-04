import Link from "next/link";
import type { ReactNode } from "react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripeSecretKeyAppearsSandbox } from "@/lib/stripe-admin";
import { directorDocuSignLikelyNeedsAction } from "@/lib/portal-director-helpers";
import { stripeInvoiceBucketsByProject } from "@/lib/stripe-invoice-counts-portal";
import { isDirectorPortalAccessRevoked } from "@/lib/director-portal-access-window";
import { GlobalRole, ProjectRole } from "@prisma/client";

type Props = { searchParams?: Promise<{ submitted?: string; access_ended?: string }> };

export default async function PortalHome(props: Props) {
  const session = await auth();
  const sp = (await props.searchParams) ?? {};

  const rows = session?.user?.id
    ? await prisma.projectMember.findMany({
        where: { userId: session.user.id, role: ProjectRole.DIRECTOR },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              status: true,
              venue: true,
              cityState: true,
              proposalDirectorVisible: true,
              contractsDirectorVisible: true,
              stripeBillingDirectorVisible: true,
              eventConclusionAt: true,
              _count: { select: { docuSignEnvelopes: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const role = session?.user?.globalRole;
  const portalRows =
    role === GlobalRole.DIRECTOR
      ? rows.filter((r) => !isDirectorPortalAccessRevoked(r.project.eventConclusionAt))
      : rows;

  const ids = [...new Set(portalRows.map((r) => r.project.id))];
  const stripeBuckets = await stripeInvoiceBucketsByProject(ids);

  const envelopeRows =
    ids.length > 0
      ? await prisma.projectDocuSignEnvelope.findMany({
          where: { projectId: { in: ids } },
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
    portalRows.length === 0 &&
    rows.length > 0 &&
    role === GlobalRole.DIRECTOR;

  return (
    <main className="mx-auto max-w-lg p-8">
      <p className="text-sm uppercase tracking-widest text-amber-500">Director portal</p>
      <h1 className="mt-2 text-2xl font-semibold">ULS Stage Director PRO</h1>
      <p className="mt-4 text-neutral-400">
        Signed in as{" "}
        <span className="text-neutral-200">{session?.user?.email ?? "unknown"}</span>
      </p>

      {sp.submitted === "1" ? (
        <p className="mt-4 rounded border border-amber-800/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
          Intake submitted. ULS production will reach out — you can watch this project below as it progresses.
        </p>
      ) : null}

      {sp.access_ended === "1" ? (
        <p className="mt-4 rounded border border-rose-900/55 bg-rose-950/35 px-3 py-2 text-sm text-rose-100">
          Director access for that production has ended (90 days after the recorded event conclusion). Contact ULS production if
          you still need materials from that engagement.
        </p>
      ) : null}

      {stripeSandbox ? (
        <p className="mt-4 rounded border border-sky-900/55 bg-sky-950/30 px-3 py-2 text-[11px] leading-relaxed text-sky-100">
          <span className="font-semibold">Stripe test mode:</span> Invoice links and receipts are rehearsal-quality only — use
          test cards until ULS activates live billing.
        </p>
      ) : (
        <p className="mt-4 rounded border border-emerald-950/60 bg-emerald-950/22 px-3 py-2 text-[11px] leading-relaxed text-emerald-100">
          <span className="font-semibold">Live billing:</span> Hosted invoice links move real funds. Keep PDFs from the Stripe
          page for your accounting records.
        </p>
      )}

      <div className="mt-8 flex flex-col gap-4">
        <Link
          href="/portal/intake/new"
          className="rounded-lg border border-amber-700 bg-amber-600/90 px-4 py-3 text-center text-sm font-medium text-black hover:bg-amber-500"
        >
          Start intake request
        </Link>

        <div>
          <h2 className="text-sm font-medium text-neutral-300">Your productions</h2>
          {portalRows.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">
              {emptyDirectorListAllExpired
                ? "Your listed productions are outside the director access window (90 days after event conclusion). Start an intake above for a new event, or contact ULS if you need something from a closed show."
                : "No projects yet — start an intake above."}
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
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
                    <p className="text-xs text-neutral-500">
                      Mirrored DocuSign contract envelope{envelopeCount === 1 ? "" : "s"} ({envelopeCount}) — open detail for
                      status.
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
                    <p className="text-xs font-medium text-rose-400/95">
                      <span className="text-neutral-400">Attention:</span> {parts.join(" · ")}.
                    </p>
                  );
                }

                if (stripePublished) {
                  if (inflight > 0) {
                    stripeNotice = (
                      <p className="text-xs text-amber-500/90">
                        {inflight} Stripe invoice{inflight === 1 ? "" : "s"} (draft or open, awaiting payment) — open this
                        production for pay links.
                      </p>
                    );
                  } else if (total > 0 && uncollectible > 0 && paid === 0) {
                    stripeNotice = (
                      <p className="text-xs text-rose-400/95">
                        Stripe shows a balance flagged uncollectible on this production — coordinate with your ULS producer
                        if that doesn&apos;t line up with your records.
                      </p>
                    );
                  } else if (paid > 0) {
                    stripeNotice = (
                      <p className="text-xs text-emerald-500/90">
                        Latest invoices look settled — open this production for hosted receipts when you need them.
                      </p>
                    );
                  } else if (total > 0) {
                    stripeNotice = (
                      <p className="text-xs text-neutral-500">
                        Stripe invoices are archived or cleared (voided / superseded). Open this production if you still need a
                        paper trail.
                      </p>
                    );
                  }
                }

                return (
                  <li
                    key={project.id}
                    className="rounded border border-neutral-800 bg-neutral-950/80 px-3 py-2 text-sm"
                  >
                    <p className="font-medium text-neutral-100">
                      <Link href={`/portal/projects/${project.id}`} className="text-amber-400 hover:text-amber-300">
                        {project.name}
                      </Link>
                    </p>
                    <p className="text-neutral-500">
                      Status:{" "}
                      <span className="text-neutral-400">
                        {project.status === "INTAKE_SUBMITTED" ? "Queued for ULS" : project.status}
                      </span>
                    </p>
                    {actionBanner}
                    {stripeNotice}
                    {contractNotice}
                    {project.venue ? (
                      <p className="text-neutral-500">
                        Venue:{" "}
                        <span className="text-neutral-400">
                          {project.venue}
                          {project.cityState ? ` · ${project.cityState}` : ""}
                        </span>
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <p className="mt-10 text-xs text-neutral-600">
        Proposal notes, DocuSigned contract mirrors, Stripe invoices, and post-event delivery links each have their own
        on/off toggle in the producer inbox — you only see the sections they enable for this production.
      </p>
    </main>
  );
}
