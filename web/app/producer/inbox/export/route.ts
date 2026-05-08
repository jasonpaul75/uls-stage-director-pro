import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  directorPortalAccessDeadlineUtc,
  directorPortalProducerInboxCue,
} from "@/lib/director-portal-access-window";
import { prisma } from "@/lib/prisma";
import { tallyStripeInvoiceStatuses } from "@/lib/stripe-invoice-status-counts";
import { GlobalRole, ProjectRole, ProjectStatus } from "@prisma/client";

function csvEscape(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const v = typeof value === "string" ? value : String(value);
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function directorPortalAccessCsvState(eventConclusionAt: Date | null): string {
  if (eventConclusionAt == null) return "no_conclusion_date";
  const cue = directorPortalProducerInboxCue(eventConclusionAt);
  if (cue?.kind === "access_ended") return "closed";
  if (cue?.kind === "access_ending_soon") return "ending_soon";
  return "open";
}

export async function GET() {
  const session = await auth();
  const role = session?.user?.globalRole as GlobalRole | undefined;
  if (!session?.user?.id || (role !== GlobalRole.PRODUCER && role !== GlobalRole.ULS_ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const projects = await prisma.project.findMany({
    where: { status: ProjectStatus.INTAKE_SUBMITTED },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      name: true,
      venue: true,
      cityState: true,
      submittedAt: true,
      stripeCustomerId: true,
      eventConclusionAt: true,
      memberships: {
        where: { role: ProjectRole.DIRECTOR },
        select: { user: { select: { email: true } } },
      },
      assignedTo: { select: { email: true } },
      stripeInvoices: {
        select: { status: true, amountDueCents: true, attemptCount: true },
      },
      _count: {
        select: { directorShares: true },
      },
    },
  });

  /**
   * CSV schema is stable for external BI. Column `director_production_file_count` is the count of ProjectDirectorShare rows
   * (portal “Production files” / director reference AV) — not curated show-media playlist cues.
   */
  const header = [
    "production_id",
    "production_name",
    "director_emails",
    "venue",
    "city_state",
    "submitted_at_utc",
    "assigned_producer_email",
    "stripe_customer_linked",
    "stripe_count_draft",
    "stripe_count_open",
    "stripe_count_paid",
    "stripe_count_void",
    "stripe_count_uncollectible",
    "stripe_count_other",
    "stripe_open_invoice_retry_activity",
    "event_conclusion_at_utc",
    "director_portal_access_deadline_utc",
    "director_portal_access_state",
    "director_production_file_count",
  ].join(",");

  const rows = projects.map((p) => {
    const directors = p.memberships.map((m) => m.user.email).join("; ");

    const c = tallyStripeInvoiceStatuses(p.stripeInvoices);
    const openRetrySeen = p.stripeInvoices.some(
      (inv) =>
        inv.status === "open" &&
        typeof inv.amountDueCents === "number" &&
        inv.amountDueCents > 0 &&
        typeof inv.attemptCount === "number" &&
        inv.attemptCount > 0,
    );

    const conclusionIso = p.eventConclusionAt?.toISOString() ?? "";
    const portalDeadlineIso =
      p.eventConclusionAt != null ? directorPortalAccessDeadlineUtc(p.eventConclusionAt).toISOString() : "";
    const portalState = directorPortalAccessCsvState(p.eventConclusionAt);

    return [
      csvEscape(p.id),
      csvEscape(p.name),
      csvEscape(directors),
      csvEscape(p.venue),
      csvEscape(p.cityState),
      csvEscape(p.submittedAt?.toISOString() ?? ""),
      csvEscape(p.assignedTo?.email ?? ""),
      p.stripeCustomerId ? "yes" : "no",
      c.draft,
      c.open,
      c.paid,
      c.void,
      c.uncollectible,
      c.other,
      openRetrySeen ? "yes" : "no",
      csvEscape(conclusionIso),
      csvEscape(portalDeadlineIso),
      csvEscape(portalState),
      p._count.directorShares,
    ].join(",");
  });

  const body = `\uFEFF${header}\n${rows.join("\n")}\n`;

  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="uls-intake-inbox-${day}.csv"`,
    },
  });
}
