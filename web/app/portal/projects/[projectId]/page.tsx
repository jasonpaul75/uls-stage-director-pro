import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { AppShell, buttonClassName } from "@/components/ui";
import { auth } from "@/auth";
import { PortalShowSectionNav } from "@/components/portal-show-section-nav";
import { loadProjectForPortalViewer } from "@/lib/project-access-portal";
import { portalIntakeSectionNavItems } from "@/lib/portal-intake-section-nav";
import { stripeSecretKeyAppearsSandbox } from "@/lib/stripe-admin";
import {
  formatMoneyFromCents,
  formatStripeRecordSynced,
  normalizedStripeCurrencyCode,
  stripeDirectorOpenInvoiceAttemptsNote,
  stripeHasOpenBalanceDue,
  stripeInvoiceStatusLabel,
  stripeOpenInvoiceRetryGuide,
} from "@/lib/stripe-invoice-ui";
import { docuSignProducerConsoleEnvelopeUrl, docuSignRecipientDocumentsHubUrl } from "@/lib/docusign-admin";
import { docuSignEnvelopeStatusLabel } from "@/lib/docusign-envelope-ui";
import { parseHttpsUrl } from "@/lib/safe-https-url";
import { GlobalRole } from "@prisma/client";
import { PortalDirectorSharesSection } from "@/components/portal-director-shares-section";
import { DIRECTOR_SHARE_ERR_COPY } from "@/lib/director-share-err-copy";

type Props = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{
    booking?: string;
    ds_uploaded?: string;
    ds_deleted?: string;
    ds_err?: string;
  }>;
};

function ProposalPanels(props: { title: string; body?: string | null }) {
  const text = props.body?.trim();
  if (!text) return null;

  return (
    <ProducerGlassCard className="mt-0 scroll-mt-6">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-uls-subtle">{props.title}</h3>
      <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2 text-sm text-uls-text">
        {text}
      </pre>
    </ProducerGlassCard>
  );
}

