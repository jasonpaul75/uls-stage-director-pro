import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { AppShell, Button, buttonClassName } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { producerCrewQuestionnaireRollup } from "@/lib/producer-crew-questionnaire-stats";
import { formatMoneyFromCents, normalizedStripeCurrencyCode } from "@/lib/stripe-invoice-ui";
import { GlobalRole, ProjectStatus, StaffAvailabilityStatus } from "@prisma/client";

import {
  addProjectExpenseLine,
  assignCrewMember,
  deleteProjectExpenseLine,
  prepareCrewQuestionnaires,
  removeCrewAssignment,
  updateCrewDuties,
} from "./actions";

type Props = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | undefined>>;
};

function crewFlash(sp: Record<string, string | undefined>): ReactNode {
  if (sp.crew_saved === "1") {
    return (
      <ProducerGlassCard padding="compact" className="border-emerald-500/25 bg-emerald-950/25">
        <p role="status" className="text-sm text-emerald-100">
          Crew / questionnaire / expense ledger updated.
        </p>
      </ProducerGlassCard>
    );
  }
  const err = sp.crew_err;
  const msg =
    err === "no_staff"
      ? "Pick a crew member before assigning."
      : err === "bad_staff"
        ? "That staff account is unavailable."
        : err === "missing"
          ? "Record missing — refresh and retry."
          : err === "no_assign"
            ? "Assign crew before preparing questionnaires."
            : err === "exp_bad"
              ? "Expense label, category, and a numeric USD amount are required."
              : null;
  if (!msg) return null;
  return (
    <ProducerGlassCard padding="compact" className="border-rose-500/25 bg-rose-950/25">
      <p role="alert" className="text-sm text-rose-100">
        {msg}
      </p>
    </ProducerGlassCard>
  );
}

function availabilityStatusLabel(status: StaffAvailabilityStatus): string {
  return status === StaffAvailabilityStatus.AVAILABLE ? "Available" : "Unavailable";
}

