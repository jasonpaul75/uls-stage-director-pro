import Link from "next/link";
import { notFound } from "next/navigation";

import { stripeInvoiceDashboardUrl, webhookSecretConfigured } from "@/lib/stripe-admin";
import { prisma } from "@/lib/prisma";
import { GlobalRole, ProjectRole, ProjectStatus } from "@prisma/client";

import { updateIntakeInternals } from "../actions";
import { resendDirectorInvite, sendDirectorInvite } from "../invite-actions";
import { saveProposalDraft } from "../proposal-actions";
import {
  addStripeDraftLineItem,
  cancelStripeInvoice,
  createDepositDraftInvoice,
  ensureStripeCustomerForProject,
  finalizeAndSendStripeInvoice,
} from "../stripe-actions";

type Props = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{
    saved?: string;
    error?: string;
    invite_sent?: string;
    invite_resend?: string;
    invite_err?: string;
    stripe_customer?: string;
    stripe_invoice?: string;
    stripe_sent?: string;
    stripe_line?: string;
    stripe_cancelled?: string;
    stripe_err?: string;
    proposal_saved?: string;
  }>;
};

export default async function IntakeDetailPage(props: Props) {
  const { projectId } = await props.params;
  const sp = (await props.searchParams) ?? {};

  const webhookOk = webhookSecretConfigured();
  const appBase = (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

  const inviteErrCopy: Record<string, string> = {
    missing_email: "Enter a director email before sending.",
    bad_email: "That email doesn’t look valid.",
    invalid_project: "That project isn’t in the intake inbox.",
    already_member: "That email already has director access to this production.",
    producer_account:
      "That email is tied to production staff — use a director-facing address.",
    server: "Couldn’t create the invite. Try again.",
    mail_failed:
      "Invite email didn’t send (check SES_FROM_EMAIL / recipient verification). The invite wasn’t saved.",
  };

  const stripeErrCopy: Record<string, string> = {
    no_key: "Stripe isn’t configured — set STRIPE_SECRET_KEY on the server.",
    already_linked: "This production already has a Stripe customer record.",
    no_directors:
      "Add at least one director on the intake record before creating a Stripe customer (billing email).",
    stripe_api: "Stripe returned an error — check logs and Dashboard for details.",
    no_customer: "Create a Stripe customer for this production first.",
    bad_amount:
      "Enter deposit in USD — at least $1.00 (we enforce a 50¢ minimum in cents via Stripe norms).",
    invoice_project_mismatch: "That invoice doesn’t belong to this production.",
    invoice_not_tracked:
      "That invoice wasn’t created from this intake record — refresh the page or manage it in Stripe only.",
    bad_invoice_state: "That action only works while the invoice is a draft or open (depending on what you clicked).",
    bad_line: "Add a description and USD amount ($0.01–$999,999).",
    invalid_project: "That project isn’t in the intake inbox.",
  };

  const project = await prisma.project.findFirst({
    where: { id: projectId, status: ProjectStatus.INTAKE_SUBMITTED },
    include: {
      memberships: {
        where: { role: ProjectRole.DIRECTOR },
        include: { user: true },
      },
      assignedTo: { select: { id: true, email: true, name: true } },
      stripeInvoices: {
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          stripeInvoiceId: true,
          status: true,
          invoiceNumber: true,
          amountDueCents: true,
          hostedInvoiceUrl: true,
          currency: true,
        },
      },
    },
  });

  if (!project) notFound();

  const producers = await prisma.user.findMany({
    where: { globalRole: { in: [GlobalRole.PRODUCER, GlobalRole.ULS_ADMIN] } },
    select: { id: true, email: true, name: true },
    orderBy: { email: "asc" },
  });

  const directors = project.memberships.map((m) => m.user.email).join(", ");

  const now = new Date();
  const pendingInvites = await prisma.directorInvite.findMany({
    where: {
      projectId: project.id,
      consumedAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: { email: true, expiresAt: true },
  });

  const activeInviteRows = pendingInvites.map((inv) => ({
    ...inv,
    stale: inv.expiresAt <= now,
  }));

  return (
    <main className="mx-auto max-w-3xl p-8">
      <nav className="text-sm text-neutral-500">
        <Link href="/producer/inbox" className="text-amber-500 hover:text-amber-400">
          ← Inbox
        </Link>
      </nav>

      <p className="mt-6 text-sm uppercase tracking-widest text-amber-500">Intake detail</p>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-100">{project.name}</h1>

      {sp.saved === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Saved internal fields.
        </p>
      ) : null}
      {sp.invite_sent === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Director invite emailed. They&apos;ll finish setup from the secure link (valid one week).
          {sp.invite_resend === "1" ? " (Earlier unused invite links for that address stopped working.)" : ""}
        </p>
      ) : null}
      {typeof sp.invite_err === "string" && inviteErrCopy[sp.invite_err] ? (
        <p className="mt-3 text-sm text-red-400">{inviteErrCopy[sp.invite_err]}</p>
      ) : typeof sp.invite_err === "string" ? (
        <p className="mt-3 text-sm text-red-400">Couldn&apos;t send the invite.</p>
      ) : null}
      {sp.error === "bad_assignee" ? (
        <p className="mt-3 text-sm text-red-400">Invalid assignee selected.</p>
      ) : null}

      {!webhookOk ? (
        <p className="mt-3 rounded border border-amber-900/70 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">
          Stripe webhooks inactive — set STRIPE_WEBHOOK_SECRET then point Stripe to{" "}
          <code className="rounded bg-black/50 px-1 py-0.5 text-[11px]">
            {appBase}/api/webhooks/stripe
          </code>{" "}
          so invoices sync into this inbox.
        </p>
      ) : null}

      {sp.stripe_customer === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Stripe customer linked (Standard ULS account). You can draft a phased deposit invoice next.
        </p>
      ) : null}
      {sp.stripe_invoice === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Stripe draft invoice created — add lines, finalize/send from here or the Dashboard; status updates arrive via webhook.
        </p>
      ) : null}
      {sp.stripe_sent === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Invoice finalized and emailed via Stripe’s send flow (customer-facing link arrives from Stripe).
        </p>
      ) : null}
      {sp.stripe_line === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Line item added to the draft invoice.
        </p>
      ) : null}
      {sp.stripe_cancelled === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Stripe invoice discarded (draft) or voided (open) per your selection.
        </p>
      ) : null}
      {typeof sp.stripe_err === "string" && stripeErrCopy[sp.stripe_err] ? (
        <p className="mt-3 text-sm text-red-400">{stripeErrCopy[sp.stripe_err]}</p>
      ) : typeof sp.stripe_err === "string" ? (
        <p className="mt-3 text-sm text-red-400">Stripe action failed.</p>
      ) : null}
      {sp.proposal_saved === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Proposal draft saved.
          {project.proposalDirectorVisible
            ? " Directors can open this production from the portal and see these sections."
            : " Turn on “Publish these three sections…” once ULS wording is cleared for directors."}
        </p>
      ) : null}

      <section className="mt-8 space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-300">
        <p>
          <span className="text-zinc-500">Directors:</span> {directors || "—"}
        </p>
        <p>
          <span className="text-zinc-500">Venue:</span> {project.venue ?? "—"}
          {project.cityState ? ` · ${project.cityState}` : ""}
        </p>
        <p>
          <span className="text-zinc-500">Dates:</span>{" "}
          {project.requestedEventStart?.toISOString().slice(0, 10) ?? "—"} →{" "}
          {project.requestedEventEnd?.toISOString().slice(0, 10) ?? "—"}
        </p>
        <p>
          <span className="text-zinc-500">Contestants (approx):</span> {project.contestantApprox ?? "—"}
        </p>
        <p>
          <span className="text-zinc-500">Categories:</span>
        </p>
        <pre className="whitespace-pre-wrap rounded bg-black/40 p-2 font-sans text-zinc-400">
          {project.categoryNotes ?? "—"}
        </pre>
        <p>
          <span className="text-zinc-500">Livestream:</span>
        </p>
        <pre className="whitespace-pre-wrap rounded bg-black/40 p-2 font-sans text-zinc-400">
          {project.livestreamNotes ?? "—"}
        </pre>
        <p>
          <span className="text-zinc-500">Budget:</span>
        </p>
        <pre className="whitespace-pre-wrap rounded bg-black/40 p-2 font-sans text-zinc-400">
          {project.budgetNotes ?? "—"}
        </pre>
        <p>
          <span className="text-zinc-500">Director notes:</span>
        </p>
        <pre className="whitespace-pre-wrap rounded bg-black/40 p-2 font-sans text-zinc-400">
          {project.additionalNotes ?? "—"}
        </pre>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-zinc-200">Director invite</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Send one email invite per director. They create a portal password (or attach to their current
          director login). Uses the same Amazon SES sender as intake notifications — verify recipients in
          the SES sandbox until production is lifted.
        </p>
        <form action={sendDirectorInvite} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="projectId" value={project.id} />
          <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-sm">
            <span className="text-zinc-400">Director email</span>
            <input
              type="email"
              name="directorEmail"
              required
              autoComplete="off"
              placeholder="director@email.com"
              className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-600"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
          >
            Send invite
          </button>
        </form>

        {activeInviteRows.length > 0 ? (
          <div className="mt-8 space-y-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Outstanding invites</h3>
            <ul className="space-y-2 text-sm">
              {activeInviteRows.map((row, i) => (
                <li
                  key={`${row.email}-${row.expiresAt.toISOString()}-${i}`}
                  className="flex flex-col gap-2 rounded border border-zinc-800 bg-zinc-950/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-100">{row.email}</p>
                    <p className="text-xs text-zinc-500">
                      Expires UTC {row.expiresAt.toISOString().replace("T", " ").slice(0, 16)}
                      {row.stale ? " · expired until resent" : ""}
                    </p>
                  </div>
                  <form action={resendDirectorInvite} className="shrink-0">
                    <input type="hidden" name="projectId" value={project.id} />
                    <input type="hidden" name="directorEmail" value={row.email} />
                    <button
                      type="submit"
                      className="rounded border border-amber-900/70 bg-transparent px-3 py-1.5 text-xs font-medium text-amber-500 hover:bg-amber-950/40"
                    >
                      Resend
                    </button>
                  </form>
                </li>
              ))}
            </ul>
            <p className="text-xs text-zinc-600">
              Resend clears any unused invite tokens for that address on this production, then sends a fresh link (same
              one-week window).
            </p>
          </div>
        ) : null}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-zinc-200">Proposal draft (pricing &amp; rider)</h2>
        <p className="mt-1 text-xs text-zinc-500">
          MVP scaffolding: capture how you&apos;ll describe fees, tech, and crew rhythm. Directors never see these
          fields until ULS publishes with the checkbox below — use internal notes above for unfinished thinking.
        </p>
        <form action={saveProposalDraft} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="projectId" value={project.id} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-400">Pricing / phased payments summary</span>
            <textarea
              name="proposalPricingNotes"
              rows={6}
              defaultValue={project.proposalPricingNotes ?? ""}
              placeholder="Deposits, milestones, recurring fees, Stripe invoice language — prose for eventual client-visible copy."
              className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-400">Technical / rider cues</span>
            <textarea
              name="proposalTechRiderNotes"
              rows={6}
              defaultValue={project.proposalTechRiderNotes ?? ""}
              placeholder="Power, signal paths, LX/audio guardrails — enough for a future formal rider attachment."
              className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-400">Crew &amp; rehearsal rhythm</span>
            <textarea
              name="proposalCrewNotes"
              rows={5}
              defaultValue={project.proposalCrewNotes ?? ""}
              placeholder="Call times, departmental ownership, escalation — still internal until published."
              className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <input type="checkbox" name="proposalDirectorVisible" defaultChecked={project.proposalDirectorVisible} />
            <span>Publish these three sections on the director&apos;s portal for this production</span>
          </label>
          <button
            type="submit"
            className="w-fit rounded border border-emerald-800/70 bg-emerald-950/30 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-900/40"
          >
            Save proposal draft
          </button>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-zinc-200">Stripe (payments — ULS merchant)</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Funds settle to ULS billing per locked spec — Connect not required for v1 foundations. Billing contact email
          comes from the first director membership on intake.
        </p>

        <div className="mt-4 rounded border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-400">
          <span className="text-zinc-500">Stripe customer:</span>{" "}
          <span className="font-mono text-zinc-200">{project.stripeCustomerId ?? "—"}</span>
          {!project.stripeCustomerId ? (
            <form action={ensureStripeCustomerForProject} className="mt-3 inline-block sm:block">
              <input type="hidden" name="projectId" value={project.id} />
              <button
                type="submit"
                disabled={directors === ""}
                className="rounded bg-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Create Stripe customer from first director
              </button>
            </form>
          ) : null}
        </div>

        <form action={createDepositDraftInvoice} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="projectId" value={project.id} />
          <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm">
            <span className="text-zinc-400">Deposit (USD)</span>
            <input
              type="number"
              name="depositUsd"
              min={1}
              step="0.01"
              placeholder="2500"
              disabled={!project.stripeCustomerId}
              required
              className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-600 disabled:opacity-40"
            />
          </label>
          <button
            type="submit"
            disabled={!project.stripeCustomerId}
            className="rounded border border-amber-800/70 bg-transparent px-4 py-2 text-sm font-medium text-amber-500 hover:bg-amber-950/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add draft invoice (deposit line)
          </button>
        </form>

        {project.stripeInvoices.length > 0 ? (
          <div className="mt-6 space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Invoices synced here</h3>
            <ul className="space-y-2 text-xs">
              {project.stripeInvoices.map((inv) => (
                <li key={inv.id} className="rounded border border-zinc-800 bg-black/40 px-3 py-2 text-zinc-300">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-mono text-zinc-100">{inv.stripeInvoiceId}</span>
                    <span className="text-zinc-500">{inv.status}</span>
                    {inv.invoiceNumber ? <span className="text-zinc-600">#{inv.invoiceNumber}</span> : null}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-zinc-500">
                    {typeof inv.amountDueCents === "number" ? (
                      <span>
                        {(inv.amountDueCents / 100).toLocaleString(undefined, {
                          style: "currency",
                          currency: inv.currency.toUpperCase() || "USD",
                        })}{" "}
                        due
                      </span>
                    ) : null}
                    <a
                      href={stripeInvoiceDashboardUrl(inv.stripeInvoiceId)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-500 hover:text-amber-400"
                    >
                      Open in Stripe Dashboard
                    </a>
                    {inv.hostedInvoiceUrl ? (
                      <a
                        href={inv.hostedInvoiceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-amber-500 hover:text-amber-400"
                      >
                        Hosted invoice
                      </a>
                    ) : null}
                  </div>
                  {inv.status === "draft" ? (
                    <div className="mt-3 space-y-3 border-t border-zinc-800/80 pt-3">
                      <form
                        action={finalizeAndSendStripeInvoice}
                        className="flex flex-wrap items-end gap-2 text-xs text-zinc-400"
                      >
                        <input type="hidden" name="projectId" value={project.id} />
                        <input type="hidden" name="stripeInvoiceId" value={inv.stripeInvoiceId} />
                        <button
                          type="submit"
                          className="rounded border border-emerald-800/70 bg-emerald-950/30 px-3 py-1.5 font-medium text-emerald-200 hover:bg-emerald-900/40"
                        >
                          Finalize &amp; send
                        </button>
                      </form>
                      <form action={addStripeDraftLineItem} className="flex flex-wrap items-end gap-2 gap-y-2 text-xs">
                        <input type="hidden" name="projectId" value={project.id} />
                        <input type="hidden" name="stripeInvoiceId" value={inv.stripeInvoiceId} />
                        <label className="flex min-w-[7rem] flex-col gap-0.5">
                          <span className="text-zinc-500">Amount (USD)</span>
                          <input
                            type="number"
                            name="lineUsd"
                            min={0.01}
                            step="0.01"
                            placeholder="500"
                            required
                            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-zinc-100"
                          />
                        </label>
                        <label className="flex min-w-[12rem] flex-1 flex-col gap-0.5">
                          <span className="text-zinc-500">Description</span>
                          <input
                            type="text"
                            name="lineDescription"
                            maxLength={420}
                            required
                            placeholder="e.g. travel advance"
                            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-100"
                          />
                        </label>
                        <button
                          type="submit"
                          className="rounded border border-zinc-600 bg-zinc-900 px-3 py-1.5 font-medium text-zinc-200 hover:bg-zinc-800"
                        >
                          Add line
                        </button>
                      </form>
                      <form action={cancelStripeInvoice}>
                        <input type="hidden" name="projectId" value={project.id} />
                        <input type="hidden" name="stripeInvoiceId" value={inv.stripeInvoiceId} />
                        <button
                          type="submit"
                          className="text-xs text-red-400/90 underline-offset-2 hover:text-red-300 hover:underline"
                        >
                          Delete draft invoice
                        </button>
                      </form>
                    </div>
                  ) : null}
                  {inv.status === "open" ? (
                    <div className="mt-3 border-t border-zinc-800/80 pt-3">
                      <form action={cancelStripeInvoice}>
                        <input type="hidden" name="projectId" value={project.id} />
                        <input type="hidden" name="stripeInvoiceId" value={inv.stripeInvoiceId} />
                        <button
                          type="submit"
                          className="text-xs font-medium text-amber-700/90 hover:text-amber-500"
                        >
                          Void open invoice
                        </button>
                      </form>
                      <p className="mt-1 text-[11px] text-zinc-600">
                        Voids unsettled Stripe invoices — use only when you mean to unwind billing.
                      </p>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-zinc-200">Internal (ULS only)</h2>
        <form action={updateIntakeInternals} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="projectId" value={project.id} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-400">Assigned producer</span>
            <select
              name="assignedToUserId"
              defaultValue={project.assignedToUserId ?? ""}
              className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            >
              <option value="">— Unassigned —</option>
              {producers.map((u) => (
                <option key={u.id} value={u.id}>
                  {(u.name ?? "").trim() || u.email}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-400">Internal notes</span>
            <textarea
              name="internalNotes"
              rows={6}
              defaultValue={project.internalNotes ?? ""}
              placeholder="Triage notes, call outcomes, pricing thoughts — not visible to directors."
              className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            />
          </label>

          <button
            type="submit"
            className="w-fit rounded bg-amber-600 px-4 py-2 text-sm font-medium text-black hover:bg-amber-500"
          >
            Save
          </button>
        </form>
      </section>
    </main>
  );
}