export default async function PortalProjectDetailPage(props: Props) {
  const { projectId } = await props.params;
  const sp = (await props.searchParams) ?? {};
  const session = await auth();
  const uid = session?.user?.id;
  const role = session?.user?.globalRole;
  if (!uid || role === undefined) {
    redirect("/login?callbackUrl=/portal");
  }

  const project = await loadProjectForPortalViewer(projectId, { userId: uid, globalRole: role });

  if (!project) notFound();

  const isAdmin = role === GlobalRole.ULS_ADMIN;

  if (role === GlobalRole.DIRECTOR && project.bookingSecuredAt) {
    redirect(`/portal/shows/${projectId}`);
  }

  const showProposal = project.proposalDirectorVisible || isAdmin;
  const showContracts = project.contractsDirectorVisible || isAdmin;
  const showStripe = project.stripeBillingDirectorVisible || isAdmin;

  const directorSeesAnything =
    project.proposalDirectorVisible ||
    project.contractsDirectorVisible ||
    project.stripeBillingDirectorVisible;

  const hasAnyProposal =
    Boolean(project.proposalPricingNotes?.trim()) ||
    Boolean(project.proposalTechRiderNotes?.trim()) ||
    Boolean(project.proposalCrewNotes?.trim());
  const hasDocuSignRows = project.docuSignEnvelopes.length > 0;
  const hasStripeRows = project.stripeInvoices.length > 0;

  const adminHasUnpublishedDirectorContent =
    isAdmin &&
    ((!project.proposalDirectorVisible && hasAnyProposal) ||
      (!project.contractsDirectorVisible && hasDocuSignRows) ||
      (!project.stripeBillingDirectorVisible && hasStripeRows));

  const stripeSandbox = stripeSecretKeyAppearsSandbox();
  const openInvoicesOnly = project.stripeInvoices.filter((inv) => inv.status === "open");
  let combinedOpenDueCents = 0;
  const openInvoiceCurrencies = new Set<string>();
  for (const inv of openInvoicesOnly) {
    if (typeof inv.amountDueCents === "number" && inv.amountDueCents > 0) {
      combinedOpenDueCents += inv.amountDueCents;
    }
    openInvoiceCurrencies.add(normalizedStripeCurrencyCode(inv.currency));
  }
  const openDueSingleCurrency = openInvoiceCurrencies.size === 1 ? [...openInvoiceCurrencies][0] : null;
  const openBalanceRetryHint = stripeHasOpenBalanceDue(project.stripeInvoices);

  const intakeNavItems = portalIntakeSectionNavItems(project, isAdmin);

  return (
    <AppShell id="portal-main-content" outerMaxWidth="wide" contentMaxWidth="full" className="pt-10">
      <nav className="uls-feedback-banner-in mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm backdrop-blur-sm">
        {isAdmin ? (
          <>
            <Link href={`/portal/shows/${projectId}`} className="text-uls-accent-strong hover:underline">
              Show workspace
            </Link>
            <span aria-hidden className="text-uls-subtle">
              /
            </span>
          </>
        ) : null}
        <Link href={`/portal/projects/${projectId}/support`} className="text-uls-accent-strong hover:underline">
          Support
        </Link>
      </nav>

      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-uls-subtle">Intake workspace</p>
        <h1 className="text-pretty text-3xl font-semibold tracking-tight text-uls-text md:text-[2rem]">{project.name}</h1>
      </header>

      {sp.booking === "pending" ? (
        <div
          role="status"
          className="uls-feedback-banner-in mt-6 rounded-2xl border border-amber-500/35 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-50 backdrop-blur-sm"
        >
          ULS hasn&apos;t confirmed your booking on this production yet — once contract and initial payment are secured,
          your show workspace (run of show, show-day updates, and post-event links) will open here. You can still use
          Support anytime.
        </div>
      ) : null}

      {sp.ds_uploaded === "1" ? (
        <div
          role="status"
          className="uls-feedback-banner-in mt-6 rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.1] px-4 py-3 text-sm text-emerald-50 backdrop-blur-sm"
        >
          Uploaded — find it under <span className="font-medium text-emerald-100">Production files</span> below. ULS production
          staff can download it from the intake record or event workspace.
        </div>
      ) : null}
      {sp.ds_deleted === "1" ? (
        <div
          role="status"
          className="uls-feedback-banner-in mt-6 rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.1] px-4 py-3 text-sm text-emerald-50 backdrop-blur-sm"
        >
          File removed from the portal.
        </div>
      ) : null}
      {typeof sp.ds_err === "string" && DIRECTOR_SHARE_ERR_COPY[sp.ds_err] ? (
        <p role="alert" className="mt-4 text-sm text-rose-300">
          {DIRECTOR_SHARE_ERR_COPY[sp.ds_err]}
        </p>
      ) : typeof sp.ds_err === "string" ? (
        <p role="alert" className="mt-4 text-sm text-rose-300">
          Couldn&apos;t complete that file action — try again or use Support.
        </p>
      ) : null}

      <div className="mt-10 flex flex-col gap-8 lg:flex-row lg:justify-center lg:gap-10 xl:gap-14">
        <PortalShowSectionNav
          items={intakeNavItems}
          desktopAriaLabel="Intake workspace sections"
          mobileTitle="Jump to section"
          mobileTriggerLabel="Jump to section"
        />
        <div className="min-w-0 flex-1 lg:max-w-lg">
      <section id="portal-intake-overview" className="scroll-mt-6">
        <ProducerGlassCard padding="compact">
          <dl className="space-y-3 text-sm text-uls-muted">
            <div>
              <dt className="text-uls-subtle">Status</dt>
          <dd>
            {project.status === "INTAKE_SUBMITTED" ? "Queued for ULS" : project.status}
          </dd>
        </div>
        <div>
          <dt className="text-uls-subtle">Venue</dt>
          <dd>
            {project.venue ?? "—"}
            {project.cityState ? ` · ${project.cityState}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-uls-subtle">Submitted</dt>
          <dd>{project.submittedAt ? project.submittedAt.toLocaleString() : "—"}</dd>
        </div>
        {(project.requestedEventStart || project.requestedEventEnd) && (
          <div>
            <dt className="text-uls-subtle">Requested dates</dt>
            <dd>
              {project.requestedEventStart?.toISOString().slice(0, 10) ?? "—"} →{" "}
              {project.requestedEventEnd?.toISOString().slice(0, 10) ?? "—"}
            </dd>
          </div>
        )}
        {typeof project.contestantApprox === "number" ? (
          <div>
            <dt className="text-uls-subtle">Contestants (approx)</dt>
            <dd>{project.contestantApprox}</dd>
          </div>
        ) : null}
      </dl>
        </ProducerGlassCard>
      </section>

      <PortalDirectorSharesSection
        projectId={project.id}
        portalReturn="intake"
        viewerUserId={uid}
        canUpload={role === GlobalRole.DIRECTOR}
        shares={project.directorShares ?? []}
      />

      {(project.categoryNotes?.trim() ||
        project.livestreamNotes?.trim() ||
        project.budgetNotes?.trim() ||
        project.additionalNotes?.trim()) && (
        <section id="portal-intake-summary" className="scroll-mt-6 mt-10">
          <ProducerGlassCard>
            <h2 className="text-sm font-semibold text-uls-text">Your intake summary</h2>
            <p className="mt-1 text-xs text-uls-muted">
              Same details you submitted — ULS may refine scope as the production firms up.
            </p>
            <div className="mt-4 space-y-5 text-sm">
              {project.categoryNotes?.trim() ? (
                <div>
                  <h3 className="text-xs uppercase tracking-wide text-uls-subtle">Categories</h3>
                  <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2 text-uls-text">
                    {project.categoryNotes.trim()}
                  </pre>
                </div>
              ) : null}
              {project.livestreamNotes?.trim() ? (
                <div>
                  <h3 className="text-xs uppercase tracking-wide text-uls-subtle">Livestream</h3>
                  <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2 text-uls-text">
                    {project.livestreamNotes.trim()}
                  </pre>
                </div>
              ) : null}
              {project.budgetNotes?.trim() ? (
                <div>
                  <h3 className="text-xs uppercase tracking-wide text-uls-subtle">Budget</h3>
                  <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2 text-uls-text">
                    {project.budgetNotes.trim()}
                  </pre>
                </div>
              ) : null}
              {project.additionalNotes?.trim() ? (
                <div>
                  <h3 className="text-xs uppercase tracking-wide text-uls-subtle">Your notes</h3>
                  <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2 text-uls-text">
                    {project.additionalNotes.trim()}
                  </pre>
                </div>
              ) : null}
            </div>
          </ProducerGlassCard>
        </section>
      )}

      <section
        id={showProposal ? "portal-intake-proposal" : undefined}
        className={`mt-10 space-y-6${showProposal ? " scroll-mt-6" : ""}`}
      >
        {!isAdmin && !directorSeesAnything ? (
          <p className="text-sm text-uls-muted">
            ULS hasn&apos;t opened proposal, contracts, or billing yet — your producer publishes those from the intake
            record when ready.
          </p>
        ) : null}

        {adminHasUnpublishedDirectorContent ? (
          <p
            role="status"
            className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3 text-xs text-amber-50 backdrop-blur-sm"
          >
            ULS-admin preview — directors only see proposal, contracts, and Stripe sections you publish here; run of show,
            show-day, and post-event live in the show workspace after booking is confirmed.
          </p>
        ) : null}

        {showProposal && !hasAnyProposal ? (
          <p className="text-sm text-uls-subtle">
            Proposal sections aren&apos;t filled in yet — check back soon.
          </p>
        ) : null}

        {showProposal ? (
          <div className="space-y-6">
            <ProposalPanels title="Pricing & milestones" body={project.proposalPricingNotes} />
            <ProposalPanels title="Technical & rider cues" body={project.proposalTechRiderNotes} />
            <ProposalPanels title="Crew & rehearsal rhythm" body={project.proposalCrewNotes} />
          </div>
        ) : null}
      </section>

      {showContracts && hasDocuSignRows ? (
        <section id="portal-intake-contracts" className="scroll-mt-6 mt-10">
          <ProducerGlassCard>
            <h2 className="text-sm font-semibold text-uls-text">Contracts &amp; signatures</h2>
          <p className="mt-1 text-xs text-uls-muted">
            DocuSign is the legal record for signatures. This portal only mirrors status;{" "}
            <span className="text-uls-muted">signing usually happens from DocuSigned email or your DocuSigned inbox</span>, not
            the link below (which often opens the sender view for ULS accounts).
          </p>
          <ul className="mt-4 list-none space-y-3 pl-0">
            {project.docuSignEnvelopes.map((env) => (
              <li key={env.id} className="list-none">
                <ProducerGlassCard as="div" padding="compact" className="text-xs text-uls-muted">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-uls-text">{docuSignEnvelopeStatusLabel(env.status)}</span>
                  {env.subject ? (
                    <span className="text-uls-muted">{env.subject}</span>
                  ) : (
                    <span className="text-uls-subtle">Agreement</span>
                  )}
                </div>
                <p className="mt-2 font-mono text-[10px] text-uls-subtle">{env.envelopeId}</p>
                <p className="mt-1 text-uls-muted">
                  {env.completedAt ? (
                    <span className="text-emerald-400/95">
                      Completed {formatStripeRecordSynced(env.completedAt)}.
                    </span>
                  ) : env.voidedAt ? (
                    <span className="text-amber-400/95">Voided {formatStripeRecordSynced(env.voidedAt)}.</span>
                  ) : env.statusChangedAt ? (
                    <span>Last update {formatStripeRecordSynced(env.statusChangedAt)}.</span>
                  ) : (
                    <span>Waiting for the next mirrored status from DocuSign.</span>
                  )}
                </p>
                {env.lastWebhookEvent?.trim() ? (
                  <p className="mt-2 text-[10px] text-uls-subtle">Last event: {env.lastWebhookEvent.trim()}</p>
                ) : null}
                {env.completedAt ? (
                  <p className="mt-2 text-[10px] leading-relaxed text-uls-subtle">
                    Signed PDFs and final packets live in DocuSign — use DocuSigned email receipts or your DocuSign account &ldquo;Completed&rdquo; folder to download copies. This portal does not store contract files.
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                  <a
                    href={docuSignRecipientDocumentsHubUrl()}
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-500/95 hover:text-amber-400"
                  >
                    DocuSigned inbox (sign or review)
                  </a>
                  <a
                    href={docuSignProducerConsoleEnvelopeUrl(env.envelopeId)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-uls-subtle hover:text-uls-text"
                  >
                    Open envelope (send/manage view)
                  </a>
                </div>
                </ProducerGlassCard>
              </li>
            ))}
          </ul>
          </ProducerGlassCard>
        </section>
      ) : null}

      {showStripe && hasStripeRows ? (
        <section id="portal-intake-invoices" className="scroll-mt-6 mt-10">
          <ProducerGlassCard>
            <h2 className="text-sm font-semibold text-uls-text">Invoices &amp; payments</h2>
          <p className="mt-1 text-xs text-uls-muted">
            ULS sends Stripe-hosted invoices when billing is finalized. Pay from the button below once a link appears — no
            account required on this portal.
          </p>
          {stripeSandbox ? (
            <p
              role="status"
              className="rounded-2xl border border-sky-500/28 bg-sky-500/[0.07] px-4 py-3 text-[11px] leading-relaxed text-sky-100 backdrop-blur-sm"
            >
              <span className="font-semibold">Test invoices:</span> Use Stripe&apos;s{" "}
              <span className="font-medium">4242&nbsp;4242&nbsp;4242&nbsp;4242</span> card numbers or other test methods.
              Nothing here moves real money until ULS switches to live Stripe keys.
            </p>
          ) : (
            <p
              role="status"
              className="rounded-2xl border border-emerald-500/28 bg-emerald-500/[0.07] px-4 py-3 text-[11px] leading-relaxed text-emerald-100 backdrop-blur-sm"
            >
              <span className="font-semibold">Live billing:</span> Successful payments settle to ULS on Stripe&apos;s timetable.
              Pull PDF receipts from each hosted invoice link.
            </p>
          )}
          {combinedOpenDueCents > 0 && openDueSingleCurrency ? (
            <p
              role="status"
              className="rounded-2xl border border-white/[0.1] bg-black/20 px-4 py-3 text-[11px] text-uls-text backdrop-blur-sm"
            >
              Across <strong className="text-uls-text">open</strong> (payable) invoices below, roughly{" "}
              <strong className="text-uls-text">
                {formatMoneyFromCents(combinedOpenDueCents, openDueSingleCurrency)}
              </strong>{" "}
              remains due — totals exclude drafts until they are finalized and emailed.
            </p>
          ) : null}
          {combinedOpenDueCents > 0 && !openDueSingleCurrency ? (
            <p
              role="status"
              className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3 text-[11px] text-amber-50 backdrop-blur-sm"
            >
              Multiple currencies among open invoices — pay each Stripe link separately rather than quoting one balance.
            </p>
          ) : null}
          {openBalanceRetryHint ? (
            <p role="status" className="mt-3 text-[11px] leading-relaxed text-uls-subtle">{stripeOpenInvoiceRetryGuide}</p>
          ) : null}
          <ul className="mt-4 list-none space-y-3 pl-0">
            {project.stripeInvoices.map((inv) => {
              const attemptsNote = stripeDirectorOpenInvoiceAttemptsNote(inv);
              const rawHosted = inv.hostedInvoiceUrl?.trim() ?? "";
              const hostedHttps = rawHosted ? parseHttpsUrl(rawHosted) : null;
              const hostedUrlRejected = Boolean(rawHosted && !hostedHttps);

              return (
                <li key={inv.id} className="list-none">
                <ProducerGlassCard as="div" padding="compact" className="text-sm text-uls-muted">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-medium text-uls-text">{stripeInvoiceStatusLabel(inv.status)}</p>
                    {inv.invoiceNumber ? (
                      <p className="text-xs text-uls-subtle">Invoice #{inv.invoiceNumber}</p>
                    ) : null}
                  </div>
                  {typeof inv.amountDueCents === "number" ? (
                    <p className="text-uls-muted">
                      {inv.amountDueCents <= 0 || inv.status === "paid"
                        ? inv.status === "paid"
                          ? "Paid"
                          : "No balance due"
                        : `${formatMoneyFromCents(inv.amountDueCents, inv.currency)} due`}
                    </p>
                  ) : null}
                </div>
                <p className="mt-2 text-[10px] text-uls-subtle">
                  Updated {formatStripeRecordSynced(inv.updatedAt)}
                </p>
                {attemptsNote ? (
                  <p role="status" className="mt-2 text-[11px] leading-relaxed text-amber-200/85">{attemptsNote}</p>
                ) : null}
                {inv.lastStripeErrorSummary &&
                inv.status === "open" &&
                typeof inv.amountDueCents === "number" &&
                inv.amountDueCents > 0 ? (
                  <p role="alert" className="mt-2 text-[11px] leading-relaxed text-rose-200/85">
                    <span className="font-semibold text-rose-100/95">Stripe notice:</span>{" "}
                    {inv.lastStripeErrorSummary}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  {hostedHttps && (inv.status === "open" || inv.status === "draft") ? (
                    <a
                      href={hostedHttps}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonClassName("primary", "md", "inline-flex justify-center")}
                    >
                      View or pay invoice
                    </a>
                  ) : null}
                  {hostedHttps && inv.status === "paid" ? (
                    <a
                      href={hostedHttps}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex rounded-uls-md border border-uls-border-strong px-4 py-2 text-center text-sm font-medium text-uls-text hover:bg-uls-surface-raised"
                    >
                      Invoice &amp; receipt
                    </a>
                  ) : null}
                  {hostedUrlRejected && (inv.status === "open" || inv.status === "draft" || inv.status === "paid") ? (
                    <p className="text-xs text-rose-200/90">
                      Hosted invoice link on file is not a valid <span className="font-mono text-[10px]">https</span> URL —
                      ask your producer to resync from Stripe.
                    </p>
                  ) : null}
                  {!rawHosted && inv.status === "open" ? (
                    <p role="status" className="text-xs text-amber-200/90">
                      Your pay link isn&apos;t synced yet — refresh shortly or email your ULS producer if this persists.
                    </p>
                  ) : null}
                  {inv.status === "paid" && !rawHosted ? (
                    <p className="text-xs text-uls-subtle">Thank you — this invoice is settled in Stripe.</p>
                  ) : null}
                  {inv.status === "draft" && !rawHosted ? (
                    <p className="text-xs text-uls-subtle">
                      ULS is still drafting this invoice. You&apos;ll receive email from Stripe when it&apos;s sent.
                    </p>
                  ) : null}
                  {inv.status === "void" ? (
                    <p className="text-xs text-uls-subtle">
                      This invoice was voided by ULS. Reach out if the paperwork doesn&apos;t match your expectations.
                    </p>
                  ) : null}
                  {inv.status === "uncollectible" ? (
                    <p role="alert" className="text-xs text-rose-300/95">
                      Stripe marked this balance uncollectible. Contact your producer before attempting another payment —
                      don&apos;t resend funds without confirmation.
                    </p>
                  ) : null}
                </div>
                </ProducerGlassCard>
                </li>
              );
            })}
          </ul>
          </ProducerGlassCard>
        </section>
      ) : null}

      <p className="mt-10 text-xs text-uls-subtle">
        Run of show, show-day notes, and post-event delivery live in your show workspace once ULS confirms your booking.
        Questions on pricing or agreements? Reach your assigned ULS producer.
      </p>
        </div>
      </div>
    </AppShell>
  );
}
