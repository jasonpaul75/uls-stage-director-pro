import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { ProjectRole, ProjectStatus } from "@prisma/client";

export default async function ProducerInboxPage() {
  const projects = await prisma.project.findMany({
    where: { status: ProjectStatus.INTAKE_SUBMITTED },
    orderBy: { submittedAt: "desc" },
    include: {
      memberships: {
        where: { role: ProjectRole.DIRECTOR },
        include: { user: true },
        take: 2,
      },
      assignedTo: { select: { email: true, name: true } },
    },
  });

  return (
    <main className="mx-auto max-w-3xl p-8">
      <nav className="text-sm text-neutral-500">
        <Link href="/producer" className="text-amber-500 hover:text-amber-400">
          ← Command center
        </Link>
      </nav>

      <p className="mt-6 text-sm uppercase tracking-widest text-amber-500">Pipeline</p>
      <h1 className="mt-2 text-2xl font-semibold">Intake inbox</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Director submissions awaiting producer triage ({projects.length}). Open a row to invite directors,
        use Stripe billing (optional), and add internal producer notes — all live on that detail page.
      </p>

      {projects.length === 0 ? (
        <p className="mt-8 text-neutral-400">No open intake submissions.</p>
      ) : (
        <ul className="mt-8 space-y-4">
          {projects.map((p) => {
            const directorEmails = p.memberships.map((m) => m.user.email).join(", ");
            const assigneeLabel = p.assignedTo
              ? (p.assignedTo.name ?? "").trim() || p.assignedTo.email
              : null;

            return (
              <li
                key={p.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/producer/inbox/${p.id}`}
                      className="font-semibold text-amber-400 hover:text-amber-300"
                    >
                      {p.name}
                    </Link>
                    <p className="text-zinc-500">
                      {p.venue}
                      {p.cityState ? ` · ${p.cityState}` : ""}
                    </p>
                    {directorEmails ? (
                      <p className="mt-1 text-zinc-500">
                        Director: <span className="text-zinc-300">{directorEmails}</span>
                      </p>
                    ) : null}
                    {assigneeLabel ? (
                      <p className="mt-1 text-xs text-zinc-600">
                        Assigned: <span className="text-zinc-400">{assigneeLabel}</span>
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                    {p.submittedAt
                      ? new Intl.DateTimeFormat("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(p.submittedAt)
                      : "—"}
                  </span>
                </div>
                {p.additionalNotes ? (
                  <p className="mt-2 border-t border-zinc-800 pt-2 text-zinc-400">{p.additionalNotes}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