function CrewAvailabilitySnippet({
  rows,
}: {
  rows: { id: string; date: Date; status: StaffAvailabilityStatus; note: string | null }[];
}) {
  const trimmed = rows.slice(0, 16);
  if (trimmed.length === 0) {
    return (
      <p className="mt-2 text-[10px] leading-relaxed text-uls-subtle">
        No availability logged in the rolling window (crew marks holds under Staff → Availability).
      </p>
    );
  }
  return (
    <ul className="mt-2 space-y-0.5 text-[10px] leading-snug text-uls-muted">
      {trimmed.map((d) => (
        <li key={d.id}>
          <span className="tabular-nums text-uls-subtle">{d.date.toISOString().slice(0, 10)}</span>
          {" · "}
          <span className="font-medium text-uls-text">{availabilityStatusLabel(d.status)}</span>
          {d.note?.trim() ? <span className="text-uls-subtle"> — {d.note.trim().slice(0, 96)}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export default async function ProducerIntakeCrewPage(props: Props) {
  const { projectId } = await props.params;
  const sp = (await props.searchParams) ?? {};

  const project = await prisma.project.findFirst({
    where: { id: projectId, status: ProjectStatus.INTAKE_SUBMITTED },
    select: {
      id: true,
      name: true,
      requestedEventStart: true,
      requestedEventEnd: true,
      venue: true,
      cityState: true,
    },
  });
  if (!project) notFound();

  const [staffUsers, assignments, questionnaires, expenseLines, stripeInvoices] = await Promise.all([
    prisma.user.findMany({
      where: { globalRole: GlobalRole.STAFF, disabledAt: null },
      select: { id: true, email: true, name: true },
      orderBy: { email: "asc" },
    }),
    prisma.projectStaffAssignment.findMany({
      where: { projectId },
      include: { staffUser: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.staffEventQuestionnaire.findMany({
      where: { projectId },
      include: { staffUser: { select: { email: true, name: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.projectExpenseLine.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.projectStripeInvoice.findMany({
      where: { projectId },
      select: {
        status: true,
        amountDueCents: true,
        amountPaidCents: true,
        totalCents: true,
        currency: true,
      },
    }),
  ]);

  const staffIdsForAvail = [...new Set(assignments.map((a) => a.staffUserId))];
  const horizonToday = new Date();
  const availStart = new Date(
    Date.UTC(horizonToday.getUTCFullYear(), horizonToday.getUTCMonth(), horizonToday.getUTCDate()),
  );
  availStart.setUTCDate(availStart.getUTCDate() - 14);
  const availEnd = new Date(
    Date.UTC(horizonToday.getUTCFullYear(), horizonToday.getUTCMonth(), horizonToday.getUTCDate()),
  );
  availEnd.setUTCDate(availEnd.getUTCDate() + 120);

  const availabilityRows =
    staffIdsForAvail.length === 0
      ? []
      : await prisma.staffAvailabilityDay.findMany({
          where: {
            userId: { in: staffIdsForAvail },
            date: { gte: availStart, lte: availEnd },
          },
          orderBy: { date: "asc" },
          select: { id: true, userId: true, date: true, status: true, note: true },
        });

  const availabilityByUserId = new Map<
    string,
    { id: string; date: Date; status: StaffAvailabilityStatus; note: string | null }[]
  >();
  for (const row of availabilityRows) {
    const list = availabilityByUserId.get(row.userId) ?? [];
    list.push(row);
    availabilityByUserId.set(row.userId, list);
  }

  const taxDocs =
    assignments.length === 0
      ? []
      : await prisma.staffTaxDocument.findMany({
          where: { userId: { in: assignments.map((a) => a.staffUserId) } },
          orderBy: { uploadedAt: "desc" },
          select: {
            id: true,
            userId: true,
            kind: true,
            fileName: true,
            uploadedAt: true,
          },
        });

  const expenseTotalCents = expenseLines.reduce((acc, row) => acc + row.amountCents, 0);

  const stripePaidCount = stripeInvoices.filter((i) => i.status.trim().toLowerCase() === "paid").length;

  const outstandingByCurrency = new Map<string, number>();
  const collectedByCurrency = new Map<string, number>();
  const invoicedFaceByCurrency = new Map<string, number>();

  let hasAnyAmountPaidSync = false;
  let hasAnyTotalSync = false;

  for (const inv of stripeInvoices) {
    const st = inv.status.trim().toLowerCase();
    const cc = normalizedStripeCurrencyCode(inv.currency);

    if ((st === "open" || st === "draft") && typeof inv.amountDueCents === "number" && inv.amountDueCents > 0) {
      outstandingByCurrency.set(cc, (outstandingByCurrency.get(cc) ?? 0) + inv.amountDueCents);
    }

    if (typeof inv.amountPaidCents === "number") {
      hasAnyAmountPaidSync = true;
      collectedByCurrency.set(cc, (collectedByCurrency.get(cc) ?? 0) + inv.amountPaidCents);
    }
    if (typeof inv.totalCents === "number") {
      hasAnyTotalSync = true;
      invoicedFaceByCurrency.set(cc, (invoicedFaceByCurrency.get(cc) ?? 0) + inv.totalCents);
    }
  }

  const usdCollectedCents = collectedByCurrency.get("USD") ?? 0;
  const hasUsdPaidSync = stripeInvoices.some(
    (i) => normalizedStripeCurrencyCode(i.currency) === "USD" && typeof i.amountPaidCents === "number",
  );
  const roughUsdMarginCents = usdCollectedCents - expenseTotalCents;
  const showRoughUsdMargin =
    stripeInvoices.length > 0 && (expenseTotalCents > 0 || hasUsdPaidSync);
  const nonUsdCollected = [...collectedByCurrency.keys()].some((k) => k !== "USD" && (collectedByCurrency.get(k) ?? 0) !== 0);

  const { crewMissingQuestionnaireRow, questionnaireSubmitted, questionnaireDraft } = producerCrewQuestionnaireRollup({
    assignmentStaffIds: assignments.map((a) => a.staffUserId),
    questionnaires,
  });

  const staffLabel = (email: string, name: string | null) =>
    `${email}${name?.trim() ? ` (${name.trim()})` : ""}`;

  return (
    <AppShell id="producer-main-content" outerMaxWidth="wide" contentMaxWidth="full" className="pt-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <header className="min-w-0 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-uls-subtle">Crew & ops</p>
          <h1 className="text-pretty text-3xl font-semibold tracking-tight text-uls-text md:text-[2rem]">{project.name}</h1>
          <p className="max-w-prose text-sm text-uls-muted">
            Assign internal crew (staff accounts), duties, travel/meals/payment questionnaires, and manual expense rows for tax /
            ops bookkeeping. Settlement truth stays in Stripe — this ledger is supplemental.
          </p>
        </header>
        <div className="flex flex-wrap gap-2">
          <Link href={`/producer/inbox/${project.id}`} className={buttonClassName("secondary", "sm")}>
            ← Intake detail
          </Link>
          <Link href="/producer/inbox" className={buttonClassName("ghost", "sm")}>
            Inbox
          </Link>
        </div>
      </div>

      <div className="mt-8 space-y-6">{crewFlash(sp)}</div>

      <ProducerGlassCard className="mt-8 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-uls-text">Ops snapshot</p>
            <p className="mt-1 text-[11px] leading-relaxed text-uls-muted">
              Manual ledger totals below are USD cents in-product. Stripe rows now also store{" "}
              <span className="font-medium text-uls-subtle">amount paid</span> and{" "}
              <span className="font-medium text-uls-subtle">invoice total</span> when webhooks or a Dashboard resync refresh them —
              older rows populate on the next invoice sync.
            </p>
          </div>
          <Link href={`/producer/inbox/${project.id}#stripe`} className={buttonClassName("secondary", "sm")}>
            Stripe section
          </Link>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-white/[0.06] bg-black/15 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-uls-muted">Manual expenses (USD)</p>
            <p className="mt-1 tabular-nums text-lg font-semibold text-uls-text">
              {formatMoneyFromCents(expenseTotalCents, "usd")}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/15 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-uls-muted">Stripe collected / billed</p>
            <p className="mt-1 text-xs text-uls-muted">
              {stripeInvoices.length} invoice row{stripeInvoices.length === 1 ? "" : "s"} · {stripePaidCount} paid
            </p>
            <div className="mt-2 space-y-2 text-[11px] text-uls-text">
              <div>
                <p className="font-medium text-uls-subtle">Sum amount paid</p>
                {!hasAnyAmountPaidSync ? (
                  <p className="mt-0.5 leading-relaxed text-uls-muted">
                    Not populated yet — trigger an invoice webhook or use{" "}
                    <span className="font-medium text-uls-text">Resync</span> on the Stripe intake section.
                  </p>
                ) : [...collectedByCurrency.entries()].filter(([, cents]) => cents !== 0).length === 0 ? (
                  <p className="mt-0.5 text-uls-muted">$0 recorded across synced invoices.</p>
                ) : (
                  <ul className="mt-1 space-y-0.5 tabular-nums">
                    {[...collectedByCurrency.entries()].map(([cc, cents]) =>
                      cents === 0 ? null : (
                        <li key={`paid-${cc}`}>
                          {cc}: {formatMoneyFromCents(cents, cc)}
                        </li>
                      ),
                    )}
                  </ul>
                )}
              </div>
              <div>
                <p className="font-medium text-uls-subtle">Sum invoice totals</p>
                {!hasAnyTotalSync ? (
                  <p className="mt-0.5 leading-relaxed text-uls-muted">Awaiting sync — same as above.</p>
                ) : (
                  <ul className="mt-1 space-y-0.5 tabular-nums">
                    {[...invoicedFaceByCurrency.entries()].map(([cc, cents]) => (
                      <li key={`tot-${cc}`}>
                        {cc}: {formatMoneyFromCents(cents, cc)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/15 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-uls-muted">Outstanding balance due</p>
            <p className="mt-1 text-[11px] text-uls-muted">Open / draft rows with Stripe amount due.</p>
            {outstandingByCurrency.size === 0 ? (
              <p className="mt-2 text-[11px] leading-relaxed text-uls-subtle">
                No positive balance due on open/draft rows (or amounts not synced yet).
              </p>
            ) : (
              <ul className="mt-2 space-y-1 text-[11px] text-uls-text">
                {[...outstandingByCurrency.entries()].map(([cc, cents]) => (
                  <li key={cc} className="tabular-nums">
                    {cc}: {formatMoneyFromCents(cents, cc)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {showRoughUsdMargin ? (
          <div
            className={`rounded-xl border px-3 py-3 text-[11px] leading-relaxed ${
              !hasUsdPaidSync
                ? "border-white/[0.06] bg-black/10 text-uls-muted"
                : roughUsdMarginCents >= 0
                  ? "border-emerald-900/50 bg-emerald-950/20 text-emerald-100"
                  : "border-rose-900/45 bg-rose-950/25 text-rose-100"
            }`}
          >
            <span className="font-semibold text-uls-text">Rough USD contribution margin</span> (Stripe USD amount paid − manual USD
            ledger):{" "}
            <span className="tabular-nums font-medium">
              {hasUsdPaidSync ? formatMoneyFromCents(roughUsdMarginCents, "usd") : "—"}
            </span>
            {!hasUsdPaidSync ? (
              <span className="block pt-1 text-uls-muted">
                USD paid totals will appear once synced invoice rows include amount paid.
              </span>
            ) : null}
            {nonUsdCollected ? (
              <span className="mt-2 block text-uls-subtle">
                Non-USD collections present — compare those currencies separately from this USD ledger shortcut.
              </span>
            ) : null}
          </div>
        ) : null}
      </ProducerGlassCard>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <ProducerGlassCard className="space-y-4">
          <p className="text-sm font-semibold text-uls-text">Assign crew</p>
          {staffUsers.length === 0 ? (
            <p className="text-sm text-uls-muted">
              No active staff accounts yet — create <strong className="font-medium text-uls-subtle">STAFF</strong> users under{" "}
              <Link href="/producer/admin/users" className="text-uls-accent underline underline-offset-2">
                Admin · Production accounts
              </Link>
              .
            </p>
          ) : (
            <form action={assignCrewMember} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="projectId" value={project.id} readOnly />
              <label className="flex flex-col gap-1 text-xs text-uls-muted">
                <span>Crew member</span>
                <select name="staffUserId" required className="rounded-md border border-white/[0.12] bg-black/35 px-2 py-2 text-sm text-uls-text">
                  <option value="">Select…</option>
                  {staffUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {staffLabel(u.email, u.name)}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" variant="primary" size="sm">
                Assign to production
              </Button>
            </form>
          )}

          <ul className="space-y-4 border-t border-white/[0.06] pt-4">
            {assignments.length === 0 ? (
              <li className="text-sm text-uls-muted">No crew assigned yet.</li>
            ) : (
              assignments.map((a) => (
                <li key={a.id} className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-uls-text">{staffLabel(a.staffUser.email, a.staffUser.name)}</p>
                      <p className="text-[10px] text-uls-subtle">Assigned {a.createdAt.toISOString().slice(0, 10)}</p>
                    </div>
                    <form action={removeCrewAssignment}>
                      <input type="hidden" name="projectId" value={project.id} readOnly />
                      <input type="hidden" name="assignmentId" value={a.id} readOnly />
                      <Button type="submit" variant="ghost" size="sm">
                        Remove
                      </Button>
                    </form>
                  </div>
                  <form action={updateCrewDuties} className="mt-3 space-y-2">
                    <input type="hidden" name="projectId" value={project.id} readOnly />
                    <input type="hidden" name="assignmentId" value={a.id} readOnly />
                    <label className="flex flex-col gap-1 text-[11px] text-uls-muted">
                      <span>Duties / department notes</span>
                      <textarea
                        name="duties"
                        rows={3}
                        defaultValue={a.duties ?? ""}
                        placeholder="FOH LX tech · callsheet POC · truck pack…"
                        className="rounded-md border border-white/[0.12] bg-black/35 px-2 py-2 text-xs text-uls-text outline-none focus-visible:ring-2 focus-visible:ring-uls-accent/35"
                      />
                    </label>
                    <Button type="submit" variant="secondary" size="sm">
                      Save duties
                    </Button>
                  </form>
                  <div className="mt-3 border-t border-white/[0.06] pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-uls-subtle">
                      Availability ({availStart.toISOString().slice(0, 10)} → {availEnd.toISOString().slice(0, 10)})
                    </p>
                    <CrewAvailabilitySnippet rows={availabilityByUserId.get(a.staffUserId) ?? []} />
                  </div>
                </li>
              ))
            )}
          </ul>
        </ProducerGlassCard>

        <ProducerGlassCard className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-uls-text">Travel / meals / payment questionnaires</p>
              <p className="mt-1 text-[11px] leading-relaxed text-uls-muted">
                Prepare blank questionnaire rows for everyone assigned, then crew fills them from{" "}
                <span className="font-medium text-uls-subtle">/staff</span>.
              </p>
            </div>
            <form action={prepareCrewQuestionnaires}>
              <input type="hidden" name="projectId" value={project.id} readOnly />
              <Button type="submit" variant="secondary" size="sm" disabled={assignments.length === 0}>
                Prepare questionnaires
              </Button>
            </form>
          </div>

          {assignments.length > 0 ? (
            <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2.5 text-[11px] leading-relaxed text-uls-muted">
              <span className="font-semibold text-uls-text">Questionnaire roll-up:</span>{" "}
              <span className="text-emerald-200/90">{questionnaireSubmitted} submitted</span>
              {" · "}
              <span className="text-amber-200/95">{questionnaireDraft} draft</span>
              {crewMissingQuestionnaireRow > 0 ? (
                <>
                  {" · "}
                  <span className="text-uls-subtle">
                    {crewMissingQuestionnaireRow} crew without rows —{" "}
                    <span className="font-medium text-uls-text">Prepare questionnaires</span>
                  </span>
                </>
              ) : null}
            </div>
          ) : null}

          <ul className="space-y-3 text-[11px] text-uls-muted">
            {questionnaires.length === 0 ? (
              <li>No questionnaire rows yet.</li>
            ) : (
              questionnaires.map((q) => (
                <li key={q.id} className="rounded-lg border border-white/[0.06] bg-black/15 px-3 py-2">
                  <p className="font-medium text-uls-text">{staffLabel(q.staffUser.email, q.staffUser.name)}</p>
                  <p className="mt-1 text-uls-subtle">
                    Status: {q.submittedAt ? `Submitted ${q.submittedAt.toISOString().slice(0, 10)}` : "Draft / pending"}
                  </p>
                  <div className="mt-2 grid gap-1 text-[10px] leading-snug">
                    <span>
                      <span className="text-uls-subtle">Travel:</span>{" "}
                      {q.travelNotes?.trim() ? `${q.travelNotes!.slice(0, 140)}…` : "—"}
                    </span>
                    <span>
                      <span className="text-uls-subtle">Food:</span>{" "}
                      {q.foodNotes?.trim() ? `${q.foodNotes!.slice(0, 120)}…` : "—"}
                    </span>
                    <span>
                      <span className="text-uls-subtle">Payment:</span>{" "}
                      {q.paymentNotes?.trim() ? `${q.paymentNotes!.slice(0, 120)}…` : "—"}
                    </span>
                  </div>
                </li>
              ))
            )}
          </ul>
        </ProducerGlassCard>
      </div>

      <ProducerGlassCard className="mt-8 space-y-4">
        <p className="text-sm font-semibold text-uls-text">Tax document uploads on file</p>
        <p className="text-[11px] leading-relaxed text-uls-muted">
          Crew uploads W‑9 / W‑2-class PDFs from <span className="font-medium text-uls-subtle">Staff → Tax forms</span>. Downloads use a
          short-lived signed URL (producer/admin only).
        </p>
        {taxDocs.length === 0 ? (
          <p className="text-sm text-uls-muted">No uploads yet for assigned crew.</p>
        ) : (
          <ul className="space-y-2 text-[11px]">
            {taxDocs.map((d) => {
              const owner = assignments.find((x) => x.staffUserId === d.userId)?.staffUser;
              return (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-black/15 px-3 py-2"
                >
                  <span className="text-uls-muted">
                    {(owner ? staffLabel(owner.email, owner.name) : d.userId) + ` · ${d.kind} · ${d.fileName}`}
                  </span>
                  <a href={`/api/producer/staff-tax/${d.id}?download=1`} className={buttonClassName("secondary", "sm")}>
                    Download
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </ProducerGlassCard>

      <ProducerGlassCard className="mt-8 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-uls-text">Manual expense ledger</p>
            <p className="mt-1 text-[11px] text-uls-muted">
              Line-by-line operational expenses for reconciliation — totals{" "}
              <span className="tabular-nums font-medium text-uls-text">{formatMoneyFromCents(expenseTotalCents, "usd")}</span> stored USD
              cents.
            </p>
          </div>
        </div>

        <form action={addProjectExpenseLine} className="grid gap-2 rounded-xl border border-white/[0.06] bg-black/15 p-3 sm:grid-cols-4">
          <input type="hidden" name="projectId" value={project.id} readOnly />
          <label className="flex flex-col gap-1 text-[11px] text-uls-muted sm:col-span-2">
            <span>Label</span>
            <input name="label" required className="rounded-md border border-white/[0.12] bg-black/35 px-2 py-2 text-xs text-uls-text" />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-uls-muted">
            <span>Category</span>
            <input
              name="category"
              placeholder="TRAVEL · LABOR · MEALS…"
              required
              className="rounded-md border border-white/[0.12] bg-black/35 px-2 py-2 text-xs text-uls-text"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-uls-muted">
            <span>Amount (USD)</span>
            <input
              name="amountUsd"
              type="number"
              step="0.01"
              min="0"
              required
              className="rounded-md border border-white/[0.12] bg-black/35 px-2 py-2 tabular-nums text-xs text-uls-text"
            />
          </label>
          <div className="sm:col-span-4">
            <Button type="submit" variant="primary" size="sm">
              Add expense row
            </Button>
          </div>
        </form>

        <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-black/15">
          <table className="w-full min-w-[560px] border-collapse text-left text-[11px] text-uls-muted">
            <thead className="border-b border-white/[0.06] bg-black/25 text-[10px] font-semibold uppercase tracking-wide text-uls-subtle">
              <tr>
                <th className="px-3 py-2">Label</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Recorded</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {expenseLines.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-sm">
                    No expense rows yet.
                  </td>
                </tr>
              ) : (
                expenseLines.map((row) => (
                  <tr key={row.id} className="border-b border-white/[0.04] last:border-b-0">
                    <td className="px-3 py-2 font-medium text-uls-text">{row.label}</td>
                    <td className="px-3 py-2">{row.category}</td>
                    <td className="px-3 py-2 tabular-nums">{formatMoneyFromCents(row.amountCents, "usd")}</td>
                    <td className="px-3 py-2">{row.createdAt.toISOString().slice(0, 10)}</td>
                    <td className="px-3 py-2 text-right">
                      <form action={deleteProjectExpenseLine} className="inline">
                        <input type="hidden" name="projectId" value={project.id} readOnly />
                        <input type="hidden" name="expenseId" value={row.id} readOnly />
                        <Button type="submit" variant="ghost" size="sm">
                          Delete
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ProducerGlassCard>
    </AppShell>
  );
}
