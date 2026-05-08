import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupportTicketForProject } from "../../../support-ticket-actions";
import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { auth } from "@/auth";
import { PortalShowSectionNav } from "@/components/portal-show-section-nav";
import { loadProjectForPortalViewer } from "@/lib/project-access-portal";
import type { PortalShowNavItem } from "@/lib/portal-show-section-nav";
import { prisma } from "@/lib/prisma";
import { AppShell, Button } from "@/components/ui";
import { portalInputClass } from "@/lib/portal-form-classes";
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
    <AppShell id="portal-main-content" outerMaxWidth="wide" contentMaxWidth="full" className="pt-10">
      <nav className="uls-feedback-banner-in mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm backdrop-blur-sm">
        {booked ? (
          <>
            <Link href={`/portal/shows/${projectId}`} className="text-uls-accent-strong hover:underline">
              Show workspace
            </Link>
            <span aria-hidden className="text-uls-subtle">
              /
            </span>
          </>
        ) : null}
        <Link href={`/portal/projects/${projectId}`} className="text-uls-accent-strong hover:underline">
          Intake
        </Link>
      </nav>

      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-uls-subtle">Production support</p>
        <h1 className="text-pretty text-3xl font-semibold tracking-tight text-uls-text md:text-[2rem]">{project.name}</h1>
        <p className="max-w-prose text-sm leading-relaxed text-uls-muted">
          Escalate questions to the ULS production team. Tickets are scoped to this production.
        </p>
      </header>

      {sp.created === "1" ? (
        <div
          role="status"
          className="uls-feedback-banner-in mt-6 rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.1] px-4 py-3 text-sm text-emerald-50 backdrop-blur-sm"
        >
          Ticket submitted — a producer will follow up here and by email when needed.
        </div>
      ) : null}
      {sp.err === "required" ? (
        <div
          role="alert"
          className="uls-feedback-banner-in mt-6 rounded-2xl border border-rose-500/35 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-50 backdrop-blur-sm"
        >
          Enter both a subject and a message.
        </div>
      ) : null}

      <div className="mt-10 flex flex-col gap-8 lg:flex-row lg:justify-center lg:gap-10 xl:gap-14">
        <PortalShowSectionNav
          items={supportNavItems}
          desktopAriaLabel="Support sections"
          mobileTitle="Jump to section"
          mobileTriggerLabel="Jump to section"
        />
        <div className="min-w-0 flex-1 lg:max-w-lg">
          <section id="portal-support-new" className="scroll-mt-6">
            <ProducerGlassCard>
              <h2 className="text-sm font-semibold text-uls-text">New ticket</h2>
              <form action={createSupportTicketForProject} className="mt-4 flex flex-col gap-3">
                <input type="hidden" name="projectId" value={projectId} />
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-uls-muted">Subject</span>
                  <input
                    name="subject"
                    required
                    maxLength={200}
                    className={portalInputClass}
                    placeholder="Short summary"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-uls-muted">Message</span>
                  <textarea
                    name="body"
                    required
                    rows={6}
                    maxLength={10000}
                    className={portalInputClass}
                    placeholder="What do you need from ULS?"
                  />
                </label>
                <Button type="submit" variant="primary" size="sm" className="w-fit">
                  Submit ticket
                </Button>
              </form>
            </ProducerGlassCard>
          </section>

          <section id="portal-support-tickets" className="scroll-mt-6 mt-10">
            <ProducerGlassCard>
              <h2 className="text-sm font-semibold text-uls-text">
                {role === GlobalRole.ULS_ADMIN ? "Tickets (all submitters)" : "Your tickets"}
              </h2>
              {tickets.length === 0 ? (
                <p className="mt-2 text-sm text-uls-muted">No tickets yet.</p>
              ) : (
                <ul className="mt-4 list-none space-y-3 pl-0">
                  {tickets.map((t) => (
                    <li key={t.id} className="list-none">
                      <ProducerGlassCard as="div" padding="compact" className="transition-[border-color] hover:border-white/[0.12]">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-medium text-uls-text">{t.subject}</span>
                          <span
                            className={
                              t.status === "OPEN"
                                ? "text-xs font-medium text-uls-accent-strong"
                                : "text-xs font-medium text-uls-subtle"
                            }
                          >
                            {t.status === "OPEN" ? "Open" : "Resolved"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-uls-muted">
                          {t.createdAt.toLocaleString()}
                          {role !== GlobalRole.DIRECTOR ? (
                            <span className="text-uls-subtle"> · {(t.createdBy.name ?? "").trim() || t.createdBy.email}</span>
                          ) : null}
                        </p>
                        <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-white/[0.05] bg-black/20 px-2 py-2 text-sm text-uls-muted">
                          {t.body}
                        </pre>
                        {t.producerReply ? (
                          <div className="mt-3 border-t border-white/[0.08] pt-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-uls-accent-strong">ULS reply</p>
                            <pre className="mt-1 whitespace-pre-wrap text-uls-text">{t.producerReply}</pre>
                          </div>
                        ) : null}
                      </ProducerGlassCard>
                    </li>
                  ))}
                </ul>
              )}
            </ProducerGlassCard>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
