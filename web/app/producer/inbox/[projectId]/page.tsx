import Link from "next/link";
import { notFound } from "next/navigation";

import {
  stripeInvoiceDashboardUrl,
  stripeSecretKeyAppearsSandbox,
  webhookSecretConfigured,
} from "@/lib/stripe-admin";
import {
  formatMoneyFromCents,
  formatStripeRecordSynced,
  stripeHasOpenBalanceDue,
  stripeInvoiceProducerHint,
  stripeInvoiceStatusLabel,
  stripeOpenInvoiceRetryGuide,
} from "@/lib/stripe-invoice-ui";
import { docuSignConnectHmacSecretConfigured, docuSignProducerConsoleEnvelopeUrl } from "@/lib/docusign-admin";
import { docuSignEnvelopeStatusLabel } from "@/lib/docusign-envelope-ui";
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
  resyncTrackedStripeInvoice,
} from "../stripe-actions";
import { linkDocuSignEnvelopeToProject, unlinkDocuSignEnvelopeFromProject } from "../docusign-actions";

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
    stripe_synced?: string;
    stripe_err?: string;
    proposal_saved?: string;
    docusign_linked?: string;
    docusign_removed?: string;
    docusign_err?: string;
  }>;
};

export default async function IntakeDetailPage(props: Props) {
  const { projectId } = await props.params;
  const sp = (await props.searchParams) ?? {};

  const webhookOk = webhookSecretConfigured();
  const docusignConnectOk = docuSignConnectHmacSecretConfigured();
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

  const docusignErrCopy: Record<string, string> = {
    bad_envelope:
      "Envelope ID must be a 36-character GUID copied from DocuSign (open the agreement → copy from the URL or details). Tutorial examples pasted from the web often look valid but aren’t real envelopes.",
    placeholder_envelope:
      "That ID is only a textbook / RFC example (550e8400-…); paste the envelope ID DocuSign shows for your agreement so Connect payloads can match it.",
    envelope_already_linked:
      "Each DocuSigned envelope ID can belong to only one intake at a time. Go to Producer inbox, open **other** productions (titles in the list), expand Contracts — if this same ID appears there, remove that row — or reuse that intake row instead.",
    api: "Couldn’t save DocuSign link.",
    invalid_project: "That project isn’t in the intake inbox.",
  };

  const [project, latestInvoiceStripeWebhook] = await Promise.all([
    prisma.project.findFirst({
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
            updatedAt: true,
            attemptCount: true,
            nextPaymentAttemptAt: true,
            lastStripeErrorSummary: true,
            lastSyncedFromStripeAt: true,
          },
        },
        docuSignEnvelopes: {
          orderBy: { updatedAt: "desc" },
          take: 12,
          select: {
            id: true,
            envelopeId: true,
            subject: true,
            status: true,
            statusChangedAt: true,
            completedAt: true,
            voidedAt: true,
            producerNote: true,
            lastWebhookEvent: true,
            updatedAt: true,
          },
        },
      },
    }),
    prisma.stripeInboundEvent.findFirst({
      where: {
        processedAt: { not: null },
        type: { startsWith: "invoice." },
      },
      orderBy: { processedAt: "desc" },
      select: { processedAt: true },
    }),
  ]);

  if (!project) notFound();

  const stripeSandbox = stripeSecretKeyAppearsSandbox();

  const inflightForTotals = project.stripeInvoices.filter(
    (inv) => inv.status === "draft" || inv.status === "open",
  );
  let combinedDueCentsInFlight = 0;
  const invoiceCurrencySet = new Set<string>();
  for (const inv of inflightForTotals) {
    if (typeof inv.amountDueCents === "number") {
      combinedDueCentsInFlight += inv.amountDueCents;
    }
    invoiceCurrencySet.add(inv.currency.toUpperCase() || "USD");
  }
  const totalsSingleCurrency = invoiceCurrencySet.size === 1 ? [...invoiceCurrencySet][0] : null;
  const openInvoiceRetryCoach = stripeHasOpenBalanceDue(project.stripeInvoices);

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
      {!docusignConnectOk ? (
        <p className="mt-3 rounded border border-indigo-900/65 bg-indigo-950/25 px-3 py-2 text-[11px] leading-relaxed text-indigo-100">
          DocuSign Connect inactive — create <span className="font-mono">DOCUSIGN_CONNECT_HMAC_SECRET</span> then add a JSON
          SIM Connect URL to{" "}
          <span className="font-mono text-indigo-200">
            {appBase}/api/webhooks/docusign
          </span>{" "}
          (Basic HMAC, signature&nbsp;1) so envelope statuses mirror here automatically.
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
      {sp.stripe_synced === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          Stripe invoice refreshed from the API — attempt counts and balances should match Dashboard (webhooks remain the
          default path).
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
          {project.proposalDirectorVisible ||
          project.contractsDirectorVisible ||
          project.stripeBillingDirectorVisible
            ? " Directors see whatever you’ve turned on under “Director portal visibility” below."
            : " Turn on the director portal checkboxes when proposal, contracts, or billing are ready to show."}
        </p>
      ) : null}
      {sp.docusign_linked === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          DocuSign envelope linked — status updates arrive after Connect publishes events.
        </p>
      ) : null}
      {sp.docusign_removed === "1" ? (
        <p className="mt-3 rounded border border-emerald-900/70 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-100">
          DocuSign tracking row removed locally (does not void envelopes in DocuSign).
        </p>
      ) : null}
      {typeof sp.docusign_err === "string" && docusignErrCopy[sp.docusign_err] ? (
        <p className="mt-3 text-sm text-red-400">{docusignErrCopy[sp.docusign_err]}</p>
      ) : typeof sp.docusign_err === "string" ? (
        <p className="mt-3 text-sm text-red-400">DocuSign action failed.</p>
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
          <fieldset className="space-y-2 rounded border border-zinc-800/80 bg-black/20 px-3 py-3 text-xs text-zinc-400">
            <legend className="px-1 text-zinc-300">Director portal visibility</legend>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="proposalDirectorVisible" defaultChecked={project.proposalDirectorVisible} />
              <span>Show proposal notes (pricing / rider / crew) to directors</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="contractsDirectorVisible" defaultChecked={project.contractsDirectorVisible} />
              <span>Show mirrored DocuSign contract status to directors</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="stripeBillingDirectorVisible"
                defaultChecked={project.stripeBillingDirectorVisible}
              />
              <span>Show Stripe invoices &amp; payment links to directors</span>
            </label>
          </fieldset>
          <button
            type="submit"
            className="w-fit rounded border border-emerald-800/70 bg-emerald-950/30 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-900/40"
          >
            Save proposal draft
          </button>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-zinc-200">Contracts (DocuSign)</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Draft and send envelopes in DocuSign, then paste the envelope GUID below so mirrored status reaches the portal.
          Signing and legal evidence stay in DocuSign — only metadata is cached here.{" "}
          <span className="text-zinc-600">
            (Submitting this form only saves the link; it does not ask DocuSign to send a webhook — you need a live
            envelope event or Connect test.)
          </span>
        </p>
        <p className="mt-3 rounded border border-amber-950/60 bg-amber-950/20 px-3 py-2 text-[11px] leading-relaxed text-amber-100/95">
          <span className="font-semibold">Important:</span> copy the GUID from the DocuSigned address bar (
          <span className="font-mono text-amber-200/90">…/send/documents/details/</span>) with Ctrl+V / Cmd+V —{" "}
          <span className="font-semibold">do not re-type</span>. A single wrong character looks like a valid UUID but will not
          match DocuSigned or Connect.
        </p>
        <form action={linkDocuSignEnvelopeToProject} className="mt-4 flex flex-col gap-3 rounded border border-zinc-800 bg-zinc-950/35 p-3 text-xs text-zinc-400">
          <input type="hidden" name="projectId" value={project.id} />
          <label className="flex flex-col gap-1">
            <span className="text-zinc-300">Envelope ID (GUID)</span>
            <input
              type="text"
              name="envelopeId"
              required
              placeholder="Paste 36-character GUID from the envelope URL in DocuSign"
              className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-[11px] text-zinc-100"
              autoComplete="off"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-zinc-400">Memo / DocuSign email subject snapshot (optional)</span>
            <input
              type="text"
              name="subject"
              maxLength={300}
              className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
              placeholder='e.g. "ULS Stage — Acme gala production agreement"'
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-zinc-400">Internal producer-only note</span>
            <textarea name="producerNote" rows={2} maxLength={2000} className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100" />
          </label>
          <button
            type="submit"
            className="w-fit rounded border border-indigo-800/70 bg-indigo-950/40 px-4 py-2 text-[11px] font-medium text-indigo-100 hover:bg-indigo-900/35"
          >
            Link envelope to this production
          </button>
        </form>

        {project.docuSignEnvelopes.length > 0 ? (
          <ul className="mt-6 space-y-3 text-xs">
            {project.docuSignEnvelopes.map((env) => (
              <li key={env.id} className="rounded border border-zinc-800 bg-black/35 px-3 py-2 text-zinc-300">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-zinc-100">{docuSignEnvelopeStatusLabel(env.status)}</span>
                  {env.subject ? <span className="text-zinc-500">{env.subject}</span> : null}
                </div>
                <p className="mt-1 font-mono text-[10px] text-zinc-500">{env.envelopeId}</p>
                {!env.statusChangedAt ? (
                  <p className="mt-1.5 text-[10px] leading-snug text-amber-500/95">
                    Stuck here but Vercel shows POST&nbsp;200? Compare this ID to DocuSigned URL — any mismatch prevents updates.
                    Remove tracking row → paste GUID again from the browser bar only.
                  </p>
                ) : null}
                <p className="mt-1 text-[11px] text-zinc-500">
                  Cached status updated{" "}
                  {env.statusChangedAt ? formatStripeRecordSynced(env.statusChangedAt) : "pending first Connect event"}
                </p>
                {!env.statusChangedAt ? (
                  <p className="mt-2 max-w-prose text-[10px] leading-relaxed text-zinc-600">
                    If DocuSign never hits your server, the usual miss is configuring Connect under{" "}
                    <span className="font-mono text-zinc-500">admin.docusign.com</span> while the envelope ran in demo — use{" "}
                    <a
                      href="https://admindemo.docusign.com/authenticate?goTo=connect"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:text-indigo-300"
                    >
                      admindemo.docusign.com → Connect
                    </a>{" "}
                    for <span className="font-mono text-zinc-500">apps-d</span> envelopes. In{" "}
                    <span className="font-medium text-zinc-500">Event Settings</span>, turn on concrete triggers (e.g. envelope
                    sent / completed — if nothing is checked, DocuSign sends zero POSTs). Data format must be JSON / JSON SIM per{" "}
                    {"this app's webhook"}. Confirm Connect logs (listener log / failures tab) once{" "}
                    <span className="font-semibold text-zinc-500">after</span> saving — same screen as where you pasted the URL (
                    Enable Log checked). Historical envelopes rarely backfill; create{" "}
                    <span className="font-semibold text-zinc-500">after</span> Connect is Active. Then watch Vercel for{" "}
                    <span className="font-mono text-zinc-500">POST /api/webhooks/docusign</span>.{" "}
                    <code className="rounded bg-zinc-950 px-1 py-px font-mono text-zinc-500">DOCUSIGN_USE_DEMO=true</code> only
                    affects console links, not webhook routing.
                  </p>
                ) : null}
                {env.completedAt ? (
                  <p className="text-[11px] text-emerald-500/95">Completed {formatStripeRecordSynced(env.completedAt)}</p>
                ) : null}
                {env.voidedAt ? (
                  <p className="text-[11px] text-amber-500/90">Voided {formatStripeRecordSynced(env.voidedAt)}</p>
                ) : null}
                {env.lastWebhookEvent ? (
                  <p className="text-[10px] text-zinc-600">Last event: {env.lastWebhookEvent}</p>
                ) : null}
                {env.producerNote?.trim() ? (
                  <p className="mt-2 whitespace-pre-wrap text-[11px] text-zinc-500">{env.producerNote.trim()}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                  <a
                    href={docuSignProducerConsoleEnvelopeUrl(env.envelopeId)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 hover:text-indigo-300"
                  >
                    Open envelope in DocuSign
                  </a>
                  <form action={unlinkDocuSignEnvelopeFromProject} className="inline">
                    <input type="hidden" name="projectId" value={project.id} />
                    <input type="hidden" name="rowId" value={env.id} />
                    <button
                      type="submit"
                      className="text-[11px] text-red-400/95 underline underline-offset-2 hover:text-red-300"
                    >
                      Remove tracking row
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-xs text-zinc-600">
            Link envelopes so ULS can mirror DocuSigned status — directors only see the Contracts block when you enable it under
            Director portal visibility above.
          </p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-zinc-200">Stripe (payments — ULS merchant)</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Funds settle to ULS billing per locked spec — Connect not required for v1 foundations. Billing contact email
          comes from the first director membership on intake.
        </p>
        {stripeSandbox ? (
          <p className="mt-2 rounded border border-sky-900/60 bg-sky-950/35 px-3 py-2 text-[11px] leading-relaxed text-sky-100">
            <span className="font-semibold">Test mode:</span> Charges, emails, and payouts are simulated. Swap to live{" "}
            <code className="rounded bg-black/40 px-1">STRIPE_*</code> keys plus a live webhook endpoint when you are
            production-ready.
          </p>
        ) : (
          <p className="mt-2 rounded border border-emerald-950/60 bg-emerald-950/25 px-3 py-2 text-[11px] leading-relaxed text-emerald-100">
            <span className="font-semibold">Live Stripe keys detected.</span> Double-check roles, refund policy, and Stripe
            Radar before sending large invoices.
          </p>
        )}

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
            {combinedDueCentsInFlight > 0 && totalsSingleCurrency ? (
              <p className="rounded border border-zinc-700/80 bg-black/30 px-2 py-1.5 text-[11px] text-zinc-200">
                Combined{" "}
                <span className="font-medium">
                  {formatMoneyFromCents(combinedDueCentsInFlight, totalsSingleCurrency)}
                </span>{" "}
                still marked due across <strong>draft + open</strong> invoices below (review before telling the client
                a single number).
              </p>
            ) : null}
            {combinedDueCentsInFlight > 0 && !totalsSingleCurrency ? (
              <p className="rounded border border-amber-900/50 bg-amber-950/25 px-2 py-1.5 text-[11px] text-amber-100">
                Multiple currencies in flight — add each invoice line below instead of quoting one total.
              </p>
            ) : null}
            <p className="text-[11px] text-zinc-600">
              Labels mirror Stripe. Amounts refresh when webhooks run — keep{" "}
              <code className="rounded bg-black/40 px-1 text-zinc-400">STRIPE_WEBHOOK_SECRET</code> set in production.
              Webhook receipts only store Stripe event ids/types (not full payloads) to avoid persisting stray card metadata.
              <span className="block pt-2 text-zinc-500">
                Also: on <span className="font-mono text-zinc-400">invoice.payment_failed</span> the server re-requests the
                invoice with expanded nested payments so payer decline excerpts match what producers see after a Dashboard
                resync.
              </span>
            </p>
            {openInvoiceRetryCoach ? (
              <p className="text-[11px] leading-relaxed text-zinc-500">{stripeOpenInvoiceRetryGuide}</p>
            ) : null}
            <ul className="space-y-2 text-xs">
              {project.stripeInvoices.map((inv) => {
                const hint = stripeInvoiceProducerHint(inv.status);
                const dueLine =
                  typeof inv.amountDueCents === "number"
                    ? inv.status === "paid"
                      ? "Paid — thank you recorded in Stripe"
                      : inv.status === "void"
                        ? "Voided — no payment due"
                        : inv.amountDueCents <= 0
                          ? `${formatMoneyFromCents(0, inv.currency)} balance shown`
                          : `${formatMoneyFromCents(inv.amountDueCents, inv.currency)} due`
                    : null;
                return (
                <li key={inv.id} className="rounded border border-zinc-800 bg-black/40 px-3 py-2 text-zinc-300">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-medium text-zinc-100">{stripeInvoiceStatusLabel(inv.status)}</span>
                    {inv.invoiceNumber ? (
                      <span className="text-zinc-500">Invoice #{inv.invoiceNumber}</span>
                    ) : null}
                    <span className="font-mono text-[10px] text-zinc-600">{inv.stripeInvoiceId}</span>
                  </div>
                  {hint ? <p className="mt-1 text-[11px] text-zinc-500">{hint}</p> : null}
                  <p className="mt-1 text-[10px] text-zinc-600">
                    Row updated {formatStripeRecordSynced(inv.updatedAt)}
                    {inv.lastSyncedFromStripeAt ? (
                      <>
                        {" "}
                        · last Stripe payload applied {formatStripeRecordSynced(inv.lastSyncedFromStripeAt)}
                      </>
                    ) : null}
                  </p>
                  {typeof inv.attemptCount === "number" && inv.attemptCount > 0 ? (
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Stripe billing{" "}
                      <span className="font-medium text-zinc-300">attempt count {inv.attemptCount}</span> (automatic
                      schedule + first collection).
                    </p>
                  ) : null}
                  {inv.nextPaymentAttemptAt && inv.status === "open" ? (
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Next dashboard-indicated retry window ≈{" "}
                      <span className="font-medium text-zinc-400">
                        {formatStripeRecordSynced(inv.nextPaymentAttemptAt)}
                      </span>
                      . Send-invoice productions may still rely on the payer reopening their hosted invoice link.
                    </p>
                  ) : null}
                  {inv.lastStripeErrorSummary ? (
                    <p className="mt-1 text-[11px] leading-relaxed text-rose-300/95">
                      <span className="font-semibold text-rose-200/95">Stripe error excerpt:</span>{" "}
                      {inv.lastStripeErrorSummary}
                    </p>
                  ) : null}
                  {inv.status === "open" &&
                  typeof inv.attemptCount === "number" &&
                  inv.attemptCount > 0 &&
                  !inv.lastStripeErrorSummary ? (
                    <p className="mt-1 text-[10px] text-zinc-600">
                      Stripe did not attach a finalization error snippet here — open the Dashboard payment log for card/ACH
                      decline details.
                    </p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2 text-zinc-500">
                    {dueLine ? <span>{dueLine}</span> : null}
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
                    <form action={resyncTrackedStripeInvoice} className="inline">
                      <input type="hidden" name="projectId" value={project.id} />
                      <input type="hidden" name="stripeInvoiceId" value={inv.stripeInvoiceId} />
                      <button
                        type="submit"
                        className="text-[11px] font-medium text-zinc-400 underline decoration-zinc-600 underline-offset-2 hover:text-zinc-200"
                      >
                        Resync from Stripe
                      </button>
                    </form>
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
              );
              })}
            </ul>
            {webhookOk && latestInvoiceStripeWebhook?.processedAt ? (
              <p className="mt-3 text-[10px] text-zinc-600">
                Last invoice webhook processed (entire app):{" "}
                <span className="text-zinc-500">
                  {formatStripeRecordSynced(latestInvoiceStripeWebhook.processedAt)}
                </span>
              </p>
            ) : webhookOk ? (
              <p className="mt-3 text-[10px] text-zinc-600">
                No invoice webhook deliveries recorded yet — create or change an invoice in Stripe to populate this.
              </p>
            ) : null}
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
            <span className="text-zinc-400">Event conclusion date</span>
            <input
              type="date"
              name="eventConclusionAt"
              defaultValue={
                project.eventConclusionAt ? project.eventConclusionAt.toISOString().slice(0, 10) : ""
              }
              className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            />
            <span className="text-[11px] leading-snug text-zinc-600">
              Contract-defined end milestone. Directors lose portal access to this production 90 calendar days after this date
              (see product spec). Leave blank until the show is closed out.
            </span>
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
