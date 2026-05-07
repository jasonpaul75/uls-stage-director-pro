import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupportTicketForProject } from "../../../support-ticket-actions";
import { auth } from "@/auth";
import { PortalShowSectionNav } from "@/components/portal-show-section-nav";
import { loadProjectForPortalViewer } from "@/lib/project-access-portal";
import type { PortalShowNavItem } from "@/lib/portal-show-section-nav";
import { prisma } from "@/lib/prisma";
import { GlobalRole } from "@prisma/client";

type Props = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{ created?: string; err?: string }>;
};

export default async function PortalProjectSupportPage(props: Props) {
  const { projectId } = await props.params;
  const sp = (await props.searchParams) ?? {};

  const session = await auth();
  const uid = session?.user?.id;
  const role = session?.user?.globalRole;
  if (!uid || role === undefined) {
    redirect("/login?callbackUrl=/portal");
  }

  const project = await loadProjectForPortalViewer(projectId, { userId: uid, globalRole: role });
  if (!project) {
    redirect("/portal");
  }

  const tickets = await prisma.supportTicket.findMany({
    where: {
      projectId,
      ...(role === GlobalRole.DIRECTOR ? { createdByUserId: uid } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { email: true, name: true } } },
  });

  const booked = Boolean(project.bookingSecuredAt);

  const supportNavItems: PortalShowNavItem[] = [
    { id: "portal-support-new", label: "New ticket" },
    {
      id: "portal-support-tickets",
      label: role === GlobalRole.ULS_ADMIN ? "All tickets" : "Your tickets",
    },
  ];

  return (
    <main id="portal-main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-6 lg:px-8">
      <nav className="text-sm text-neutral-600">
        {booked ? (
          <>
            <Link href={`/portal/shows/${projectId}`} className="text-amber-500 hover:text-amber-400">
              Show workspace
            </Link>
            {" · "}
          </>
        ) : null}
        <Link href={`/portal/projects/${projectId}`} className="text-amber-500/90 hover:text-amber-400">
          Intake
        </Link>
      </nav>
      <p className="mt-6 text-xs uppercase tracking-widest text-amber-500">Production support</p>
      <h1 className="mt-1 text-2xl font-semibold text-neutral-100">{project.name}</h1>
      <p className="mt-3 text-sm text-neutral-500">
        Escalate questions to the ULS production team. Tickets are scoped to this production.
      </p>

      {sp.created === "1" ? (
        <p className="mt-4 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Ticket submitted — a producer will follow up here and by email when needed.
        </p>
      ) : null}
      {sp.err === "required" ? (
        <p className="mt-4 rounded border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-100">
          Enter both a subject and a message.
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:justify-center lg:gap-10 xl:gap-14">
        <PortalShowSectionNav items={supportNavItems} />
        <div className="min-w-0 flex-1 lg:max-w-lg">
      <section id="portal-support-new" className="scroll-mt-6">
        <h2 className="text-sm font-medium text-neutral-200">New ticket</h2>
        <form action={createSupportTicketForProject} className="mt-3 flex flex-col gap-3">
            <input type="hidden" name="projectId" value={projectId} />
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">Subject</span>
              <input
                name="subject"
                required
                maxLength={200}
                className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
                placeholder="Short summary"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">Message</span>
              <textarea
                name="body"
                required
                rows={6}
                maxLength={10000}
                className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
                placeholder="What do you need from ULS?"
              />
            </label>
            <button
              type="submit"
              className="w-fit rounded bg-amber-600 px-4 py-2 text-sm font-medium text-black hover:bg-amber-500"
            >
              Submit ticket
            </button>
          </form>
        </section>

      <section id="portal-support-tickets" className="scroll-mt-6 mt-10">
        <h2 className="text-sm font-medium text-neutral-200">
          {role === GlobalRole.ULS_ADMIN ? "Tickets (all submitters)" : "Your tickets"}
        </h2>
        {tickets.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No tickets yet.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {tickets.map((t) => (
              <li
                key={t.id}
                className="rounded border border-neutral-800 bg-neutral-950/80 px-3 py-3 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-neutral-100">{t.subject}</span>
                  <span
                    className={
                      t.status === "OPEN"
                        ? "text-xs font-medium text-amber-400"
                        : "text-xs font-medium text-neutral-500"
                    }
                  >
                    {t.status === "OPEN" ? "Open" : "Resolved"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  {t.createdAt.toLocaleString()}
                  {role !== GlobalRole.DIRECTOR ? (
                    <span className="text-neutral-600">
                      {" "}
                      · {(t.createdBy.name ?? "").trim() || t.createdBy.email}
                    </span>
                  ) : null}
                </p>
                <pre className="mt-2 whitespace-pre-wrap text-neutral-300">{t.body}</pre>
                {t.producerReply ? (
                  <div className="mt-3 border-t border-neutral-800 pt-3">
                    <p className="text-xs uppercase tracking-wide text-amber-600/90">ULS reply</p>
                    <pre className="mt-1 whitespace-pre-wrap text-neutral-200">{t.producerReply}</pre>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
        </div>
      </div>
    </main>
  );
}
