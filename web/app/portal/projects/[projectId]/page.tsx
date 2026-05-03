import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { loadProjectForPortalViewer } from "@/lib/project-access-portal";
import { GlobalRole } from "@prisma/client";

type Props = { params: Promise<{ projectId: string }> };

function ProposalPanels(props: { title: string; body?: string | null }) {
  const text = props.body?.trim();
  if (!text) return null;

  return (
    <section>
      <h3 className="text-xs uppercase tracking-wide text-neutral-500">{props.title}</h3>
      <pre className="mt-2 whitespace-pre-wrap rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-300">
        {text}
      </pre>
    </section>
  );
}

export default async function PortalProjectDetailPage(props: Props) {
  const { projectId } = await props.params;
  const session = await auth();
  const uid = session?.user?.id;
  const role = session?.user?.globalRole;
  if (!uid || role === undefined) {
    redirect("/login?callbackUrl=/portal");
  }

  const project = await loadProjectForPortalViewer(projectId, { userId: uid, globalRole: role });

  if (!project) notFound();

  const isAdmin = role === GlobalRole.ULS_ADMIN;
  const published = project.proposalDirectorVisible;
  const showProposalDraft = published || isAdmin;

  const hasAnyProposal =
    Boolean(project.proposalPricingNotes?.trim()) ||
    Boolean(project.proposalTechRiderNotes?.trim()) ||
    Boolean(project.proposalCrewNotes?.trim());

  return (
    <main className="mx-auto max-w-lg p-8">
      <nav className="text-sm text-neutral-600">
        <Link href="/portal" className="text-amber-500 hover:text-amber-400">
          ← Portal
        </Link>
      </nav>
      <p className="mt-6 text-xs uppercase tracking-widest text-amber-500">Production</p>
      <h1 className="mt-1 text-2xl font-semibold text-neutral-100">{project.name}</h1>

      <dl className="mt-8 space-y-3 text-sm text-neutral-300">
        <div>
          <dt className="text-neutral-500">Status</dt>
          <dd>
            {project.status === "INTAKE_SUBMITTED" ? "Queued for ULS" : project.status}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Venue</dt>
          <dd>
            {project.venue ?? "—"}
            {project.cityState ? ` · ${project.cityState}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Submitted</dt>
          <dd>{project.submittedAt ? project.submittedAt.toLocaleString() : "—"}</dd>
        </div>
      </dl>

      <div className="mt-10 space-y-6">
        {!showProposalDraft ? (
          <p className="text-sm text-neutral-400">
            ULS hasn&apos;t published proposal details yet. When pricing and rider notes go live here, they&apos;ll
            appear automatically.
          </p>
        ) : null}

        {isAdmin && hasAnyProposal && !published ? (
          <p className="rounded border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-100">
            ULS-admin preview — directors do not see this draft until producers publish from the inbox.
          </p>
        ) : null}

        {showProposalDraft && !hasAnyProposal ? (
          <p className="text-sm text-neutral-500">
            Proposal sections aren&apos;t filled in yet — check back soon.
          </p>
        ) : null}

        {showProposalDraft ? (
          <div className="space-y-6">
            <ProposalPanels title="Pricing & milestones" body={project.proposalPricingNotes} />
            <ProposalPanels title="Technical & rider cues" body={project.proposalTechRiderNotes} />
            <ProposalPanels title="Crew & rehearsal rhythm" body={project.proposalCrewNotes} />
          </div>
        ) : null}
      </div>

      <p className="mt-10 text-xs text-neutral-600">
        Run-of-show, contracts, and payments will deepen here as milestones complete — send questions through your ULS
        producer.
      </p>
    </main>
  );
}
